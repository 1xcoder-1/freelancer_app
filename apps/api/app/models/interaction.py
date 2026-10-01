from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


class Interaction(Base, TimestampMixin):
    """One append-only touch on a lead or a client (call / email / meeting /
    message / note).

    A single table powers several features across two pages: the client
    "Touchpoints" feed, lead first-reply/response-speed metrics, churn-risk
    "days since touch", and the per-card "X days silent" chip. Rows are only
    ever inserted (never edited in place), so the history stays trustworthy.

    workspace_id + person_type + person_id scope the row; the composite index
    makes "latest N touches for this person" a single indexed seek rather than a
    scan. `Lead.last_contact_at` remains a denormalised mirror updated by the
    same write path so the two readers (leads list, insights) never disagree.
    """
    __tablename__ = "interactions"

    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    # 'lead' or 'client' — a polymorphic pointer, never a FK both ways.
    person_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    person_id: Mapped[str] = mapped_column(String(36), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), default="note", nullable=False)
    direction: Mapped[str] = mapped_column(String(20), default="outbound", nullable=False)
    summary: Mapped[str] = mapped_column(String(2000), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    next_action_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_interactions_person", "person_type", "person_id", "occurred_at"),
    )
