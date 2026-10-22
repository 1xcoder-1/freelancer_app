from datetime import datetime

from sqlalchemy import DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class UserPlan(Base, TimestampMixin):
    """The subscription tier this API enforces, keyed by Clerk user id.

    Clerk Billing owns the payment; this row is the app's local mirror, written
    by the Clerk webhook (POST /billing/webhook) and reconciled by the web BFF
    on every plan read (PUT /billing/plan). Enforcement must read a local row
    because a per-request round trip to Clerk would add ~250 ms to every
    mutation and make caps unenforceable when Clerk is briefly unreachable.

    Owner accounts (OWNER_EMAILS) never need a row: app.core.plans.resolve_tier
    maps them straight to the top tier.
    """

    __tablename__ = "user_plans"

    clerk_id: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    tier: Mapped[str] = mapped_column(String(16), default="free", nullable=False)
    # Clerk subscription status: active, past_due, canceled, trialing, incomplete…
    status: Mapped[str] = mapped_column(String(32), nullable=True)
    # What wrote this row last, so the billing page can explain a stale tier.
    source: Mapped[str] = mapped_column(String(24), default="sync", nullable=False)
    plan_name: Mapped[str] = mapped_column(String(80), nullable=True)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=True)
    currency: Mapped[str] = mapped_column(String(10), nullable=True)
    # Current billing period anchors both the "renews on" display and the
    # monthly meters (proposals / AI) when Clerk reports a period start.
    period_start: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    period_end: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class PlanUsage(Base, TimestampMixin):
    """Per-calendar-month meter for sold usage (proposals, Book AI questions).

    Counters live here instead of being counted from rows because a meter must
    keep burning after the item is deleted — otherwise deleting every proposal
    would refund the monthly allowance.
    """

    __tablename__ = "plan_usage"

    __table_args__ = (
        UniqueConstraint("clerk_id", "kind", "period", name="uq_plan_usage_clerk_kind_period"),
    )

    clerk_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    # 'YYYY-MM' in UTC; a new period starts at midnight UTC on the 1st.
    period: Mapped[str] = mapped_column(String(7), nullable=False)
    count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
