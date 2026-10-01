from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from app.core.database import get_db
from app.core.auth import require_authenticated_user
from app.core.inngest_client import emit
from app.core.workspace import get_or_create_user_workspace
from app.models.finance import Invoice, InvoiceItem, InvoicePayment, TimeEntry
from app.models.client import Client
from app.models.project import Project
from app.schemas.domain import (
    InvoiceCreate, InvoiceOut, InvoiceStatusUpdate,
    InvoicePaymentCreate, InvoicePaymentOut, PublicInvoiceOut,
)

router = APIRouter(prefix="/invoices", tags=["Invoices & Payments"])

@router.get("", response_model=List[InvoiceOut])
async def list_invoices(
    project_id: Optional[str] = Query(None, max_length=36),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = (
        select(Invoice)
        .options(selectinload(Invoice.items))
        .where(Invoice.workspace_id == workspace.id)
        .order_by(Invoice.created_at.desc())
    )
    # P1: a project page must see only its own invoices. Filtering server-side
    # (never client-side by client_id, which leaked sibling projects) keeps the
    # tenant guard inside the WHERE clause.
    if project_id:
        proj = (await db.execute(
            select(Project.id).where(Project.id == project_id, Project.workspace_id == workspace.id)
        )).scalars().first()
        if proj is None:
            raise HTTPException(status_code=404, detail="Project not found")
        stmt = stmt.where(Invoice.project_id == project_id)
    result = await db.execute(stmt)
    invoices = result.scalars().all()

    client_ids = [inv.client_id for inv in invoices if inv.client_id]
    clients_map = {}
    if client_ids:
        c_stmt = select(Client).where(Client.id.in_(client_ids), Client.workspace_id == workspace.id)
        c_res = await db.execute(c_stmt)
        clients_map = {c.id: c.name for c in c_res.scalars().all()}

    out = []
    for inv in invoices:
        out.append({
            "id": inv.id,
            "workspace_id": inv.workspace_id,
            "client_id": inv.client_id,
            "client_name": clients_map.get(inv.client_id, "Client"),
            "project_id": inv.project_id,
            "invoice_number": inv.invoice_number,
            "status": inv.status,
            "issue_date": inv.issue_date,
            "due_date": inv.due_date,
            "total_amount": inv.total_amount,
            "notes": inv.notes,
            "paid_at": inv.paid_at,
            "token": inv.token,
            "items": inv.items,
            "created_at": inv.created_at
        })
    return out

@router.get("/unbilled-time", response_model=List[Dict[str, Any]])
async def list_unbilled_time(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """Billable tracked time that has never been invoiced — the raw material
    for "bill exactly what you worked". Each row carries the client its
    project belongs to (so the UI can only offer entries matching the
    invoice's client) and the money the hours are worth."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    rows = (await db.execute(
        select(TimeEntry, Project.client_id, Project.title)
        .join(Project, TimeEntry.project_id == Project.id)
        .where(
            TimeEntry.workspace_id == workspace.id,
            TimeEntry.is_billable.is_(True),
            TimeEntry.is_invoiced.is_(False),
        )
        .order_by(TimeEntry.start_time.desc())
    )).all()

    out = []
    for entry, project_client_id, project_title in rows:
        hours = round(entry.duration_seconds / 3600, 2)
        out.append({
            "id": entry.id,
            "project_id": entry.project_id,
            "project_title": project_title,
            "client_id": project_client_id,
            "description": entry.description,
            "start_time": entry.start_time,
            "duration_seconds": entry.duration_seconds,
            "hours": hours,
            "hourly_rate": entry.hourly_rate,
            "amount": round(hours * entry.hourly_rate, 2),
        })
    return out

@router.get("/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = (
        select(Invoice)
        .options(selectinload(Invoice.items))
        .where(Invoice.id == invoice_id, Invoice.workspace_id == workspace.id)
    )
    res = await db.execute(stmt)
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    client_name = "Client"
    if inv.client_id:
        c_res = await db.execute(
            select(Client).where(Client.id == inv.client_id, Client.workspace_id == workspace.id)
        )
        client = c_res.scalar_one_or_none()
        if client:
            client_name = client.name

    return {
        "id": inv.id,
        "workspace_id": inv.workspace_id,
        "client_id": inv.client_id,
        "client_name": client_name,
        "project_id": inv.project_id,
        "invoice_number": inv.invoice_number,
        "status": inv.status,
        "issue_date": inv.issue_date,
        "due_date": inv.due_date,
        "total_amount": inv.total_amount,
        "notes": inv.notes,
        "paid_at": inv.paid_at,
        "token": inv.token,
        "items": inv.items,
        "created_at": inv.created_at,
    }

@router.post("", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    payload: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    
    # Verify client ownership if provided
    client_name = None
    client_email = None
    if payload.client_id:
        c_res = await db.execute(
            select(Client).where(Client.id == payload.client_id, Client.workspace_id == workspace.id)
        )
        client = c_res.scalar_one_or_none()
        if not client:
            raise HTTPException(status_code=400, detail="Specified client does not exist in your workspace")
        client_name = client.name
        client_email = client.email

    # C4: an invoice with no explicit due date inherits the client's billing
    # profile (issue + payment_terms_days) instead of shipping undated, and picks
    resolved_due = payload.due_date
    late_fee_enabled = False

    # Tracked time being billed on this invoice: re-validate server-side —
    # the ids must exist in this workspace, be billable, never invoiced, and
    # belong to the same client as the invoice. Anything else is a 422, so a
    # stale tab can never double-bill an hour.
    if payload.time_entry_ids:
        ids = list(set(payload.time_entry_ids))
        entries = (await db.execute(
            select(TimeEntry).where(TimeEntry.id.in_(ids), TimeEntry.workspace_id == workspace.id)
        )).scalars().all()
        if len(entries) != len(ids):
            raise HTTPException(status_code=422, detail="One or more time entries were not found in your workspace")
        proj_ids = {e.project_id for e in entries}
        projects = (await db.execute(
            select(Project).where(Project.id.in_(proj_ids), Project.workspace_id == workspace.id)
        )).scalars().all()
        project_client_map = {p.id: p.client_id for p in projects}
        for e in entries:
            if not e.is_billable or e.is_invoiced:
                raise HTTPException(status_code=422, detail="One or more time entries are already invoiced or not billable")
            if project_client_map.get(e.project_id) != payload.client_id:
                raise HTTPException(status_code=422, detail="One or more time entries belong to a different client")
    else:
        entries = []

    total = 0.0
    items_to_create = []
    for it in payload.items:
        amount = round(it.quantity * it.unit_price, 2)
        total += amount
        items_to_create.append(InvoiceItem(
            description=it.description,
            quantity=it.quantity,
            unit_price=it.unit_price,
            amount=amount
        ))

    # V1/V6: when the billed hours all come from one project, stamp that project
    # so the project page can list its own invoices (by project_id, not the
    # client_id that leaked a sibling project's invoices).
    entry_project_ids = {e.project_id for e in entries}
    invoice_project_id = entry_project_ids.pop() if len(entry_project_ids) == 1 else None

    invoice = Invoice(
        workspace_id=workspace.id,
        client_id=payload.client_id,
        project_id=invoice_project_id,
        invoice_number=payload.invoice_number,
        status=payload.status,
        due_date=resolved_due,
        notes=payload.notes,
        total_amount=total,
        late_fee_enabled=late_fee_enabled,
        items=items_to_create
    )
    db.add(invoice)
    await db.flush()
    invoice_id = invoice.id
    invoice_number = invoice.invoice_number
    total_amount = invoice.total_amount
    due_date = invoice.due_date

    # Stamp the billed hours with this invoice (V6): is_invoiced alone was
    # unrecoverable on delete; recording invoice_id lets a delete re-open
    # exactly these rows.
    for e in entries:
        e.is_invoiced = True
        e.invoice_id = invoice.id

    # Commit before emitting so a slow/unreachable event API never holds an
    # open transaction (the invoice row is already durable at this point).
    await db.commit()

    # Kick off the 4-day overdue-reminder workflow (guarded no-op when
    # Inngest is disabled or unreachable — never fails the request).
    if payload.status == "sent":
        await emit("invoice.sent", {
            "invoice_id": invoice_id,
            "workspace_id": workspace.id,
            "invoice_number": invoice_number,
            "total_amount": total_amount,
            "due_date": due_date.isoformat() if due_date else None,
            "client_email": client_email or "",
        })

    # Re-read the persisted row with its items eager-loaded. Returning the
    # in-memory InvoiceItem objects would lazy-load after commit and raise
    # MissingGreenlet (a 500) when FastAPI serialises the response.
    res = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.items))
        .where(Invoice.id == invoice_id)
    )
    created = res.scalar_one()

    return {
        "id": created.id,
        "workspace_id": created.workspace_id,
        "client_id": created.client_id,
        "client_name": client_name or "Client",
        "project_id": created.project_id,
        "invoice_number": created.invoice_number,
        "status": created.status,
        "issue_date": created.issue_date,
        "due_date": created.due_date,
        "total_amount": created.total_amount,
        "notes": created.notes,
        "paid_at": created.paid_at,
        "token": created.token,
        "items": created.items,
        "created_at": created.created_at,
    }

@router.patch("/{invoice_id}/status")
async def update_invoice_status(
    invoice_id: str,
    payload: InvoiceStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """Move an invoice through the tracked lifecycle. The status is validated by
    the schema whitelist, so an unknown value is a 422 instead of silently
    landing in the DB where no filter/report/reminder understands it."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(Invoice).where(Invoice.id == invoice_id, Invoice.workspace_id == workspace.id)
    res = await db.execute(stmt)
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    prev_status = inv.status
    status_val = payload.status
    inv.status = status_val
    # Money-in timestamp for cash-flow analytics: stamp when it lands, clear
    # when a paid invoice is reopened (draft/sent/overdue) so reports never
    # count a cancelled payment.
    if status_val == "paid" and prev_status != "paid":
        inv.paid_at = datetime.utcnow()
    elif status_val != "paid" and prev_status == "paid":
        inv.paid_at = None
    await db.commit()

    # draft/sent lifecycle: mark-as-sent (re)schedules the reminder workflow
    if status_val == "sent" and prev_status != "sent":
        c_res = await db.execute(
            select(Client).where(Client.id == inv.client_id, Client.workspace_id == workspace.id)
        )
        client = c_res.scalar_one_or_none()
        await emit("invoice.sent", {
            "invoice_id": inv.id,
            "workspace_id": workspace.id,
            "invoice_number": inv.invoice_number,
            "total_amount": inv.total_amount,
            "due_date": inv.due_date.isoformat() if inv.due_date else None,
            "client_email": client.email if client else "",
        })

    return {"id": inv.id, "status": inv.status, "paid_at": inv.paid_at}

@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(Invoice).where(Invoice.id == invoice_id, Invoice.workspace_id == workspace.id)
    res = await db.execute(stmt)
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # V6: re-open exactly the hours this invoice had stamped, so a delete never
    # silently loses billable time. Workspace-scoped by way of the invoice row
    # already having been verified to belong to this workspace.
    linked = (await db.execute(
        select(TimeEntry).where(TimeEntry.invoice_id == inv.id)
    )).scalars().all()
    for e in linked:
        e.is_invoiced = False
        e.invoice_id = None

    await db.delete(inv)
    await db.commit()


# ---------------------------------------------------------------------------
# V1 — public payment page (/pay/{token}). Anonymous, token-guarded, and
# rate-limited (see core/rate_limit). Nothing here trusts a client-supplied
# invoice id: the token is the only handle, and it resolves within a single
# SELECT. Reading is free; the POST appends a payment and derives status.
# ---------------------------------------------------------------------------
async def _resolve_public_invoice(db: AsyncSession, token: str) -> Invoice:
    inv = (await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.items), selectinload(Invoice.payments))
        .where(Invoice.token == token)
    )).scalar_one_or_none()
    if not inv:
        # Same 404 whether the token is unknown or the invoice was deleted —
        # never leak which invoices exist behind guessed tokens.
        raise HTTPException(status_code=404, detail="This payment link is not valid.")
    return inv


