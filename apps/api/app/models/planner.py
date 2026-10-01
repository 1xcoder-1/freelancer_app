from datetime import datetime
import uuid
from sqlalchemy import String, Integer, Boolean, Date, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


def generate_token():
    return uuid.uuid4().hex

class PlannerBoard(Base, TimestampMixin):
    """A single sketch board ("file") in the Planner — the todo list +
    Excalidraw-style drawing merged into one planning surface.

    A freelancer keeps several boards (one per project / idea), hence NO
    unique constraint on workspace_id. `elements`/`files` hold the raw
    Excalidraw scene exactly as the library emits it, so the board round-trips
    without a schema of its own. `revision` is a monotonic counter the clients
    poll: any canvas save bumps it, so every open tab/device can pull the
    newest scene (real-time sync) without re-downloading unchanged data.
    """
    __tablename__ = "planner_boards"

    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), default="Untitled board", nullable=False)
    revision: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    elements: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    files: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # Read-only share link (PL5): an anonymous viewer gets the scene + open
    # todos only, never edit rights; optional expiry caps how long a link lives.
    share_token: Mapped[str] = mapped_column(String(64), nullable=True, unique=True, index=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    todos: Mapped[list["PlannerTodo"]] = relationship(
        "PlannerTodo", back_populates="board", cascade="all, delete-orphan"
    )

class PlannerTodo(Base, TimestampMixin):
    """A todo on a board. Created from the list OR dropped onto the canvas as a
    labelled card; completing one strikes it through in the list.

    workspace_id is denormalised (besides board_id) so tenant isolation is a
    single WHERE column on the row itself — the same guard every other model
    uses — and never relies on the caller having loaded the board first.
    """
    __tablename__ = "planner_todos"

    board_id: Mapped[str] = mapped_column(
        ForeignKey("planner_boards.id", ondelete="CASCADE"), index=True, nullable=False,
    )
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False,
    )
    text: Mapped[str] = mapped_column(String(500), nullable=False)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Planning with a clock and an owner (PL1/PL2/PL3): a bare to-do cannot tell
    # you WHEN or FOR WHOM. due_date/priority/project_id make the board know
    # today's work and which project it serves; start_minute/duration make it a
    # timebox block on a day timeline; recurrence regenerates the next instance.
    due_date: Mapped[datetime] = mapped_column(Date, nullable=True, index=True)
    priority: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    recurrence: Mapped[str] = mapped_column(String(20), nullable=True)
    date: Mapped[datetime] = mapped_column(Date, nullable=True, index=True)
    start_minute: Mapped[int] = mapped_column(Integer, nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=True)

    board: Mapped["PlannerBoard"] = relationship("PlannerBoard", back_populates="todos")


class PlannerSnapshot(Base, TimestampMixin):
    """A once-per-day capture of a board's plan (PL4, time travel).

    The plan you sketched last week is otherwise unrecoverable, so you cannot
    review how the plan actually changed. At most one snapshot per board per day
    (unique constraint) keeps this cheap; a "Day 1…N" strip replays or restores
    a captured day."""
    __tablename__ = "planner_snapshots"

    board_id: Mapped[str] = mapped_column(
        ForeignKey("planner_boards.id", ondelete="CASCADE"), index=True, nullable=False,
    )
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False,
    )
    # YYYY-MM-DD capture key (one row per board per day).
    captured_on: Mapped[str] = mapped_column(String(10), nullable=False)
    revision: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    elements: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    files: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    __table_args__ = (
        UniqueConstraint("board_id", "captured_on", name="uq_planner_snapshot_board_day"),
    )
