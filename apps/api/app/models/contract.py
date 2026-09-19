import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

def generate_token():
    return uuid.uuid4().hex

class Contract(Base, TimestampMixin):
    __tablename__ = "contracts"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="draft")  # draft, sent, viewed, signed, declined

    # Shareable secure token for public signing link
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, default=generate_token)

    # Recipient / Client info
    recipient_name: Mapped[str] = mapped_column(String(255), nullable=True)
    recipient_email: Mapped[str] = mapped_column(String(255), nullable=True)

    # Sender E-Sign
    sender_signature: Mapped[str] = mapped_column(Text, nullable=True)
    sender_signed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Read Receipts & Live Status Tracking
    viewed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    viewed_user_agent: Mapped[str] = mapped_column(String(512), nullable=True)
    viewed_ip: Mapped[str] = mapped_column(String(128), nullable=True)

    # Client Execution / Signature
    client_signature: Mapped[str] = mapped_column(Text, nullable=True)
    client_signed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    client_ip: Mapped[str] = mapped_column(String(128), nullable=True)
    client_user_agent: Mapped[str] = mapped_column(String(512), nullable=True)

    # File / Storage attachment link
    file_url: Mapped[str] = mapped_column(String(512), nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="contracts")
    client: Mapped["Client"] = relationship("Client")
