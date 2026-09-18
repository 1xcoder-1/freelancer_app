from sqlalchemy import String, Text, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

class Client(Base, TimestampMixin):
    __tablename__ = "clients"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=True)
    website: Mapped[str] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active")  # lead, active, archived
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    health_score: Mapped[float] = mapped_column(Float, default=100.0)

    contacts: Mapped[list["ClientContact"]] = relationship("ClientContact", back_populates="client", cascade="all, delete-orphan")

class ClientContact(Base, TimestampMixin):
    __tablename__ = "client_contacts"

    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=True)
    role: Mapped[str] = mapped_column(String(100), nullable=True)

    client: Mapped["Client"] = relationship("Client", back_populates="contacts")
