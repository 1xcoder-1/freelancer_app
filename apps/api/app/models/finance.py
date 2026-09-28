from sqlalchemy import String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.models.base import Base, TimestampMixin

class TimerSession(Base, TimestampMixin):
    """A live stopwatch run, persisted so tracking survives a refresh, a closed
    tab or a different device.

    The server clock owns the duration: elapsed time is derived from
    `started_at`/`paused_at`, never from what the browser remembered. Stopping
    a session writes exactly one TimeEntry and marks the session ended.
    """
    __tablename__ = "timer_sessions"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(500), nullable=True)
    is_billable: Mapped[bool] = mapped_column(Boolean, default=True)
    is_running: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    # Set while paused: elapsed seconds up to this instant stay frozen in
    # `accumulated_seconds` and the live clock stops counting.
    paused_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    accumulated_seconds: Mapped[int] = mapped_column(default=0)
    ended_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

class TimeEntry(Base, TimestampMixin):
    __tablename__ = "time_entries"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    duration_seconds: Mapped[int] = mapped_column(default=0)
    hourly_rate: Mapped[float] = mapped_column(Float, default=0.0)
    is_billable: Mapped[bool] = mapped_column(Boolean, default=True)
    is_invoiced: Mapped[bool] = mapped_column(Boolean, default=False)

class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_number: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="draft")  # draft, sent, paid, overdue
    issue_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    due_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    # Real money-in timestamp, set by the status endpoint when an invoice moves
    # to "paid". Cash-flow analytics fall back to updated_at for rows paid
    # before this column existed (COALESCE in the queries).
    paid_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    items: Mapped[list["InvoiceItem"]] = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")

class InvoiceItem(Base, TimestampMixin):
    __tablename__ = "invoice_items"

    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=1.0)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)
    amount: Mapped[float] = mapped_column(Float, default=0.0)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="items")

class Expense(Base, TimestampMixin):
    __tablename__ = "expenses"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    category: Mapped[str] = mapped_column(String(100), default="General")
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    receipt_cloudinary_url: Mapped[str] = mapped_column(String(512), nullable=True)
