from sqlalchemy import String, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin

class UserProfile(Base, TimestampMixin):
    """The owner's editable profile document, persisted as one JSON blob.

    Mirrors the tabbed settings editor: personal info, professional details
    (job-portal style targets: LPA, notice period, work type) and the four
    list sections (experiences, certifications, education, projects). The
    structure is validated by Pydantic schemas in the profile endpoint before
    it lands here.

    Identity (name, avatar, email) intentionally lives in Clerk only — the
    frontend edits those through the Clerk client so every surface (sidebar,
    dropdown) updates in real time without a second source of truth.
    """
    __tablename__ = "user_profiles"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    content: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