async def _paid_amount(db: AsyncSession, invoice_id: str) -> float:
    total = (await db.execute(
        select(func.coalesce(func.sum(InvoicePayment.amount), 0.0)).where(InvoicePayment.invoice_id == invoice_id)
    )).scalar_one()
    return round(float(total or 0.0), 2)


@router.get("/public/{token}", response_model=PublicInvoiceOut)
async def get_public_invoice(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    inv = await _resolve_public_invoice(db, token)
    client_name = "Client"
    if inv.client_id:
        client = (await db.execute(select(Client).where(Client.id == inv.client_id))).scalar_one_or_none()
        if client:
            client_name = client.name
    paid = await _paid_amount(db, inv.id)
    amount_due = round(max(inv.total_amount - paid, 0.0), 2)
    return PublicInvoiceOut(
        invoice_number=inv.invoice_number,
        status=inv.status,
        client_name=client_name,
        issue_date=inv.issue_date,
        due_date=inv.due_date,
        total_amount=inv.total_amount,
        amount_paid=paid,
        amount_due=amount_due,
        notes=inv.notes,
        items=inv.items,
    )


@router.post("/public/{token}/pay", response_model=InvoicePaymentOut, status_code=status.HTTP_201_CREATED)
async def record_public_payment(
    token: str,
    payload: InvoicePaymentCreate,
    db: AsyncSession = Depends(get_db),
):
    """Record a (possibly partial) payment against the invoice. Money is never
    moved by this endpoint — it confirms/records what the client says they paid
    (bank transfer, cash, ...) and derives `paid` once the running total meets
    the invoice total. Payment processor integration is a separate, explicitly
    scoped follow-up."""
    inv = await _resolve_public_invoice(db, token)

    # Never let a payer over-post beyond what is owed (plus a rounding cent).
    already_paid = await _paid_amount(db, inv.id)
    remaining = round(inv.total_amount - already_paid, 2)
    if payload.amount > remaining + 0.01:
        raise HTTPException(status_code=422, detail="Amount exceeds the balance due on this invoice.")

    payment = InvoicePayment(
        invoice_id=inv.id,
        workspace_id=inv.workspace_id,
        amount=payload.amount,
        method=payload.method,
        reference=payload.reference,
        note=payload.note,
    )
    db.add(payment)

    new_total = round(already_paid + payload.amount, 2)
    now_paid = new_total >= round(inv.total_amount, 2) - 0.01
    prev_status = inv.status
    if now_paid and inv.status != "paid":
        inv.status = "paid"
        inv.paid_at = datetime.utcnow()
    await db.commit()
    await db.refresh(payment)

    # Commit-then-emit: tell the freelancer the moment money lands (guarded
    # no-op when Inngest is disabled). Only fires on the transition to paid.
    if now_paid and prev_status != "paid":
        await emit("invoice.paid", {
            "invoice_id": inv.id,
            "workspace_id": inv.workspace_id,
            "invoice_number": inv.invoice_number,
            "total_amount": inv.total_amount,
        })

    return InvoicePaymentOut(
        id=payment.id,
        amount=payment.amount,
        method=payment.method,
        reference=payment.reference,
        note=payment.note,
        paid_at=payment.paid_at,
    )
