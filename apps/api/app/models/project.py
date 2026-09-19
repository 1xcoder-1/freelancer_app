import uuid
from sqlalchemy import String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

def generate_share_token():
    return uuid.uuid4().hex

class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="in_progress")  # planning, in_progress, completed, paused
    budget: Mapped[float] = mapped_column(Float, default=0.0)
    hourly_rate: Mapped[float] = mapped_column(Float, default=0.0)
    share_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, default=generate_share_token)

    milestones: Mapped[list["Milestone"]] = relationship("Milestone", back_populates="project", cascade="all, delete-orphan")
    tasks: Mapped[list["Task"]] = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    contracts: Mapped[list["Contract"]] = relationship("Contract", back_populates="project", cascade="all, delete-orphan")

class Milestone(Base, TimestampMixin):
    __tablename__ = "milestones"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    deliverable_note: Mapped[str] = mapped_column(Text, nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="milestones")

class Task(Base, TimestampMixin):
    __tablename__ = "tasks"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="todo")  # todo, in_progress, review, done
    priority: Mapped[str] = mapped_column(String(50), default="medium")  # low, medium, high, urgent
    estimated_hours: Mapped[float] = mapped_column(Float, default=0.0)

    project: Mapped["Project"] = relationship("Project", back_populates="tasks")
    comments: Mapped[list["TaskComment"]] = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")

class TaskComment(Base, TimestampMixin):
    __tablename__ = "task_comments"

    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    task: Mapped["Task"] = relationship("Task", back_populates="comments")
