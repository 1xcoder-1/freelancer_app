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
from app.models.finance import Invoice, InvoiceItem
from app.models.client import Client
from app.schemas.domain import InvoiceCreate, InvoiceOut

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
            "items": inv.items,
            "created_at": inv.created_at
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
    await db.commit()
    await db.refresh(invoice)

    # Kick off the 4-day overdue-reminder workflow (guarded no-op when
    # Inngest is disabled or unreachable — never fails the request).
    if invoice.status == "sent":
        await emit("invoice.sent", {
            "invoice_id": invoice.id,
            "workspace_id": workspace.id,
            "invoice_number": invoice.invoice_number,
            "total_amount": invoice.total_amount,
            "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
            "client_email": client_email or "",
        })

    return {
        "id": invoice.id,
        "workspace_id": invoice.workspace_id,
        "client_id": invoice.client_id,
        "client_name": client_name or "Client",
        "invoice_number": invoice.invoice_number,
        "status": invoice.status,
        "issue_date": invoice.issue_date,
        "due_date": invoice.due_date,
        "total_amount": invoice.total_amount,
        "notes": invoice.notes,
        "items": items_to_create,
        "created_at": invoice.created_at
    }

@router.patch("/{invoice_id}/status")
async def update_invoice_status(
    invoice_id: str,
    status_val: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(Invoice).where(Invoice.id == invoice_id, Invoice.workspace_id == workspace.id)
    res = await db.execute(stmt)
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    prev_status = inv.status
    inv.status = status_val
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

    return {"id": inv.id, "status": inv.status}

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
