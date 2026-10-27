from sqlalchemy import Boolean, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class LinkPage(Base, TimestampMixin):
    """A Linktree-style public profile page: one per workspace up to the plan's
    link-page cap.

    The page owns a short handle (slug) that strangers open at /p/{slug},
    a ordered list of LinkItems, and lifetime counters. Publishing is an
    explicit flag — an unpublished page must be invisible publicly (404,
    never a "private" hint)."""
    __tablename__ = "link_pages"

    # The workspace row is the tenant guard used by every other table; how many
    # pages a workspace may hold is the plan's link_pages limit, enforced in the
    # endpoint (app.core.quota) rather than with a database constraint.
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # Owner-facing card title ("Work", "Personal") — display_name stays what
    # visitors see on the public page.
    name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    # Lowercase handle (alnum + hyphen/dot, 2-64 chars — validated in the
    # endpoint). Globally unique because it addresses a public URL.
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    headline: Mapped[str] = mapped_column(String(200), nullable=True)
    bio: Mapped[str] = mapped_column(String(500), nullable=True)
    avatar_url: Mapped[str] = mapped_column(String(500), nullable=True)
    theme: Mapped[str] = mapped_column(String(32), default="default", nullable=False)
    template: Mapped[str] = mapped_column(String(32), default="paper", nullable=False)
    # Optional cover photo (Cloudinary) behind the page; overlay is the scrim
    # opacity (0.0-1.0) that keeps text readable on busy photos.
    background_image_url: Mapped[str] = mapped_column(String(500), nullable=True)
    background_overlay: Mapped[float] = mapped_column(Float, nullable=True)
    published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Lifetime page views. Analytics windows read link_events; this counter
    # is the cheap badge the page itself shows.
    views_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    items: Mapped[list["LinkItem"]] = relationship(
        "LinkItem", back_populates="page", cascade="all, delete-orphan",
    )


class LinkItem(Base, TimestampMixin):
    """One button on a link page. Sort order is owned by the full-replace PUT,
    so the client always sends the complete ordered list."""
    __tablename__ = "link_items"

    page_id: Mapped[str] = mapped_column(
        ForeignKey("link_pages.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    icon: Mapped[str] = mapped_column(String(40), nullable=True)
    description: Mapped[str] = mapped_column(String(300), nullable=True)
    # Optional thumbnail image (Cloudinary) shown by the image-card templates.
    image_url: Mapped[str] = mapped_column(String(500), nullable=True)
    # 'link' | 'header' | 'divider' — replaces the isHeadingItem icon/url
    # guessing game; validated in the endpoint schema.
    item_type: Mapped[str] = mapped_column(String(16), default="link", nullable=False)
    # 'icon' forces the round social-icon row, 'card' forces a full-width card;
    # NULL lets the template auto-route (social platforms → icons).
    display: Mapped[str] = mapped_column(String(16), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Lifetime clicks on this item (the windowed stats come from link_events).
    clicks_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    page: Mapped["LinkPage"] = relationship("LinkPage", back_populates="items")


class LinkEvent(Base, TimestampMixin):
    """Append-only analytics stream: one row per page view or item click.

    item_id is NULL for page views. SET NULL on item delete keeps the click
    history even after the owning button is replaced; the stats breakdown
    labels those rows as removed items."""
    __tablename__ = "link_events"

    page_id: Mapped[str] = mapped_column(
        ForeignKey("link_pages.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    item_id: Mapped[str] = mapped_column(
        ForeignKey("link_items.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    # 'view' | 'click' — enforced in the endpoint schema, never free text.
    event_type: Mapped[str] = mapped_column(String(16), nullable=False)
    referrer: Mapped[str] = mapped_column(String(500), nullable=True)

    # The time-windowed stats queries all range on created_at, so it needs its
    # own index (TimestampMixin declares the column without one).
    __table_args__ = (
        Index("ix_link_events_created_at", "created_at"),
    )
