from datetime import datetime
from sqlalchemy import String, DateTime, Boolean, Text, ForeignKey, Index, text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


class Notification(Base, TimestampMixin):
    """One in-app inbox row for the workspace owner.

    Event producers across the app (invoice status moves, public contract
    view/sign/decline, testimonial submissions) append here instead of only
    sending email, so the signals are visible inside the dashboard too. Rows
    are workspace-scoped, read-state is per row, and the composite index makes
    "unread count + latest N" a single indexed pass — the two things the inbox
    badge and panel ask for on every load.
    """
    __tablename__ = "notifications"

    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    # Dotted event name, e.g. 'invoice.paid', 'contract.signed' — lets the UI
    # pick an icon/color and lets producers stay stringly typed.
    kind: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=True)
    # In-app destination, e.g. '/dashboard/projects?tab=invoices' — the inbox
    # row navigates straight to the thing that happened.
    link: Mapped[str] = mapped_column(String(255), nullable=True)
    # Idempotency key for producers whose trigger is a STATE (not a transition),
    # e.g. 'task-due:<card_id>:task.overdue:<due_date>' from the hourly scan.
    # Task cards never flip status the way invoices do, so the scan would
    # re-alert every hour without this. One row per key (unique partial index
    # below); NULL for the classic one-shot producers, which stay unkeyed.
    dedupe_key: Mapped[str] = mapped_column(String(150), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, index=True,
    )

    __table_args__ = (
        Index("ix_notifications_workspace_read", "workspace_id", "is_read", "occurred_at"),
        # Partial unique: only keyed rows participate, so the classic producers
        # (dedupe_key NULL) are untouched by the constraint.
        Index(
            "ux_notifications_dedupe_key",
            "dedupe_key",
            unique=True,
            postgresql_where=text("dedupe_key IS NOT NULL"),
            sqlite_where=text("dedupe_key IS NOT NULL"),
        ),
    )
