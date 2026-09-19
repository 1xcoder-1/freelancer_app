from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.core.database import get_db
from app.core.auth import require_authenticated_user
from app.core.workspace import get_or_create_user_workspace
from app.models.proposal import Proposal
from app.models.client import Client
from app.models.project import Project
from app.schemas.domain import (
    ProposalCreate,
    ProposalOut,
    ProposalAIGenerateRequest,
    ProposalAIGenerateResponse,
)

router = APIRouter(prefix="/proposals", tags=["Proposals & AI Pitch"])

@router.get("", response_model=List[ProposalOut])
async def list_proposals(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(Proposal).where(Proposal.workspace_id == workspace.id).order_by(Proposal.created_at.desc())
    result = await db.execute(stmt)
    proposals = result.scalars().all()

    # Pre-fetch client names
    client_ids = [p.client_id for p in proposals if p.client_id]
    clients_map = {}
    if client_ids:
        c_res = await db.execute(select(Client).where(Client.id.in_(client_ids), Client.workspace_id == workspace.id))
        clients_map = {c.id: c.name for c in c_res.scalars().all()}

    out = []
    for p in proposals:
        out.append({
            "id": p.id,
            "workspace_id": p.workspace_id,
            "client_id": p.client_id,
            "client_name": clients_map.get(p.client_id),
            "project_id": p.project_id,
            "title": p.title,
            "client_scope": p.client_scope,
            "budget": p.budget,
            "status": p.status,
            "pitch_content": p.pitch_content,
            "token": p.token,
            "created_at": p.created_at
        })
    return out

@router.post("", response_model=ProposalOut, status_code=status.HTTP_201_CREATED)
async def create_proposal(
    payload: ProposalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)

    client_name = None
    if payload.client_id:
        c_res = await db.execute(
            select(Client).where(Client.id == payload.client_id, Client.workspace_id == workspace.id)
        )
        cl = c_res.scalar_one_or_none()
        if not cl:
            raise HTTPException(status_code=400, detail="Client not found in current workspace")
        client_name = cl.name

    if payload.project_id:
        p_res = await db.execute(
            select(Project).where(Project.id == payload.project_id, Project.workspace_id == workspace.id)
        )
        if not p_res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Project not found in current workspace")

    proposal = Proposal(
        workspace_id=workspace.id,
        client_id=payload.client_id,
        project_id=payload.project_id,
        title=payload.title,
        client_scope=payload.client_scope,
        budget=payload.budget,
        status=payload.status or "sent",
        pitch_content=payload.pitch_content,
    )
    db.add(proposal)
    await db.commit()
    await db.refresh(proposal)

    return {
        "id": proposal.id,
        "workspace_id": proposal.workspace_id,
        "client_id": proposal.client_id,
        "client_name": client_name,
        "project_id": proposal.project_id,
        "title": proposal.title,
        "client_scope": proposal.client_scope,
        "budget": proposal.budget,
        "status": proposal.status,
        "pitch_content": proposal.pitch_content,
        "token": proposal.token,
        "created_at": proposal.created_at
    }

@router.delete("/{proposal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_proposal(
    proposal_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(Proposal).where(Proposal.id == proposal_id, Proposal.workspace_id == workspace.id)
    result = await db.execute(stmt)
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    await db.delete(proposal)
    await db.commit()
    return None

@router.post("/ai-generate", response_model=ProposalAIGenerateResponse)
async def generate_ai_proposal(
    payload: ProposalAIGenerateRequest,
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    scope = payload.client_scope.strip()
    budget = payload.target_budget

    deliverables = [
        "Phase 1: Architecture Blueprint, User Stories & Interactive Wireframes",
        "Phase 2: High-Performance Next.js + FastAPI Component Development & API Integration",
        "Phase 3: Database Optimization, Cloudinary Storage CDN, Security Audit & Production Deployment"
    ]

    title = f"Proposal: {scope[:40]}..." if len(scope) > 40 else f"Proposal: {scope}"
    pitch = (
        f"Hi there!\n\n"
        f"I reviewed your project requirements: \"{scope}\".\n\n"
        f"I specialize in production-grade full-stack architecture, clean scalable code, and guaranteed milestone deliveries.\n\n"
        f"Deliverables & Scope Breakdown:\n"
        f"• Phase 1: Architecture Blueprint & Technical Specifications\n"
        f"• Phase 2: Next.js + FastAPI Implementation with Type-Safe APIs\n"
        f"• Phase 3: Neon PostgreSQL Integration, Edge CDN Asset Pipelines & QA Testing\n\n"
        f"Proposed Fixed Budget: ${budget:,.2f}\n"
        f"Estimated Timeline: 2-3 Weeks\n\n"
        f"Let's connect on the client portal to review milestones and finalize the agreement!"
    )

    return {
        "title": title,
        "pitch_content": pitch,
        "deliverables": deliverables,
        "suggested_budget": budget,
        "estimated_timeline": "2-3 Weeks"
    }
