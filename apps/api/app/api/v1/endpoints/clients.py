from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any
from app.core.database import get_db
from app.core.auth import require_authenticated_user
from app.core.workspace import get_or_create_user_workspace
from app.models.client import Client
from app.schemas.domain import ClientCreate, ClientOut

router = APIRouter(prefix="/clients", tags=["Clients CRM"])

@router.get("", response_model=List[ClientOut])
async def list_clients(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(Client).where(Client.workspace_id == workspace.id).order_by(Client.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

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
