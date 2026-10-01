from sqlalchemy import String, Text, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import uuid
from app.models.base import Base, TimestampMixin


def generate_token():
    return uuid.uuid4().hex

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
    # Which invoice billed these hours (V6). Without this link the hours a
    # deleted invoice had stamped stay `is_invoiced=True` forever and vanish
    # from "unbilled time". Recording the owning invoice lets a delete reset
    # exactly the right rows so the hours become billable again.
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True, index=True)

class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    # Owning project (V1/V6): lets unbilled hours be re-billed from the right
    # project and gives the project page its own invoice list instead of
    # filtering by client_id (which leaked a sibling project's invoices).
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
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

    # Public payment link (V1): a token the client opens at /pay/{token} so we
    # never expose the internal invoice id. Unique + indexed like every other
    # share token in the app.
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, default=generate_token)
    # Late fees (V2): per-invoice toggle, defaulted from the client profile.
    late_fee_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Reminder sequence (V4): a list of day offsets relative to due_date the
    # freelancer controls, replacing the hard-coded 4-day grace. reminders_sent
    # records which steps already fired (dedupe + a "what was chased" history).
    remind_days: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    reminders_sent: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    # Recurring invoices (V3): the cron creates the next one on schedule.
    recurrence: Mapped[str] = mapped_column(String(20), nullable=True)
    active_until: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    items: Mapped[list["InvoiceItem"]] = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    payments: Mapped[list["InvoicePayment"]] = relationship("InvoicePayment", back_populates="invoice", cascade="all, delete-orphan")

class InvoicePayment(Base, TimestampMixin):
    """A single (possibly partial) payment recorded against an invoice (V1).

    Payment is not lump-sum in real freelance life — clients pay in instalments
    and by different methods. Summing these rows is the truth of what actually
    landed, and the status derives `paid` when the sum reaches the total. The
    public /pay/ route appends a row here; it never trusts a client-supplied
    invoice id."""
    __tablename__ = "invoice_payments"

    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    method: Mapped[str] = mapped_column(String(50), default="bank_transfer", nullable=False)
    reference: Mapped[str] = mapped_column(String(255), nullable=True)
    note: Mapped[str] = mapped_column(Text, nullable=True)
    paid_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="payments")

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
    # Subscriptions (Netflix of work tools): flagged once, then grouped on the
    # Expenses ▸ Subscriptions page so the monthly total is always visible.
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
