from datetime import datetime
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


class CalendarEvent(Base, TimestampMixin):
    """Unified calendar event stored in the real DB.

    `source` decides provenance:
      - local:  created by the user from the dashboard calendar (meetings,
                client work blocks, personal events, deadlines)
      - google: mirrored from a connected Google Calendar by the sync job
    Booking appointments stay in their own table and are merged live into
    the calendar feed, so meetings booked by clients always show up.
    """
    __tablename__ = "calendar_events"
    __table_args__ = (
        Index("ix_calendar_events_ws_start", "workspace_id", "start_time"),
    )

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    # meeting | client_work | deadline | personal
    event_type: Mapped[str] = mapped_column(String(32), default="meeting")
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    is_all_day: Mapped[bool] = mapped_column(Boolean, default=False)

    # Optional links to business records for context on the event chip
    client_name: Mapped[str] = mapped_column(String(255), nullable=True)
    project_id: Mapped[str] = mapped_column(String(36), nullable=True)
    meeting_link: Mapped[str] = mapped_column(String(512), nullable=True)

    source: Mapped[str] = mapped_column(String(16), default="local", index=True)
    # Google sync bookkeeping (unique per google event so syncs upsert)
    google_event_id: Mapped[str] = mapped_column(String(255), nullable=True, unique=True, index=True)
    google_calendar_id: Mapped[str] = mapped_column(String(255), nullable=True)
    # Soft-deleted when the event disappears from Google (kept for audit)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)


class GoogleCalendarConnection(Base, TimestampMixin):
    """One row per workspace that connected their Google Calendar (optional)."""
    __tablename__ = "google_calendar_connections"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)

    google_email: Mapped[str] = mapped_column(String(255), nullable=True)
    refresh_token: Mapped[str] = mapped_column(Text, nullable=True)
    access_token: Mapped[str] = mapped_column(Text, nullable=True)
    access_token_expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # CSRF state for the OAuth redirect round-trip
    oauth_state: Mapped[str] = mapped_column(String(128), nullable=True)

    sync_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_synced_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
