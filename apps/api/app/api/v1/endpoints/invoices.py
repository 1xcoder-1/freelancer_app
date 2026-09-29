from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Dict, Any
from datetime import datetime
from app.core.database import get_db
from app.core.auth import require_authenticated_user
from app.core.inngest_client import emit
from app.core.workspace import get_or_create_user_workspace
from app.models.finance import Invoice, InvoiceItem, TimeEntry
from app.models.client import Client
from app.models.project import Project
from app.schemas.domain import InvoiceCreate, InvoiceOut, InvoiceStatusUpdate

router = APIRouter(prefix="/invoices", tags=["Invoices & Payments"])

@router.get("", response_model=List[InvoiceOut])
async def list_invoices(
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
            "invoice_number": inv.invoice_number,
            "status": inv.status,
            "issue_date": inv.issue_date,
            "due_date": inv.due_date,
            "total_amount": inv.total_amount,
            "notes": inv.notes,
            "paid_at": inv.paid_at,
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
        for e in entries:
            e.is_invoiced = True

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

    invoice = Invoice(
        workspace_id=workspace.id,
        client_id=payload.client_id,
        invoice_number=payload.invoice_number,
        status=payload.status,
        due_date=payload.due_date,
        notes=payload.notes,
        total_amount=total,
        items=items_to_create
    )
    db.add(invoice)
    await db.flush()
    invoice_id = invoice.id
    invoice_number = invoice.invoice_number
    total_amount = invoice.total_amount
    due_date = invoice.due_date

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
        "invoice_number": created.invoice_number,
        "status": created.status,
        "issue_date": created.issue_date,
        "due_date": created.due_date,
        "total_amount": created.total_amount,
        "notes": created.notes,
        "paid_at": created.paid_at,
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
    await db.delete(inv)
    await db.commit()
