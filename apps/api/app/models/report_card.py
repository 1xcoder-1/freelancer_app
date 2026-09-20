from sqlalchemy import String, Integer, BigInteger, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin

class ReportCard(Base, TimestampMixin):
    """
    Per-user editable report card, persisted in Neon (PostgreSQL JSON column).

    `content` holds the owner-written document (bio paragraphs, "Things I Do",
    "Companies I've Worked With", "Work With Me", "Writing") and `settings`
    holds appearance preferences (font, accent colour). Both start EMPTY for a
    new user — no seeded demo data; the owner writes their own content or
    installs the empty structure via the frontend editor.

    Share state (token + expiry) lives here too so public links survive
    server restarts, unlike the old in-memory implementation.
    """
    __tablename__ = "report_cards"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    username: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)

    content: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    settings: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # Public share state
    share_token: Mapped[str] = mapped_column(String(64), nullable=True)
    is_shared: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # 0/1
    expiration: Mapped[str] = mapped_column(String(16), default="never", nullable=False)
    expires_at_ms: Mapped[int] = mapped_column(BigInteger, nullable=True)  # Unix ms (needs BIGINT: ms epoch exceeds int4)
    include_styling: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    views_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
