"""Interactions (F2) — one append-only touch table for leads + clients.

A single write path feeds several features across two pages: the client
"Touchpoints" feed (C2), lead response-speed metrics (L5), and the churn-risk
"X days silent" chip on every card. Rows are only ever inserted, so the history
stays trustworthy. Logging a lead touch also refreshes ``Lead.last_contact_at``
(the denormalised mirror the existing pipeline insights already read), so the
two readers never disagree.

Security posture mirrors every other router: workspace-scoped WHERE clauses
(unknown / foreign ids 404 rather than leak), Pydantic whitelists, verified
bearer token required.
"""

from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_authenticated_user
from app.core.database import get_db
from app.core.workspace import get_or_create_user_workspace
from app.models.client import Client
from app.models.interaction import Interaction
from app.models.lead import Lead
from app.schemas.domain import InteractionCreate, InteractionOut

router = APIRouter(prefix="/interactions", tags=["Interactions (touch history)"])


async def _person_exists(db: AsyncSession, workspace_id: str, person_type: str, person_id: str) -> bool:
    """A touch may only point at a lead/client that lives in this workspace."""
    model = Lead if person_type == "lead" else Client
    res = await db.execute(
        select(model.id).where(model.id == person_id, model.workspace_id == workspace_id)
    )
    return res.scalars().first() is not None


def _serialize(i: Interaction) -> Dict[str, Any]:
    return {
        "id": i.id,
        "workspace_id": i.workspace_id,
        "person_type": i.person_type,
        "person_id": i.person_id,
        "kind": i.kind,
        "direction": i.direction,
        "summary": i.summary,
        "occurred_at": i.occurred_at,
        "next_action_at": i.next_action_at,
        "created_at": i.created_at,
    }


@router.post("", response_model=InteractionOut, status_code=status.HTTP_201_CREATED)
async def create_interaction(
    payload: InteractionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    if not await _person_exists(db, workspace.id, payload.person_type, payload.person_id):
        # Same 404 whether the id is foreign or nonexistent — never reveal which.
        raise HTTPException(status_code=404, detail="Person not found in current workspace")

    occurred_at = payload.occurred_at or datetime.utcnow()
    interaction = Interaction(
        workspace_id=workspace.id,
        person_type=payload.person_type,
        person_id=payload.person_id,
        kind=payload.kind,
        direction=payload.direction,
        summary=payload.summary,
        occurred_at=occurred_at,
        next_action_at=payload.next_action_at,
    )
    db.add(interaction)

    # One write, two readers: keep the leads pipeline mirror honest.
    if payload.person_type == "lead":
        lead = (await db.execute(
            select(Lead).where(Lead.id == payload.person_id, Lead.workspace_id == workspace.id)
        )).scalar_one_or_none()
        if lead is not None:
            if lead.first_contact_at is None:
                lead.first_contact_at = occurred_at
            if lead.last_contact_at is None or occurred_at > lead.last_contact_at:
                lead.last_contact_at = occurred_at

    await db.commit()
    await db.refresh(interaction)
    return _serialize(interaction)


@router.get("", response_model=List[InteractionOut])
async def list_interactions(
    person_type: str,
    person_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """The touch feed for one lead/client, newest first (C2 timeline)."""
    if person_type not in ("lead", "client"):
        raise HTTPException(status_code=422, detail="person_type must be lead or client")
    _, workspace = await get_or_create_user_workspace(db, current_user)
    if not await _person_exists(db, workspace.id, person_type, person_id):
        raise HTTPException(status_code=404, detail="Person not found in current workspace")

    limit = max(1, min(limit, 200))  # bounded scan, never an unbounded fetch
    res = await db.execute(
        select(Interaction)
        .where(
            Interaction.workspace_id == workspace.id,
            Interaction.person_type == person_type,
            Interaction.person_id == person_id,
        )
        .order_by(Interaction.occurred_at.desc())
        .limit(limit)
    )
    return [_serialize(i) for i in res.scalars().all()]


@router.get("/summary", response_model=Dict[str, Any])
async def interaction_summary(
    person_type: str,
    person_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Cheap derived numbers the cards show without pulling the whole feed:
    total touches, last touch date and the live "days silent" churn signal."""
    if person_type not in ("lead", "client"):
        raise HTTPException(status_code=422, detail="person_type must be lead or client")
    _, workspace = await get_or_create_user_workspace(db, current_user)
    if not await _person_exists(db, workspace.id, person_type, person_id):
        raise HTTPException(status_code=404, detail="Person not found in current workspace")

    rows = (await db.execute(
        select(Interaction.occurred_at, Interaction.next_action_at).where(
            Interaction.workspace_id == workspace.id,
            Interaction.person_type == person_type,
            Interaction.person_id == person_id,
        )
    )).all()

    now = datetime.utcnow()
    occurrences = [r[0] for r in rows if r[0]]
    last_touch = max(occurrences) if occurrences else None
    upcoming = [r[1] for r in rows if r[1] and r[1] >= now]
    next_action = min(upcoming) if upcoming else None
    return {
        "person_type": person_type,
        "person_id": person_id,
        "touch_count": len(rows),
        "last_touch_at": last_touch.isoformat() if last_touch else None,
        "days_since_last_touch": (now - last_touch).days if last_touch else None,
        "next_action_at": next_action.isoformat() if next_action else None,
    }
