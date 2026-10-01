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
from statistics import median
import re
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_authenticated_user
from app.core.database import get_db
from app.core.inngest_client import emit
from app.core.workspace import get_or_create_user_workspace
from app.models.client import Client
from app.models.contract import Contract
from app.models.finance import Invoice, InvoiceItem
from app.models.interaction import Interaction
from app.models.lead import Lead, STAGE_PROBABILITY
from app.models.project import Project
from app.models.proposal import Proposal
from app.schemas.domain import (
    ClientOut,
    LeadCreate,
    LeadUpdate,
    LeadClose,
    LeadContactLog,
    LeadOut,
    StartWorkRequest,
    StartOutcome,
)

router = APIRouter(prefix="/leads", tags=["Lead Pipeline"])

# A deal nobody touched in this many days is "going cold" — aggressive enough
# to be actionable weekly, generous enough to survive normal client latency.
STALE_AFTER_DAYS = 7

_OPEN_STAGES = ("new", "contacted", "proposal", "negotiation")

# Minimal starting body for an F3 contract draft — a placeholder the freelancer
# edits, never a fabricated signed agreement.
_DEFAULT_CONTRACT_DRAFT = (
    "Scope of work, deliverables, timeline, and payment terms to be finalized "
    "for this engagement."
)


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
        # First touch never moves (L5): the baseline hours-to-first-reply is
        # measured against. last_contact_at advances on every touch; this doesn't.
        first_contact_at=datetime.utcnow(),
    )
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return lead


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
    for field, value in data.items():
        setattr(lead, field, value)

    # SE8: won/lost can no longer arrive through this generic PATCH, so the
    # email-deduped client auto-create moved to POST /leads/{id}/close. A stray
    # stage edit can no longer silently spawn a roster row.
    await db.commit()
    await db.refresh(lead)
    return lead


