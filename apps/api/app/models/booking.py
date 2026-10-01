import uuid
from datetime import datetime
from sqlalchemy import String, Text, Float, Integer, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

def generate_token():
    return uuid.uuid4().hex

class BookingConsultation(Base, TimestampMixin):
    __tablename__ = "booking_consultations"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    price: Mapped[float] = mapped_column(Float, default=0.0)
    meeting_provider: Mapped[str] = mapped_column(String(50), default="google_meet")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, default=generate_token)

    # Real opening hours + booking guards (B1/B2). The consultation had a
    # duration but no availability window, so clients could book you at 2am on a
    # holiday, and nothing validated lead time or overlap. weekday_mask is a
    # 7-char '0'/'1' string (Mon..Sun); start/end_minute are the daily window in
    # the freelancer's timezone; the three lead/advance/buffer numbers bound what
    # a booking request may ask for.
    weekday_mask: Mapped[str] = mapped_column(String(7), default="1111100", nullable=False)
    start_minute: Mapped[int] = mapped_column(Integer, default=540, nullable=False)   # 09:00
    end_minute: Mapped[int] = mapped_column(Integer, default=1020, nullable=False)    # 17:00
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", nullable=False)
    min_lead_hours: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    max_advance_days: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    buffer_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    intake_form_id: Mapped[str] = mapped_column(ForeignKey("intake_forms.id", ondelete="SET NULL"), nullable=True)
    no_show_limit: Mapped[int] = mapped_column(Integer, default=2, nullable=False)

    appointments: Mapped[list["BookingAppointment"]] = relationship("BookingAppointment", back_populates="consultation", cascade="all, delete-orphan")


class BookingAppointment(Base, TimestampMixin):
    __tablename__ = "booking_appointments"

    consultation_id: Mapped[str] = mapped_column(ForeignKey("booking_consultations.id", ondelete="CASCADE"), nullable=False, index=True)
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_email: Mapped[str] = mapped_column(String(255), nullable=False)
    appointment_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    meeting_link: Mapped[str] = mapped_column(String(512), nullable=True)
    payment_status: Mapped[str] = mapped_column(String(50), default="unpaid")  # paid, free, unpaid
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    # Self-service status + reschedule (B3): an appointment-scoped token lets the
    # client reschedule/mark themselves without an email back-and-forth; the
    # status machine and no-show flag make cancellations trackable and billable.
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)  # pending/confirmed/cancelled/no_show/completed
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, default=generate_token)
    reschedule_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    no_show: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    cancelled_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    # Real paid consultation link (B4): a paid slot is not confirmed until an
    # Invoice + InvoicePayment actually land, replacing the old "paid because
    # price>0" fiction. client_id links a completed call's person to a Client.
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)

    consultation: Mapped["BookingConsultation"] = relationship("BookingConsultation", back_populates="appointments")


class BookingBlockedDay(Base, TimestampMixin):
    """A blackout day for a consultation (B2): "away this week" / holidays.
    The open-slot generator excludes these dates so a client can never book a
    day you are unavailable."""
    __tablename__ = "booking_blocked_days"

    consultation_id: Mapped[str] = mapped_column(ForeignKey("booking_consultations.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    date: Mapped[datetime] = mapped_column(Date, nullable=False)
