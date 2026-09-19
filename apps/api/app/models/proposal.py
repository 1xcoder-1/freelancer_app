import uuid
from datetime import datetime
from sqlalchemy import String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

def generate_token():
    return uuid.uuid4().hex

class Proposal(Base, TimestampMixin):
    __tablename__ = "proposals"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    client_scope: Mapped[str] = mapped_column(Text, nullable=False)
    budget: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(50), default="sent")  # draft, sent, accepted, declined
    pitch_content: Mapped[str] = mapped_column(Text, nullable=False)

    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, default=generate_token)

    # Relationships
    client: Mapped["Client"] = relationship("Client")