@router.post("/{lead_id}/close", response_model=LeadOut)
async def close_lead(
    lead_id: str,
    payload: LeadClose,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """The only sanctioned path to a terminal stage (SE8 / L3).

    ``won`` creates (or reuses, email-deduped) the roster client in the same
    transaction; ``lost`` records a structured reason so the 'lost by reason'
    analytics stay honest and a pricing problem reads differently from a
    pipeline problem.
    """
    _, workspace = await get_or_create_user_workspace(db, current_user)
    lead = await _get_workspace_lead(db, workspace.id, lead_id)

    if payload.outcome == "lost":
        # A loss without a reason is the exact blind spot L3 exists to close.
        if not payload.reason:
            raise HTTPException(status_code=422, detail="A lost deal requires a reason")
        lead.stage = "lost"
        lead.reason_lost = payload.reason
        lead.reason_lost_note = payload.note
    else:  # won
        lead.stage = "won"
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


async def _uplift_client_fields(lead: Lead, workspace) -> Dict[str, Any]:
    """Build the roster-client fields from a lead (shared by convert + start-work).

    The estimated deal value is carried into the note as a ``[rate: …]`` tag only
    when the lead doesn't already have one, so a follow-on quote has a starting
    number without inventing data the freelancer never entered."""
    email = (lead.email or "").strip()
    clean_name = "".join(c for c in lead.name if c.isalnum()).lower() or "client"
    safe_email = email if email else f"{clean_name}_{uuid.uuid4().hex[:6]}@client.local"

    client_notes = (lead.notes or "").strip()
    val = lead.estimated_value or 0
    if val > 0 and "[rate:" not in client_notes:
        curr_match = re.search(r"\[currency:\s*([^\]]+)\]", client_notes, re.IGNORECASE)
        lead_curr = curr_match.group(1).strip() if curr_match else (workspace.currency or "USD")
        formatted_val = f"{int(val):,}" if val == int(val) else f"{val:,.2f}"
        rate_tag = f"[rate: {lead_curr} {formatted_val}]"
        client_notes = f"{rate_tag}\n{client_notes}".strip() if client_notes else rate_tag

    return {
        "name": lead.name,
        "company_name": lead.company,
        "email": safe_email,
        "phone": lead.phone,
        "status": "active",
        "notes": client_notes,
    }


async def _existing_client_by_email(db: AsyncSession, workspace_id: str, email: str) -> Optional[Client]:
    if not email:
        return None
    res = await db.execute(
        select(Client).where(
            Client.workspace_id == workspace_id,
            func.lower(Client.email) == email.lower(),
        )
    )
    return res.scalars().first()


@router.post("/{lead_id}/convert-to-client", response_model=ClientOut)
async def convert_lead_to_client(
    lead_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """One action turns a prospect into a roster client — no re-typing.

    Idempotent by email: if the client already exists (manual add or the
    won-stage auto-create), the existing row is returned instead of a duplicate.
    The lead is kept and flipped to ``won`` — deleting it (as this used to do)
    erased the pipeline history the win-rate and source analytics depend on.
    """
    _, workspace = await get_or_create_user_workspace(db, current_user)
    lead = await _get_workspace_lead(db, workspace.id, lead_id)

    fields = await _uplift_client_fields(lead, workspace)
    existing = await _existing_client_by_email(db, workspace.id, fields["email"])
    if existing is not None:
        client = existing
    else:
        client = Client(workspace_id=workspace.id, **fields)
        db.add(client)

    lead.stage = "won"
    await db.commit()
    await db.refresh(client)
    return client


@router.post("/{lead_id}/start-work", response_model=StartOutcome, status_code=status.HTTP_201_CREATED)
async def start_work(
    lead_id: str,
    payload: StartWorkRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """F3 — the winning-a-deal cascade (L2).

    Winning used to mean re-typing the same person across three pages, and the
    old convert action deleted the lead. This creates the client (email-deduped),
    a project that inherits the lead's estimated value as budget and hourly rate,
    and — only when asked for — a contract draft, a first invoice, and a standing
    retainer. It is one transaction (all-or-nothing), then emits so the usual
    reminder/scan jobs pick the new rows up."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    lead = await _get_workspace_lead(db, workspace.id, lead_id)

    fields = await _uplift_client_fields(lead, workspace)
    existing = await _existing_client_by_email(db, workspace.id, fields["email"])
    reused = existing is not None
    client = existing if reused else Client(workspace_id=workspace.id, **fields)
    if not reused:
        db.add(client)
        await db.flush()  # assign client.id for the rows that reference it

    project = Project(
        workspace_id=workspace.id,
        client_id=client.id,
        title=payload.project_title or f"{lead.name} — engagement",
        description=(lead.notes or None),
        status="in_progress",
        budget=lead.estimated_value or 0.0,
        hourly_rate=lead.estimated_value or 0.0,
    )
    db.add(project)
    await db.flush()

    contract_id = None
    if payload.create_contract:
        contract = Contract(
            workspace_id=workspace.id,
            project_id=project.id,
            client_id=client.id,
            title=payload.contract_title or f"Agreement — {client.name}",
            content=payload.contract_content or _DEFAULT_CONTRACT_DRAFT,
            status="draft",
            recipient_name=client.name,
            recipient_email=client.email,
        )
        db.add(contract)
        await db.flush()
        contract_id = contract.id

    invoice_id = None
    inv_amount = payload.invoice_amount if payload.invoice_amount is not None else (lead.estimated_value or 0.0)
    if payload.create_invoice and inv_amount and inv_amount > 0:
        number = f"LEAD-{lead.id[:6].upper()}-{datetime.utcnow().strftime('%Y%m')}"
        invoice = Invoice(
            workspace_id=workspace.id,
            client_id=client.id,
            project_id=project.id,
            invoice_number=number,
            status="draft",
            due_date=datetime.utcnow() + timedelta(days=14),
            total_amount=inv_amount,
            notes="First invoice created from a won lead.",
            items=[InvoiceItem(
                description=f"{project.title} — initial work",
                quantity=1,
                unit_price=inv_amount,
                amount=inv_amount,
            )],
        )
        db.add(invoice)
        await db.flush()
        invoice_id = invoice.id

    lead.stage = "won"
    await db.commit()

    # commit-then-emit: a paid first invoice joins the reminder flow.
    if invoice_id:
        await emit("invoice.sent", {
            "invoice_id": invoice_id,
            "amount": inv_amount,
            "client_email": client.email,
        })

    return StartOutcome(
        lead_id=lead.id,
        client_id=client.id,
        reused_client=reused,
        project_id=project.id,
        contract_id=contract_id,
        invoice_id=invoice_id,
    )


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

    Declared before ``/{lead_id}`` (see note above) so the literal path resolves
    here instead of being swallowed as a lead id. Single grouped pass over the
    workspace's leads plus two bounded scans for the actionable lists (due
    follow-ups, stale deals) — no per-row queries.
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
    # L3 loss analytics: structured reasons are countable, free text is not.
    lost_by_reason: Dict[str, int] = {}
    lost_values: List[float] = []
    # L5/L6 per-lead accumulators computed in this single pass.
    days_to_close: List[float] = []
    source_revenue: Dict[str, Dict[str, float]] = {}

    for lead in rows:
        stage_counts[lead.stage] = stage_counts.get(lead.stage, 0) + 1
        if lead.stage in _OPEN_STAGES:
            open_value += lead.estimated_value or 0.0
            weighted_value += (lead.estimated_value or 0.0) * STAGE_PROBABILITY.get(lead.stage, 0.0)
        elif lead.stage == "won":
            won_count += 1
            # L6: which channel actually produces revenue, not just volume.
            src = lead.source or "Unknown"
            bucket = source_revenue.setdefault(src, {"won_value": 0.0, "won_count": 0})
            bucket["won_value"] += lead.estimated_value or 0.0
            bucket["won_count"] += 1
            if lead.created_at:
                days_to_close.append((lead.updated_at - lead.created_at).total_seconds() / 86400.0)
        elif lead.stage == "lost":
            lost_count += 1
            if lead.reason_lost:
                lost_by_reason[lead.reason_lost] = lost_by_reason.get(lead.reason_lost, 0) + 1
            lost_values.append(lead.estimated_value or 0.0)
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

    # L5: hours from lead creation to the first logged touch (F2 Interaction),
    # one grouped scan rather than a query per lead.
    first_touch_rows = (await db.execute(
        select(Interaction.person_id, func.min(Interaction.occurred_at))
        .where(Interaction.workspace_id == workspace.id, Interaction.person_type == "lead")
        .group_by(Interaction.person_id)
    )).all()
    created_by_id = {lead.id: lead.created_at for lead in rows}
    hours_to_first_reply: List[float] = []
    for lead_id, first in first_touch_rows:
        created = created_by_id.get(lead_id)
        if created and first and first >= created:
            hours_to_first_reply.append((first - created).total_seconds() / 3600.0)

    # L1: one live "next up" queue merging the three things that each already
    # existed as a separate count — due follow-ups, stale deals, and proposals
    # still awaiting a reply — ranked by the money at stake.
    proposals_awaiting = (await db.execute(
        select(Proposal).where(
            Proposal.workspace_id == workspace.id,
            Proposal.status == "sent",
        )
    )).scalars().all()

    next_up: List[Dict[str, Any]] = []
    for l in due_follow_ups:
        next_up.append({**l, "type": "follow_up", "why": "Follow-up due", "value": l["estimated_value"] or 0.0})
    for l in stale_deals:
        next_up.append({**l, "type": "stale", "why": f"{l['days_since_contact']} days silent", "value": l["estimated_value"] or 0.0})
    for p in proposals_awaiting:
        next_up.append({
            "id": p.id, "name": p.title, "company": None, "stage": "proposal",
            "type": "proposal_reply", "why": "Awaiting client reply",
            "value": p.budget or 0.0, "estimated_value": p.budget,
            "expires_at": p.expires_at.isoformat() if p.expires_at else None,
        })
    next_up.sort(key=lambda d: d["value"], reverse=True)

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
        # L1 the actionable queue, L3 loss analytics, L5 speed, L6 source value.
        "next_up": next_up[:15],
        "lost_by_reason": lost_by_reason,
        "median_lost_deal_size": round(median(lost_values), 2) if lost_values else 0.0,
        "response_speed": {
            "median_hours_to_first_reply": round(median(hours_to_first_reply), 1) if hours_to_first_reply else None,
            "median_days_to_close": round(median(days_to_close), 1) if days_to_close else None,
            "measured_leads": len(hours_to_first_reply),
        },
        "source_revenue": [
            {"source": s, "won_value": round(v["won_value"], 2), "won_count": int(v["won_count"])}
            for s, v in sorted(source_revenue.items(), key=lambda kv: kv[1]["won_value"], reverse=True)
        ],
        "currency": workspace.currency or "USD",
        "timestamp": now.isoformat(),
    }


# Kept after /insights so the literal path is matched first; FastAPI resolves
# routes in registration order, so a dynamic /{lead_id} ahead of /insights would
# have swallowed "insights" as an id (the historical 404 this avoids).
@router.get("/{lead_id}", response_model=LeadOut)
async def get_lead(
    lead_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    return await _get_workspace_lead(db, workspace.id, lead_id)
