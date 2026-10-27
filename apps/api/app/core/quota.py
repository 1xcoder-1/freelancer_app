"""Plan enforcement: capacity caps, sold-feature gates and monthly meters.

Every limit the marketing page advertises is enforced HERE, not in the browser.
The frontend meters are a convenience copy of these numbers; a direct API call
hits the same wall, which is what makes the pricing real rather than decorative.

Denials use HTTP 402 with a structured body so the web app can render the exact
upgrade card ("3 of 3 client cards used — Starter gives you 10") instead of a
generic error toast:

    {"code": "plan_limit_reached", "kind": "clients", "used": 3, "limit": 3,
     "tier": "free", "label": "client cards", "upgrade_to": "starter",
     "upgrade_href": "/pricing"}
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.plans import (
    DIMENSIONS,
    INSIGHT_MODULES,
    METERS,
    PLAN_ORDER,
    feature_allowed,
    insight_module_allowed,
    is_owner,
    limit_for,
    meter_for,
    normalize_tier,
    plan_for,
    resolve_tier,
)
from app.models.booking import BookingConsultation
from app.models.client import Client
from app.models.link_page import LinkPage
from app.models.project import Project
from app.models.report_card import ReportCard
from app.models.user_plan import PlanUsage, UserPlan
from app.models.workspace import User

# The checkout lives on the marketing pricing page (Clerk opens the payment
# drawer from there), so every upgrade CTA in a denial points back to it.
UPGRADE_HREF = "/pricing"

_HTTP_402 = status.HTTP_402_PAYMENT_REQUIRED


@dataclass(frozen=True)
class PlanContext:
    """The resolved plan for one request."""

    clerk_id: str
    email: str
    tier: str
    is_owner: bool
    status: Optional[str] = None

    @property
    def plan(self):
        return plan_for(self.tier)


# ---------------------------------------------------------------------------
# Tier resolution (cached: a cap check must not add a DB round trip to every
# mutation on top of the workspace lookup it already pays).
# ---------------------------------------------------------------------------
_TIER_CACHE: Dict[str, Tuple[float, str, Optional[str]]] = {}
_TIER_CACHE_TTL = 60.0
_TIER_CACHE_MAX = 2_000


def invalidate_tier_cache(clerk_id: Optional[str] = None) -> None:
    """Called after any write to user_plans so a paid upgrade takes effect on
    the very next request instead of up to TTL seconds later."""
    if clerk_id:
        _TIER_CACHE.pop(clerk_id, None)
    else:
        _TIER_CACHE.clear()


async def _stored_plan(db: AsyncSession, clerk_id: str) -> Tuple[str, Optional[str]]:
    now = datetime.utcnow().timestamp()
    cached = _TIER_CACHE.get(clerk_id)
    if cached and cached[0] > now:
        return cached[1], cached[2]

    row = (
        await db.execute(select(UserPlan).where(UserPlan.clerk_id == clerk_id))
    ).scalar_one_or_none()
    tier, sub_status = (row.tier if row else "free"), (row.status if row else None)
    if len(_TIER_CACHE) >= _TIER_CACHE_MAX:
        _TIER_CACHE.clear()
    _TIER_CACHE[clerk_id] = (now + _TIER_CACHE_TTL, tier, sub_status)
    return tier, sub_status


async def plan_context(
    db: AsyncSession, current_user: Dict[str, Any]
) -> PlanContext:
    """Resolve the caller's tier: owner accounts and dev sessions get the plan
    they are configured for, everyone else is bound by their subscription
    record."""
    clerk_id = current_user.get("user_id") or "user_demo"
    email = (current_user.get("email") or "").strip().lower()

    if current_user.get("dev_mode"):
        # DEV_TIER is what lets a local run or the test suite exercise the
        # locked plans without a Clerk subscription; owners still win so the
        # founder's account keeps the full plan either way.
        tier = resolve_tier(email, normalize_tier(settings.DEV_TIER), clerk_id)
        return PlanContext(
            clerk_id=clerk_id,
            email=email,
            tier=tier,
            is_owner=is_owner(email, clerk_id),
            status="dev",
        )

    stored, sub_status = await _stored_plan(db, clerk_id)
    tier = resolve_tier(email, stored, clerk_id)
    return PlanContext(
        clerk_id=clerk_id,
        email=email,
        tier=tier,
        is_owner=is_owner(email, clerk_id),
        status=sub_status,
    )


def _denial(code: str, ctx: PlanContext, **extra: Any) -> HTTPException:
    paid = PLAN_ORDER[1:]
    idx = paid.index(ctx.tier) if ctx.tier in paid else -1
    upgrade_to = paid[idx + 1] if idx + 1 < len(paid) else None
    body = {
        "code": code,
        "tier": ctx.tier,
        "upgrade_to": upgrade_to,
        "upgrade_href": UPGRADE_HREF,
        **extra,
    }
    return HTTPException(status_code=_HTTP_402, detail=body)


# ---------------------------------------------------------------------------
# Capacity caps (total rows in the workspace)
# ---------------------------------------------------------------------------
_COUNT_QUERY = {
    "clients": lambda ws_id: select(func.count(Client.id)).where(Client.workspace_id == ws_id),
    "projects": lambda ws_id: select(func.count(Project.id)).where(Project.workspace_id == ws_id),
    "services": lambda ws_id: select(func.count(BookingConsultation.id)).where(
        BookingConsultation.workspace_id == ws_id
    ),
    "link_pages": lambda ws_id: select(func.count(LinkPage.id)).where(LinkPage.workspace_id == ws_id),
}


async def enforce_capacity(
    db: AsyncSession,
    ctx: PlanContext,
    kind: str,
    *,
    workspace_id: str,
    used: Optional[int] = None,
) -> int:
    """Raise 402 when the workspace has no room left for one more row.

    `used` lets a caller that already loaded the list skip the COUNT query;
    the "portfolios" dimension counts across workspaces via clerk_id (one
    report_cards row per account), so its endpoints pass `used` or rely on
    _portfolio_count.

    Owner accounts are exempt from capacity — not from meters. The difference is
    deliberate: a capacity number counts rows an account accumulated before any
    plan existed, so enforcing it would freeze the founder's own workspace out of
    its own data (111 real clients against a 50-client plan), while a meter
    counts this month's consumption and starts at zero for everyone.
    """
    if ctx.is_owner:
        return used if used is not None else await _count(db, kind, workspace_id)

    limit = limit_for(ctx.tier, kind)
    if used is None:
        used = await _count(db, kind, workspace_id)

    if used >= limit:
        meta = DIMENSIONS.get(kind, {})
        raise _denial(
            "plan_limit_reached",
            ctx,
            kind=kind,
            used=used,
            limit=limit,
            label=meta.get("label", kind),
        )
    return used


async def _count(db: AsyncSession, kind: str, workspace_id: str) -> int:
    builder = _COUNT_QUERY.get(kind)
    if builder is None:
        raise ValueError(f"capacity dimension '{kind}' needs an explicit used count")
    return int((await db.execute(builder(workspace_id))).scalar_one() or 0)


# ---------------------------------------------------------------------------
# Sold features (whole modules gated by tier, e.g. proposals, insights)
# ---------------------------------------------------------------------------
def enforce_feature(ctx: PlanContext, feature: str, *, label: Optional[str] = None) -> None:
    if not feature_allowed(ctx.tier, feature):
        raise _denial(
            "plan_feature_locked",
            ctx,
            kind=feature,
            label=label or feature,
            limit=0,
            used=0,
        )


def enforce_insight(ctx: PlanContext, module: str) -> None:
    """Insights are sold in two depths: Starter gets Reports, Growth and Pro get
    the whole section (testimonials + shared links included)."""
    if not feature_allowed(ctx.tier, "insights"):
        enforce_feature(ctx, "insights", label="Insights")
    if not insight_module_allowed(ctx.tier, module):
        raise _denial(
            "plan_feature_locked",
            ctx,
            kind=f"insights.{module}",
            label=INSIGHT_MODULES.get(module, module),
            limit=0,
            used=0,
        )


# ---------------------------------------------------------------------------
# Monthly meters (proposals sent, Book AI questions, …)
# ---------------------------------------------------------------------------
def _current_period(now: Optional[datetime] = None) -> str:
    return (now or datetime.utcnow()).strftime("%Y-%m")


async def meter_state(db: AsyncSession, ctx: PlanContext, kind: str) -> Tuple[int, int]:
    used = (
        await db.execute(
            select(PlanUsage.count).where(
                PlanUsage.clerk_id == ctx.clerk_id,
                PlanUsage.kind == kind,
                PlanUsage.period == _current_period(),
            )
        )
    ).scalar_one_or_none()
    return int(used or 0), meter_for(ctx.tier, kind)


async def enforce_meter(db: AsyncSession, ctx: PlanContext, kind: str) -> None:
    used, limit = await meter_state(db, ctx, kind)
    if used >= limit:
        meta = METERS.get(kind, {})
        raise _denial(
            "plan_meter_exhausted",
            ctx,
            kind=kind,
            used=used,
            limit=limit,
            label=meta.get("label", kind),
            period=_current_period(),
        )


async def bump_meter(db: AsyncSession, ctx: PlanContext, kind: str) -> None:
    """Record one consumed unit. Atomic UPDATE-then-INSERT so two concurrent
    asks can't both create the row (the unique index would raise) or lose one
    another's increment."""
    period = _current_period()
    res = await db.execute(
        select(PlanUsage).where(
            PlanUsage.clerk_id == ctx.clerk_id,
            PlanUsage.kind == kind,
            PlanUsage.period == period,
        )
    )
    row = res.scalar_one_or_none()
    if row:
        row.count = int(row.count or 0) + 1
        return
    try:
        async with db.begin_nested():
            db.add(PlanUsage(clerk_id=ctx.clerk_id, kind=kind, period=period, count=1))
            await db.flush()
    except IntegrityError:
        # Lost a race with an identical insert; increment the winner's row.
        existing = (
            await db.execute(
                select(PlanUsage).where(
                    PlanUsage.clerk_id == ctx.clerk_id,
                    PlanUsage.kind == kind,
                    PlanUsage.period == period,
                )
            )
        ).scalar_one()
        existing.count = int(existing.count or 0) + 1


