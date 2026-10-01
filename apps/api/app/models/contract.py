import uuid
from datetime import datetime
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey
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

    # Expiry + versioning (N2/N5). An open-ended sign link that stays valid
    # forever is not the deal you offered: expire_days seeds expires_at when the
    # contract is sent, a daily scan flips it to `expired`, and the public sign
    # route refuses an expired version. version/supersedes_id let a re-send
    # create v2 and mark v1 superseded so you can prove which terms were signed.
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    expire_days: Mapped[int] = mapped_column(default=30, nullable=False)
    version: Mapped[int] = mapped_column(default=1, nullable=False)
    supersedes_id: Mapped[str] = mapped_column(ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True)
    # Both-parties-executed timestamp (N6): stamped only when sender AND client
    # signatures are both present — never at creation, so "fully signed" is true.
    fully_executed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="contracts")
    client: Mapped["Client"] = relationship("Client")
    events: Mapped[list["ContractEvent"]] = relationship("ContractEvent", back_populates="contract", cascade="all, delete-orphan")


class ContractEvent(Base, TimestampMixin):
    """One immutable audit-trail entry on a contract (N1).

    A signature you cannot evidence is a signature you cannot defend. Every
    transition (sent / opened / signed / declined / reminded / expired) appends
    a row here with the actor IP + user agent, so the detail page shows a real
    timeline instead of the single (never-surfaced) viewed_ip column."""
    __tablename__ = "contract_events"

    contract_id: Mapped[str] = mapped_column(ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    event: Mapped[str] = mapped_column(String(40), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    actor_ip: Mapped[str] = mapped_column(String(128), nullable=True)
    actor_user_agent: Mapped[str] = mapped_column(String(512), nullable=True)
    note: Mapped[str] = mapped_column(Text, nullable=True)

    contract: Mapped["Contract"] = relationship("Contract", back_populates="events")


class ContractTemplate(Base, TimestampMixin):
    """A reusable contract body (N4). Writing terms from scratch is how
    freelancers end up with no late-fee clause at all; saving a contract as a
    template and starting new ones from it keeps the good clauses in play."""
    __tablename__ = "contract_templates"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="general", nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
