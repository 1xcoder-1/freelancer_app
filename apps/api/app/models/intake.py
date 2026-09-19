import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

def generate_token():
    return uuid.uuid4().hex

class IntakeForm(Base, TimestampMixin):
    __tablename__ = "intake_forms"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    questions_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")  # JSON string of question list
    status: Mapped[str] = mapped_column(String(50), default="active")

    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, default=generate_token)

    submissions: Mapped[list["IntakeSubmission"]] = relationship("IntakeSubmission", back_populates="form", cascade="all, delete-orphan")


class IntakeSubmission(Base, TimestampMixin):
    __tablename__ = "intake_submissions"

    form_id: Mapped[str] = mapped_column(ForeignKey("intake_forms.id", ondelete="CASCADE"), nullable=False, index=True)
    client_name: Mapped[str] = mapped_column(String(255), nullable=True)
    client_email: Mapped[str] = mapped_column(String(255), nullable=True)
    answers_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")  # JSON string of answers

    form: Mapped["IntakeForm"] = relationship("IntakeForm", back_populates="submissions")
