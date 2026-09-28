from sqlalchemy import String, Integer, Boolean, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

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

    board: Mapped["PlannerBoard"] = relationship("PlannerBoard", back_populates="todos")
