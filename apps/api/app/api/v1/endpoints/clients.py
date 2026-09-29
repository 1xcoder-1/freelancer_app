from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from typing import List, Dict, Any
from app.core.database import get_db
from app.core.auth import require_authenticated_user
from app.core.workspace import get_or_create_user_workspace
from app.models.client import Client
from app.models.finance import Invoice
from app.schemas.domain import ClientCreate, ClientUpdate, ClientOut

router = APIRouter(prefix="/clients", tags=["Clients CRM"])

@router.get("", response_model=List[ClientOut])
async def list_clients(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """List the workspace's clients with per-client revenue tracked alongside.

    Revenue answers "who are my real income sources?" in one glance: total_billed
    counts every invoice that left draft, total_paid counts the settled money.
    A single grouped aggregate over the workspace's invoices avoids N+1 queries,
    and the whole thing stays scoped to the caller's workspace.
    """
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(Client).where(Client.workspace_id == workspace.id).order_by(Client.created_at.desc())
    result = await db.execute(stmt)
    clients = result.scalars().all()

    agg = await db.execute(
        select(
            Invoice.client_id,
            func.coalesce(func.sum(Invoice.total_amount), 0.0),
            func.coalesce(func.sum(case((Invoice.status == "paid", Invoice.total_amount), else_=0.0)), 0.0),
        )
        .where(
            Invoice.workspace_id == workspace.id,
            Invoice.client_id.is_not(None),
            Invoice.status != "draft",
        )
        .group_by(Invoice.client_id)
    )
    revenue_map = {row[0]: (float(row[1] or 0.0), float(row[2] or 0.0)) for row in agg.all()}

    out: List[Dict[str, Any]] = []
    for c in clients:
        billed, paid = revenue_map.get(c.id, (0.0, 0.0))
        out.append({
            "id": c.id,
            "workspace_id": c.workspace_id,
            "name": c.name,
            "company_name": c.company_name,
            "email": c.email,
            "phone": c.phone,
            "website": c.website,
            "status": c.status,
            "notes": c.notes,
            "health_score": c.health_score,
            "total_billed": round(billed, 2),
            "total_paid": round(paid, 2),
            "created_at": c.created_at,
        })
    return out

@router.post("", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
async def create_client(
    payload: ClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    client = Client(
        workspace_id=workspace.id,
        name=payload.name,
        company_name=payload.company_name,
        email=payload.email,
        phone=payload.phone,
        website=payload.website,
        notes=payload.notes,
        status=payload.status
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client

@router.get("/{client_id}", response_model=ClientOut)
async def get_client(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(Client).where(Client.id == client_id, Client.workspace_id == workspace.id)
    result = await db.execute(stmt)
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client

@router.patch("/{client_id}", response_model=ClientOut)
@router.put("/{client_id}", response_model=ClientOut)
async def update_client(
    client_id: str,
    payload: ClientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(Client).where(Client.id == client_id, Client.workspace_id == workspace.id)
    result = await db.execute(stmt)
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if hasattr(client, field):
            setattr(client, field, val)

    await db.commit()
    await db.refresh(client)
    return client

@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(Client).where(Client.id == client_id, Client.workspace_id == workspace.id)
    result = await db.execute(stmt)
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    await db.delete(client)
    await db.commit()
