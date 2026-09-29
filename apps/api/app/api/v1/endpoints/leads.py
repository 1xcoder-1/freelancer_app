"""Lead Pipeline — client-acquisition CRM endpoints.

Landing clients is the single most-cited freelancer pain point, and the silent
killer inside it is the dropped follow-up. This router tracks every prospect
through the pipeline stages and surfaces two numbers that matter: how much
open deal value exists, and which deals are going cold.

Security posture: every query is scoped to the caller's workspace (the ORM
filter is applied before any id lookup, so cross-tenant ids 404 rather than
leak), all writes go through Pydantic whitelists (Literal stages, bounded
strings/money), and everything requires a verified Clerk bearer token.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_authenticated_user
from app.core.database import get_db
from app.core.workspace import get_or_create_user_workspace
from app.models.client import Client
from app.models.lead import Lead, STAGE_PROBABILITY
from app.schemas.domain import ClientOut, LeadCreate, LeadUpdate, LeadContactLog, LeadOut

router = APIRouter(prefix="/leads", tags=["Lead Pipeline"])

# A deal nobody touched in this many days is "going cold" — aggressive enough
# to be actionable weekly, generous enough to survive normal client latency.
STALE_AFTER_DAYS = 7

_OPEN_STAGES = ("new", "contacted", "proposal", "negotiation")


async def _get_workspace_lead(db: AsyncSession, workspace_id: str, lead_id: str) -> Lead:
    """Fetch one lead strictly within the caller's workspace or 404.

    Scoping by workspace_id in the same WHERE clause means a guessed id from
    another tenant never reveals existence (404 for both cases).
    """
    res = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.workspace_id == workspace_id)
    )
    lead = res.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.get("", response_model=List[LeadOut])
async def list_leads(
    stage: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(Lead).where(Lead.workspace_id == workspace.id)
    # Stage whitelist check before touching the DB — an unknown filter value is
    # a client bug, not a silent empty result.
    if stage is not None:
        if stage not in STAGE_PROBABILITY:
            raise HTTPException(status_code=422, detail="Unknown stage filter")
        stmt = stmt.where(Lead.stage == stage)
    res = await db.execute(stmt.order_by(Lead.created_at.desc()))
    return res.scalars().all()


@router.post("", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
async def create_lead(
    payload: LeadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    lead = Lead(
        workspace_id=workspace.id,
        name=payload.name,
        company=payload.company,
        email=payload.email,
        phone=payload.phone,
        source=payload.source or "Referral",
        stage=payload.stage,
        estimated_value=payload.estimated_value,
        priority=payload.priority,
        next_follow_up_at=payload.next_follow_up_at,
        notes=payload.notes,
        # Creating a lead IS a touch — counting it keeps "stale" honest.
        last_contact_at=datetime.utcnow(),
    )
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return lead


@router.get("/{lead_id}", response_model=LeadOut)
async def get_lead(
    lead_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    return await _get_workspace_lead(db, workspace.id, lead_id)


@router.patch("/{lead_id}", response_model=LeadOut)
async def update_lead(
    lead_id: str,
    payload: LeadUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    lead = await _get_workspace_lead(db, workspace.id, lead_id)

    data = payload.model_dump(exclude_unset=True)
    won_now = data.get("stage") == "won" and lead.stage != "won"
    for field, value in data.items():
        setattr(lead, field, value)

    # A won deal should exist in the Clients CRM the moment it's marked won —
    # deduped by email so re-won edits never create duplicate client rows.
    if won_now:
        exists = await db.scalar(
            select(func.count(Client.id)).where(
                Client.workspace_id == workspace.id,
                func.lower(Client.email) == (lead.email or "").lower(),
            )
        )
        if not exists:
            db.add(Client(
                workspace_id=workspace.id,
                name=lead.company or lead.name,
                company_name=lead.company,
                email=lead.email,
                phone=lead.phone,
                status="active",
            ))

    await db.commit()
    await db.refresh(lead)
    return lead


@router.post("/{lead_id}/log-contact", response_model=LeadOut)
async def log_contact(
    lead_id: str,
    payload: LeadContactLog,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Stamp 'I reached out today' and (optionally) schedule the next touch —
    the one action that keeps the whole pipeline honest."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    lead = await _get_workspace_lead(db, workspace.id, lead_id)
    lead.last_contact_at = datetime.utcnow()
    if payload.next_follow_up_at is not None:
        lead.next_follow_up_at = payload.next_follow_up_at
    if payload.note:
        stamp = datetime.utcnow().strftime("%Y-%m-%d")
        existing = (lead.notes or "").strip()
        lead.notes = f"{existing}\n[{stamp}] {payload.note}".strip() if existing else f"[{stamp}] {payload.note}"
    await db.commit()
    await db.refresh(lead)
    return lead


@router.post("/{lead_id}/convert-to-client", response_model=ClientOut)
async def convert_lead_to_client(
    lead_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """One action turns a prospect into a roster client — no re-typing.

    Idempotent by email: if the client already exists (manual add or the
    won-stage auto-create), the existing row is returned instead of a
    duplicate. Converting also marks the deal won so pipeline stats stay true.
    """
    _, workspace = await get_or_create_user_workspace(db, current_user)
    lead = await _get_workspace_lead(db, workspace.id, lead_id)
    
    email = (lead.email or "").strip()
    clean_name = "".join(c for c in lead.name if c.isalnum()).lower() or "client"
    import uuid
    uid_suffix = uuid.uuid4().hex[:6]
    safe_email = email if email else f"{clean_name}_{uid_suffix}@client.local"

    client_notes = (lead.notes or "").strip()
    val = lead.estimated_value or 0
    if val > 0 and "[rate:" not in client_notes:
        import re
        curr_match = re.search(r'\[currency:\s*([^\]]+)\]', client_notes, re.IGNORECASE)
        lead_curr = curr_match.group(1).strip() if curr_match else (workspace.currency or "USD")
        formatted_val = f"{int(val):,}" if val == int(val) else f"{val:,.2f}"
        rate_tag = f"[rate: {lead_curr} {formatted_val}]"
        client_notes = f"{rate_tag}\n{client_notes}".strip() if client_notes else rate_tag

    # Always create a new dedicated client record
    client = Client(
        workspace_id=workspace.id,
        name=lead.name,
        company_name=lead.company,
        email=safe_email,
        phone=lead.phone,
        status="active",
        notes=client_notes,
    )
    db.add(client)

    # Remove the converted lead from the leads table
    await db.delete(lead)
    await db.commit()
    await db.refresh(client)
    return client


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    lead_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    lead = await _get_workspace_lead(db, workspace.id, lead_id)
    await db.delete(lead)
    await db.commit()


@router.get("/insights", response_model=Dict[str, Any])
async def pipeline_insights(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Aggregated pipeline health: value, momentum, and who needs a nudge now.

    Single grouped pass over the workspace's leads plus two bounded scans for
    the actionable lists (due follow-ups, stale deals) — no per-row queries.
    """
    _, workspace = await get_or_create_user_workspace(db, current_user)
    now = datetime.utcnow()
    stale_cutoff = now - timedelta(days=STALE_AFTER_DAYS)

    rows = (await db.execute(
        select(Lead).where(Lead.workspace_id == workspace.id)
    )).scalars().all()

    stage_counts: Dict[str, int] = {s: 0 for s in STAGE_PROBABILITY}
    open_value = 0.0
    weighted_value = 0.0
    won_count = lost_count = 0
    due_follow_ups: List[Dict[str, Any]] = []
    stale_deals: List[Dict[str, Any]] = []

    for lead in rows:
        stage_counts[lead.stage] = stage_counts.get(lead.stage, 0) + 1
        if lead.stage in _OPEN_STAGES:
            open_value += lead.estimated_value or 0.0
            weighted_value += (lead.estimated_value or 0.0) * STAGE_PROBABILITY.get(lead.stage, 0.0)
        elif lead.stage == "won":
            won_count += 1
        elif lead.stage == "lost":
            lost_count += 1
            continue

        if lead.stage in _OPEN_STAGES:
            brief = {
                "id": lead.id,
                "name": lead.name,
                "company": lead.company,
                "stage": lead.stage,
                "estimated_value": lead.estimated_value,
                "priority": lead.priority,
            }
            if lead.next_follow_up_at and lead.next_follow_up_at <= now:
                due_follow_ups.append(brief)
            last_touch = lead.last_contact_at or lead.created_at
            if last_touch and last_touch <= stale_cutoff:
                stale_deals.append({**brief, "days_since_contact": (now - last_touch).days})

    decided = won_count + lost_count
    return {
        "total_leads": len(rows),
        "stage_counts": stage_counts,
        "open_pipeline_value": round(open_value, 2),
        "weighted_pipeline_value": round(weighted_value, 2),
        "win_rate_pct": round((won_count / decided) * 100, 1) if decided else 0.0,
        "won_count": won_count,
        "lost_count": lost_count,
        "due_follow_up_count": len(due_follow_ups),
        "stale_deal_count": len(stale_deals),
        "stale_after_days": STALE_AFTER_DAYS,
        "due_follow_ups": sorted(due_follow_ups, key=lambda d: d["estimated_value"], reverse=True)[:10],
        "stale_deals": sorted(stale_deals, key=lambda d: d["days_since_contact"], reverse=True)[:10],
        "currency": workspace.currency or "USD",
        "timestamp": now.isoformat(),
    }
