"""Task Management (Trello-style kanban) models.

Five tables mirror the board UI: a board holds ordered lists, lists hold
ordered cards, and cards hold subtasks + attachments. Ordering uses float
positions (max+1 on append, midpoint on insert) so a drag-and-drop never
rewrites the whole column; `task_boards.revision` is bumped on EVERY nested
mutation so open tabs/devices know to re-pull the full board payload.

`workspace_id` is denormalised onto every row (the same tenant guard every
other model uses), and `task_cards.board_id` is additionally denormalised so
per-board queries never join through `task_lists`.
"""
from datetime import datetime
import uuid

from sqlalchemy import (
    String, Integer, Boolean, Date, DateTime, ForeignKey, Text, Float, JSON, Index,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

# tags hold a plain list of strings: real JSONB on Neon/PostgreSQL, plain JSON
# on the SQLite dev database (JSONB is a Postgres-only type).
_JSONList = JSON().with_variant(JSONB(), "postgresql")


class TaskBoard(Base, TimestampMixin):
    """A kanban board. Created with three default lists ("Pending", "In
    Progress", "Done"); `background_url`/`background_kind` drive the board
    header art ('unsplash' photo or CSS 'gradient'). `revision` plays the same
    role as the planner's: any nested mutation bumps it so every open tab can
    cheaply poll /head and re-fetch /full only when it moved."""
    __tablename__ = "task_boards"

    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    background_url: Mapped[str] = mapped_column(Text, nullable=True)
    background_kind: Mapped[str] = mapped_column(String(20), nullable=True)  # 'unsplash' | 'gradient'
    revision: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    lists: Mapped[list["TaskList"]] = relationship(
        "TaskList", cascade="all, delete-orphan", order_by="TaskList.position",
    )


class TaskList(Base):
    """A column on a board ("Pending", "In Progress", ...). Position is a float
    so inserting between two lists never renumbers the rest."""
    __tablename__ = "task_lists"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()),
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    board_id: Mapped[str] = mapped_column(
        ForeignKey("task_boards.id", ondelete="CASCADE"), index=True, nullable=False,
    )
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    position: Mapped[float] = mapped_column(Float, nullable=False)

    cards: Mapped[list["TaskCard"]] = relationship(
        "TaskCard", cascade="all, delete-orphan", order_by="TaskCard.position",
    )


class TaskCard(Base, TimestampMixin):
    """A card on a list: the title, an optional description, a done flag,
    priority/due date, free-form tags and an optional link to a project
    (SET NULL on project delete) so the project detail page can list the work
    mapped to it. `board_id` is denormalised beside `list_id` for fast
    per-board reads and is kept consistent by the API (cards only ever move
    between lists of the SAME board)."""
    __tablename__ = "task_cards"

    board_id: Mapped[str] = mapped_column(
        ForeignKey("task_boards.id", ondelete="CASCADE"), index=True, nullable=False,
    )
    list_id: Mapped[str] = mapped_column(
        ForeignKey("task_lists.id", ondelete="CASCADE"), index=True, nullable=False,
    )
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    priority: Mapped[str] = mapped_column(String(20), nullable=True)  # low|medium|high|urgent
    due_date: Mapped[datetime] = mapped_column(Date, nullable=True)
    position: Mapped[float] = mapped_column(Float, nullable=False)
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    tags: Mapped[list] = mapped_column(_JSONList, default=list, nullable=False)

    subtasks: Mapped[list["TaskSubtask"]] = relationship(
        "TaskSubtask", cascade="all, delete-orphan", order_by="TaskSubtask.position",
    )
    attachments: Mapped[list["TaskAttachment"]] = relationship(
        "TaskAttachment", cascade="all, delete-orphan", order_by="TaskAttachment.created_at",
    )

    __table_args__ = (
        Index("ix_task_cards_list_position", "list_id", "position"),
        Index("ix_task_cards_workspace_project", "workspace_id", "project_id"),
    )


class TaskSubtask(Base):
    """A checklist line on a card. Small and immutable-by-position; the parent
    card's revision bump is what syncs the UI, so no updated_at is needed."""
    __tablename__ = "task_subtasks"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()),
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    card_id: Mapped[str] = mapped_column(
        ForeignKey("task_cards.id", ondelete="CASCADE"), index=True, nullable=False,
    )
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False,
    )
    text: Mapped[str] = mapped_column(String(500), nullable=False)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    position: Mapped[float] = mapped_column(Float, nullable=False)


class TaskAttachment(Base):
    """Metadata for a file or link pinned to a card. Binaries live in
    Cloudinary — the client uploads via the existing /storage endpoints first
    and stores the resulting public id in `file_key`; `url` is used directly
    for kind='link' attachments."""
    __tablename__ = "task_attachments"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()),
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    card_id: Mapped[str] = mapped_column(
        ForeignKey("task_cards.id", ondelete="CASCADE"), index=True, nullable=False,
    )
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False,
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # link | image | document
    url: Mapped[str] = mapped_column(Text, nullable=True)
    file_key: Mapped[str] = mapped_column(Text, nullable=True)  # Cloudinary public id
    file_name: Mapped[str] = mapped_column(String(300), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=True)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=True)
