import uuid
from datetime import datetime
from sqlalchemy import String, Text, Float, Integer, Boolean, DateTime, ForeignKey
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

    appointments: Mapped[list["BookingAppointment"]] = relationship("BookingAppointment", back_populates="consultation", cascade="all, delete-orphan")


class BookingAppointment(Base, TimestampMixin):
    __tablename__ = "booking_appointments"

    consultation_id: Mapped[str] = mapped_column(ForeignKey("booking_consultations.id", ondelete="CASCADE"), nullable=False, index=True)
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_email: Mapped[str] = mapped_column(String(255), nullable=False)
    appointment_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    meeting_link: Mapped[str] = mapped_column(String(512), nullable=True)
    payment_status: Mapped[str] = mapped_column(String(50), default="unpaid")  # paid, free, unpaid
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    consultation: Mapped["BookingConsultation"] = relationship("BookingConsultation", back_populates="appointments")
