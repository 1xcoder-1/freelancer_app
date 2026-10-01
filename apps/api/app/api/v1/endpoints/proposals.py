from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from app.core.database import get_db
from app.core.auth import require_authenticated_user
from app.core.workspace import get_or_create_user_workspace
from app.core.inngest_client import emit
from app.models.proposal import Proposal
from app.models.client import Client
from app.models.project import Project
from app.schemas.domain import (
    ProposalCreate,
    ProposalOut,
    ProposalStatusUpdate,
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
            "expires_at": p.expires_at,
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
        # L4: seed expiry from an explicit date or valid_days so an unanswered
        # proposal becomes 'expired' on the daily scan instead of lingering open.
        expires_at=payload.expires_at or (datetime.utcnow() + timedelta(days=payload.valid_days)),
    )
    db.add(proposal)
    await db.commit()
    await db.refresh(proposal)

    if proposal.status == "sent":
        await emit(
            "proposal.sent",
            {
                "proposal_id": proposal.id,
                "title": proposal.title,
                "budget": proposal.budget,
                "workspace_id": proposal.workspace_id,
                "client_id": proposal.client_id,
                "token": proposal.token,
            },
        )

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
        "expires_at": proposal.expires_at,
        "created_at": proposal.created_at
    }

@router.patch("/{proposal_id}/status", response_model=ProposalOut)
async def update_proposal_status(
    proposal_id: str,
    payload: ProposalStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """Accept/decline/reopen a proposal. Without this the pipeline was a
    one-way 'sent' and the report-card win rate could never move."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    res = await db.execute(
        select(Proposal).where(Proposal.id == proposal_id, Proposal.workspace_id == workspace.id)
    )
    proposal = res.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    # L4: an expired proposal cannot be accepted. Money that quietly aged out
    # must be re-quoted, not resurrected by a stale link click.
    if payload.status == "accepted" and proposal.status == "expired":
        raise HTTPException(status_code=410, detail="This proposal has expired; send a new version to accept it.")
    if payload.status == "accepted" and proposal.expires_at and proposal.expires_at < datetime.utcnow():
        proposal.status = "expired"
        await db.commit()
        raise HTTPException(status_code=410, detail="This proposal has expired; send a new version to accept it.")

    proposal.status = payload.status
    await db.commit()
    await db.refresh(proposal)

    client_name = None
    if proposal.client_id:
        c_res = await db.execute(
            select(Client.name).where(Client.id == proposal.client_id, Client.workspace_id == workspace.id)
        )
        client_name = c_res.scalars().first()

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
        "expires_at": proposal.expires_at,
        "created_at": proposal.created_at,
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
