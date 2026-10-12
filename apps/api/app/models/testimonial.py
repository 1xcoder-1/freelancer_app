from datetime import datetime
from typing import Optional
from uuid import uuid4
from sqlalchemy import String, DateTime, Integer, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


def generate_token() -> str:
    return uuid4().hex


class Testimonial(Base, TimestampMixin):
    """A collected client testimonial and its public submit link.

    Flow: the freelancer creates a request row (optionally tied to a client),
    shares the token URL, and the client submits the quote without an account.
    The quote lands as ``pending``; approving it promotes it for display
    (public profile, marketing). The token is single-purpose and revocable by
    deleting the row — same posture as every other share token in the app.
    """
    __tablename__ = "testimonials"

    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    client_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    # Prefilled on the public form so the client edits rather than types.
    author_name: Mapped[str] = mapped_column(String(255), nullable=False)
    author_role: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # What the work was — shown next to the quote once approved.
    context_label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    quote: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # pending -> approved | rejected. Only approved quotes ever render publicly.
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, default=generate_token)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_testimonials_workspace_status", "workspace_id", "status"),
    )
