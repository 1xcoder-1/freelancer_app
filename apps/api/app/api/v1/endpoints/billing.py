"""Billing API — serves the pricing matrix and the plan state this app enforces.

Four routes:

* GET  /billing/plans  — the matrix itself (public). The marketing pricing page
  and the home page render from this, so a price or limit can only ever be
  changed in apps/api/config/pricing.json.
* GET  /billing/me     — the signed-in user's tier, live usage and remaining
  headroom, computed server-side (the billing page and every dashboard meter
  read this).
* PUT  /billing/sync   — the Next.js server writes the tier it just read from
  Clerk Billing. Requires BILLING_SYNC_SECRET; a browser holding only a Clerk
  token cannot call it, so nobody can grant themselves a paid tier.
* POST /billing/webhook — Clerk's subscription webhooks (same secret), optional
  but recommended: it keeps past-due/cancelled accounts honest even when the
  user is not in the app.
"""

import secrets
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_authenticated_user
from app.core.config import settings
from app.core.database import get_db
from app.core.plans import (
    PLAN_ORDER,
    PRICING_PUBLIC_PAYLOAD,
    plan_for,
)
from app.core.quota import invalidate_tier_cache, plan_context, usage_snapshot
from app.core.workspace import get_or_create_user_workspace
from app.models.user_plan import UserPlan
from app.schemas.types import UTCDatetime

router = APIRouter(prefix="/billing", tags=["Billing"])


# ---------------------------------------------------------------------------
# Clerk fee -> tier. Clerk's plan names are merchant-edited, the fee is not, so
# the fee is the stable key. Prices come from pricing.json (never hardcoded).
# ---------------------------------------------------------------------------
def tier_from_monthly_fee(amount_in_cents: Optional[int]) -> str:
    if not amount_in_cents or amount_in_cents <= 0:
        return PLAN_ORDER[0]
    # Highest priced plan whose fee is at or below what Clerk charged: a plan
    # renamed or re-priced slightly still resolves to the tier it pays for.
    match = PLAN_ORDER[0]
    for key in PLAN_ORDER:
        if plan_for(key).price * 100 <= amount_in_cents:
            match = key
    return match


class PlanSyncIn(BaseModel):
    clerk_id: str = Field(..., min_length=3, max_length=128)
    tier: Optional[str] = None
    status: Optional[str] = Field(None, max_length=32)
    plan_name: Optional[str] = Field(None, max_length=80)
    amount_cents: Optional[int] = None
    currency: Optional[str] = Field(None, max_length=10)
    period_start: Optional[UTCDatetime] = None
    period_end: Optional[UTCDatetime] = None
    # 'clerk_sync' | 'clerk_webhook' | 'owner' — shown on the billing page when a
    # tier looks stale.
    source: str = Field("clerk_sync", max_length=24)


class PlanSyncOut(BaseModel):
    clerk_id: str
    tier: str
    status: Optional[str]
    changed: bool


def _require_sync_secret(x_sync_secret: Optional[str]) -> None:
    """Constant-time compare against BILLING_SYNC_SECRET.

    Unset secret = endpoint disabled (fails closed to Free) rather than open,
    so a missing .env line can never become a way to mint paid tiers.
    """
    expected = settings.BILLING_SYNC_SECRET
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing sync is not configured on this server (BILLING_SYNC_SECRET).",
        )
    if not x_sync_secret or not secrets.compare_digest(x_sync_secret.encode(), expected.encode()):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid billing sync secret.")


async def _apply_sync(db: AsyncSession, payload: PlanSyncIn) -> PlanSyncOut:
    tier = payload.tier if payload.tier in PLAN_ORDER else tier_from_monthly_fee(payload.amount_cents)

    row = (
        await db.execute(select(UserPlan).where(UserPlan.clerk_id == payload.clerk_id))
    ).scalar_one_or_none()
    changed = row is None or row.tier != tier or row.status != payload.status

    if row is None:
        row = UserPlan(clerk_id=payload.clerk_id)
        db.add(row)

    row.tier = tier
    row.status = payload.status
    row.source = payload.source
    row.plan_name = payload.plan_name
    row.amount_cents = payload.amount_cents
    row.currency = payload.currency
    row.period_start = payload.period_start.replace(tzinfo=None) if payload.period_start and payload.period_start.tzinfo else payload.period_start
    row.period_end = payload.period_end.replace(tzinfo=None) if payload.period_end and payload.period_end.tzinfo else payload.period_end
    row.synced_at = datetime.utcnow()

    try:
        await db.commit()
    except IntegrityError:
        # Concurrent sync for the same clerk_id won the unique index; the row
        # it wrote is equally valid, so just drop this attempt.
        await db.rollback()
        changed = False

    invalidate_tier_cache(payload.clerk_id)
    return PlanSyncOut(
        clerk_id=payload.clerk_id, tier=tier, status=payload.status, changed=changed
    )


