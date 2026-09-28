from sqlalchemy import String, Text, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

class User(Base, TimestampMixin):
    __tablename__ = "users"

    clerk_id: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str] = mapped_column(String(512), nullable=True)

    memberships: Mapped[list["Membership"]] = relationship("Membership", back_populates="user")

class Workspace(Base, TimestampMixin):
    """A freelancer's workspace.

    Besides identity/slug, this row is the single source of truth for the
    billing defaults the Settings page edits (currency, rate, invoice prefix,
    terms). They live here — not in browser storage — so every device, the
    invoice pipeline and the reminder emails see the same values.
    """
    __tablename__ = "workspaces"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="USD")

    # Business identity shown on client-facing surfaces
    business_name: Mapped[str] = mapped_column(String(255), nullable=True)
    professional_title: Mapped[str] = mapped_column(String(255), nullable=True)
    tax_id: Mapped[str] = mapped_column(String(80), nullable=True)

    # Billing defaults
    default_hourly_rate: Mapped[float] = mapped_column(Float, default=0.0)
    invoice_prefix: Mapped[str] = mapped_column(String(20), default="INV-")
    payment_terms: Mapped[str] = mapped_column(String(120), nullable=True)
    late_fee_policy: Mapped[str] = mapped_column(String(200), nullable=True)
    payment_notes: Mapped[str] = mapped_column(Text, nullable=True)

    memberships: Mapped[list["Membership"]] = relationship("Membership", back_populates="workspace")

class Membership(Base, TimestampMixin):
    __tablename__ = "memberships"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="owner")  # owner, admin, member

    user: Mapped["User"] = relationship("User", back_populates="memberships")
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="memberships")