# ---------------------------------------------------------------------------
# Live usage snapshot (billing page + dashboard meters)
# ---------------------------------------------------------------------------
async def _portfolio_count(db: AsyncSession, clerk_id: str) -> int:
    """One portfolio card per account on every plan — the report_cards row IS
    the portfolio, so the cap counts rows, not entries inside the JSON."""
    res = await db.execute(
        select(func.count(ReportCard.id))
        .join(User, ReportCard.user_id == User.id)
        .where(User.clerk_id == clerk_id)
    )
    return int(res.scalar_one() or 0)


async def usage_snapshot(
    db: AsyncSession, ctx: PlanContext, workspace_id: str
) -> Dict[str, Any]:
    plan = ctx.plan
    capacities: Dict[str, Dict[str, Any]] = {}
    for kind in plan.limits:
        used = (
            await _count(db, kind, workspace_id)
            if kind in _COUNT_QUERY
            else await _portfolio_count(db, ctx.clerk_id)
        )
        # An owner's meter says "unlimited" rather than "111 / 50", because the
        # cap is exempted above and a red over-limit bar would be a lie.
        capacities[kind] = {
            "used": used,
            "limit": None if ctx.is_owner else plan.limits[kind],
            "unlimited": bool(ctx.is_owner),
            "label": DIMENSIONS.get(kind, {}).get("label", kind),
            "href": DIMENSIONS.get(kind, {}).get("href"),
        }

    meters: Dict[str, Dict[str, Any]] = {}
    rows = (
        await db.execute(
            select(PlanUsage.kind, PlanUsage.count).where(
                PlanUsage.clerk_id == ctx.clerk_id,
                PlanUsage.period == _current_period(),
            )
        )
    ).all()
    used_by_kind = {k: int(c or 0) for k, c in rows}
    for kind in plan.meters:
        meters[kind] = {
            "used": used_by_kind.get(kind, 0),
            "limit": plan.meters[kind],
            "label": METERS.get(kind, {}).get("label", kind),
            "href": METERS.get(kind, {}).get("href"),
        }

    return {
        "tier": ctx.tier,
        "plan": plan.name,
        "price": plan.price,
        "status": ctx.status,
        "is_owner": ctx.is_owner,
        "period": _current_period(),
        "capacities": capacities,
        "meters": meters,
        "features": dict(plan.features),
        "rate": {
            "reads_per_min": plan.rate.reads_per_min,
            "writes_per_min": plan.rate.writes_per_min,
            "ai_per_min": plan.rate.ai_per_min,
        },
    }