# ---------------------------------------------------------------------------
# Public matrix
# ---------------------------------------------------------------------------
@router.get("/plans", include_in_schema=False)
async def get_plans() -> Dict[str, Any]:
    """The pricing matrix. Public because the marketing page renders it before
    anyone signs in; it contains no user data, only plan definitions."""
    return PRICING_PUBLIC_PAYLOAD


# ---------------------------------------------------------------------------
# Current user's plan + live usage
# ---------------------------------------------------------------------------
@router.get("/me")
async def get_my_plan(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
) -> Dict[str, Any]:
    _, workspace = await get_or_create_user_workspace(db, current_user)
    ctx = await plan_context(db, current_user)
    snapshot = await usage_snapshot(db, ctx, workspace.id)

    row = (
        await db.execute(select(UserPlan).where(UserPlan.clerk_id == ctx.clerk_id))
    ).scalar_one_or_none()
    snapshot["subscription"] = None if row is None else {
        "plan_name": row.plan_name,
        "amount_cents": row.amount_cents,
        "currency": row.currency,
        "period_start": row.period_start,
        "period_end": row.period_end,
        "source": row.source,
        "synced_at": row.synced_at,
    }
    snapshot["sync_configured"] = bool(settings.BILLING_SYNC_SECRET)
    return snapshot


# ---------------------------------------------------------------------------
# Writes (server-to-server only)
# ---------------------------------------------------------------------------
@router.put("/sync", response_model=PlanSyncOut)
async def sync_plan(
    payload: PlanSyncIn,
    db: AsyncSession = Depends(get_db),
    x_sync_secret: Optional[str] = Header(None, alias="x-billing-sync-secret"),
) -> PlanSyncOut:
    _require_sync_secret(x_sync_secret)
    return await _apply_sync(db, payload)


class ClerkWebhookIn(BaseModel):
    type: str = Field(..., max_length=80)
    data: Dict[str, Any] = Field(default_factory=dict)


@router.post("/webhook", response_model=PlanSyncOut)
async def clerk_webhook(
    payload: ClerkWebhookIn,
    db: AsyncSession = Depends(get_db),
    x_sync_secret: Optional[str] = Header(None, alias="x-billing-sync-secret"),
) -> PlanSyncOut:
    """Forward a signature-verified Clerk event (verification happens in the
    Next.js route, which owns the Clerk SDK) and store the resulting tier.

    Tolerant by design: an unknown event type is acknowledged and ignored rather
    than 400'd, because Clerk renames billing events during its beta and a
    rejected hook would be retried as a failing delivery forever.
    """
    _require_sync_secret(x_sync_secret)

    event = payload.type.lower()
    data = payload.data or {}
    clerk_id = _payer_user_id(data)
    if not clerk_id:
        return PlanSyncOut(clerk_id="", tier=PLAN_ORDER[0], status=None, changed=False)

    canceled = any(k in event for k in ("canceled", "cancelled", "deleted"))
    past_due = "payment_failed" in event or "past_due" in event
    status_value = _subscription_status(data, canceled=canceled, past_due=past_due, event=event)
    plan = data.get("plan") or {}
    fee = (plan.get("fee") or {}).get("amount")

    return await _apply_sync(
        db,
        PlanSyncIn(
            clerk_id=clerk_id,
            status=status_value,
            plan_name=plan.get("name"),
            amount_cents=fee if isinstance(fee, int) else None,
            currency=(plan.get("fee") or {}).get("currency_amount") or data.get("currency"),
            period_start=_parse_dt(data.get("current_period_start") or data.get("start_date")),
            period_end=_parse_dt(data.get("current_period_end") or data.get("end_date")),
            source="clerk_webhook",
        ),
    )


def _payer_user_id(data: Dict[str, Any]) -> Optional[str]:
    if (data.get("payer_type") or "user") != "user":
        return None
    for key in ("payer_id", "user_id", "subscriber_id"):
        value = data.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def _subscription_status(data: Dict[str, Any], *, canceled: bool, past_due: bool, event: str) -> Optional[str]:
    if canceled:
        return "canceled"
    if past_due:
        return "past_due"
    reported = data.get("status")
    if isinstance(reported, str) and reported:
        return reported
    return "active" if any(k in event for k in ("created", "updated", "succeeded")) else None


def _parse_dt(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    if isinstance(value, (int, float)):
        return datetime.utcfromtimestamp(value / 1000 if value > 1e11 else value)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return None
    return None
