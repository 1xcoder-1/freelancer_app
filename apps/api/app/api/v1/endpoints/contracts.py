from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.core.database import get_db
from app.core.auth import require_authenticated_user
from app.core.workspace import get_or_create_user_workspace
from app.models.contract import Contract
from app.models.project import Project
from app.models.client import Client
from app.models.workspace import Workspace, User
from app.schemas.domain import (
    ContractCreate,
    ContractSignRequest,
    ContractOut,
    PublicContractOut,
)

router = APIRouter(prefix="/contracts", tags=["Contracts & E-Signatures"])

# ------------------------------------------------------------------------------
# Authenticated Workspace Contract Management
# ------------------------------------------------------------------------------

@router.get("", response_model=List[ContractOut])
async def list_contracts(
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    
    query = select(Contract).where(Contract.workspace_id == workspace.id)
    if project_id:
        query = query.where(Contract.project_id == project_id)
    
    query = query.order_by(Contract.created_at.desc())
    result = await db.execute(query)
    contracts = result.scalars().all()

    # Pre-fetch project and client titles/names
    project_ids = [c.project_id for c in contracts if c.project_id]
    client_ids = [c.client_id for c in contracts if c.client_id]
    
    projects_map = {}
    if project_ids:
        p_res = await db.execute(select(Project).where(Project.id.in_(project_ids)))
        projects_map = {p.id: p.title for p in p_res.scalars().all()}
        
    clients_map = {}
    if client_ids:
        c_res = await db.execute(select(Client).where(Client.id.in_(client_ids)))
        clients_map = {c.id: c.name for c in c_res.scalars().all()}

    out = []
    for c in contracts:
        out.append({
            "id": c.id,
            "workspace_id": c.workspace_id,
            "project_id": c.project_id,
            "project_title": projects_map.get(c.project_id),
            "client_id": c.client_id,
            "client_name": clients_map.get(c.client_id) if c.client_id else None,
            "title": c.title,
            "content": c.content,
            "status": c.status,
            "token": c.token,
            "recipient_name": c.recipient_name,
            "recipient_email": c.recipient_email,
            "sender_signature": c.sender_signature,
            "sender_signed_at": c.sender_signed_at,
            "viewed_at": c.viewed_at,
            "viewed_user_agent": c.viewed_user_agent,
            "client_signature": c.client_signature,
            "client_signed_at": c.client_signed_at,
            "client_ip": c.client_ip,
            "client_user_agent": c.client_user_agent,
            "file_url": c.file_url,
            "created_at": c.created_at
        })
    return out

@router.post("", response_model=ContractOut, status_code=status.HTTP_201_CREATED)
async def create_contract(
    payload: ContractCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    user, workspace = await get_or_create_user_workspace(db, current_user)

    # Verify project belongs to workspace
    p_res = await db.execute(
        select(Project).where(Project.id == payload.project_id, Project.workspace_id == workspace.id)
    )
    project = p_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found in current workspace")

    contract = Contract(
        workspace_id=workspace.id,
        project_id=project.id,
        client_id=payload.client_id or project.client_id,
        title=payload.title,
        content=payload.content,
        recipient_name=payload.recipient_name,
        recipient_email=payload.recipient_email,
        sender_signature=payload.sender_signature or user.full_name or "Workspace Owner",
        sender_signed_at=datetime.utcnow(),
        status="sent"
    )
    db.add(contract)
    await db.commit()
    await db.refresh(contract)

    client_name = None
    if contract.client_id:
        c_res = await db.execute(select(Client).where(Client.id == contract.client_id))
        cl = c_res.scalar_one_or_none()
        if cl:
            client_name = cl.name

    return {
        "id": contract.id,
        "workspace_id": contract.workspace_id,
        "project_id": contract.project_id,
        "project_title": project.title,
        "client_id": contract.client_id,
        "client_name": client_name,
        "title": contract.title,
        "content": contract.content,
        "status": contract.status,
        "token": contract.token,
        "recipient_name": contract.recipient_name,
        "recipient_email": contract.recipient_email,
        "sender_signature": contract.sender_signature,
        "sender_signed_at": contract.sender_signed_at,
        "viewed_at": contract.viewed_at,
        "viewed_user_agent": contract.viewed_user_agent,
        "client_signature": contract.client_signature,
        "client_signed_at": contract.client_signed_at,
        "client_ip": contract.client_ip,
        "client_user_agent": contract.client_user_agent,
        "file_url": contract.file_url,
        "created_at": contract.created_at
    }

@router.delete("/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contract(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(Contract).where(Contract.id == contract_id, Contract.workspace_id == workspace.id)
    result = await db.execute(stmt)
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    await db.delete(contract)
    await db.commit()
    return None

# ------------------------------------------------------------------------------
# Public Client E-Sign & Real-Time Tracking Endpoints (Token-Based)
# ------------------------------------------------------------------------------

@router.get("/public/{token}", response_model=PublicContractOut)
async def get_public_contract(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Contract).where(Contract.token == token)
    result = await db.execute(stmt)
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract link is invalid or expired")

    # Real-Time Read Receipt Trigger: Record client opened the contract
    user_agent = request.headers.get("user-agent", "Unknown Device")
    client_ip = request.client.host if request.client else "Unknown IP"
    
    if contract.status in ("sent", "draft") and not contract.viewed_at:
        contract.status = "viewed"
        contract.viewed_at = datetime.utcnow()
        contract.viewed_user_agent = user_agent[:500]
        contract.viewed_ip = client_ip[:120]
        await db.commit()
        await db.refresh(contract)

    # Get project & freelancer metadata
    p_res = await db.execute(select(Project).where(Project.id == contract.project_id))
    project = p_res.scalar_one_or_none()

    w_res = await db.execute(select(Workspace).where(Workspace.id == contract.workspace_id))
    workspace = w_res.scalar_one_or_none()

    return {
        "id": contract.id,
        "title": contract.title,
        "content": contract.content,
        "status": contract.status,
        "token": contract.token,
        "project_title": project.title if project else "Project",
        "freelancer_name": contract.sender_signature or (workspace.name if workspace else "Freelancer"),
        "recipient_name": contract.recipient_name,
        "recipient_email": contract.recipient_email,
        "sender_signature": contract.sender_signature,
        "sender_signed_at": contract.sender_signed_at,
        "viewed_at": contract.viewed_at,
        "client_signature": contract.client_signature,
        "client_signed_at": contract.client_signed_at,
        "created_at": contract.created_at
    }

@router.post("/public/{token}/sign", response_model=PublicContractOut)
async def sign_public_contract(
    token: str,
    payload: ContractSignRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Contract).where(Contract.token == token)
    result = await db.execute(stmt)
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract link is invalid or expired")

    if contract.status == "signed":
        raise HTTPException(status_code=400, detail="Contract has already been signed")

    # Record signature and legal audit stamps
    user_agent = request.headers.get("user-agent", "Unknown Device")
    client_ip = request.client.host if request.client else "Unknown IP"

    contract.client_signature = payload.client_signature
    contract.client_signed_at = datetime.utcnow()
    contract.client_ip = client_ip[:120]
    contract.client_user_agent = user_agent[:500]
    contract.status = "signed"
    if payload.recipient_name:
        contract.recipient_name = payload.recipient_name
    if payload.recipient_email:
        contract.recipient_email = payload.recipient_email

    await db.commit()
    await db.refresh(contract)

    p_res = await db.execute(select(Project).where(Project.id == contract.project_id))
    project = p_res.scalar_one_or_none()

    w_res = await db.execute(select(Workspace).where(Workspace.id == contract.workspace_id))
    workspace = w_res.scalar_one_or_none()

    return {
        "id": contract.id,
        "title": contract.title,
        "content": contract.content,
        "status": contract.status,
        "token": contract.token,
        "project_title": project.title if project else "Project",
        "freelancer_name": contract.sender_signature or (workspace.name if workspace else "Freelancer"),
        "recipient_name": contract.recipient_name,
        "recipient_email": contract.recipient_email,
        "sender_signature": contract.sender_signature,
        "sender_signed_at": contract.sender_signed_at,
        "viewed_at": contract.viewed_at,
        "client_signature": contract.client_signature,
        "client_signed_at": contract.client_signed_at,
        "created_at": contract.created_at
    }
