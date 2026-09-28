from datetime import datetime
from sqlalchemy import String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


# Stage → win-probability weights used by pipeline insights and the cash-flow
# forecast. Kept next to the model so both endpoints share one source of truth.
LEAD_STAGES = ("new", "contacted", "proposal", "negotiation", "won", "lost")
STAGE_PROBABILITY = {
    "new": 0.10,
    "contacted": 0.25,
    "proposal": 0.50,
    "negotiation": 0.75,
    "won": 1.00,
    "lost": 0.00,
}


class Lead(Base, TimestampMixin):
    """A prospect in the acquisition pipeline — before someone becomes a Client.

    Surveys consistently rank landing clients as the #1 freelance pain point,
    so deals are tracked explicitly with a stage, an expected value, a
    last-touch date and a follow-up date (stale opportunities are the silent
    revenue killer this table exists to surface).
    """
    __tablename__ = "leads"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str] = mapped_column(String(255), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=True)
    source: Mapped[str] = mapped_column(String(100), default="Referral")
    stage: Mapped[str] = mapped_column(String(50), default="new", index=True)
    estimated_value: Mapped[float] = mapped_column(Float, default=0.0)
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    # Funnelling "always be following up" into data: the two dates that let us
    # flag stale deals and due follow-ups without a CRM mental load.
    last_contact_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    next_follow_up_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
