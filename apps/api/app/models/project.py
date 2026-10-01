import uuid
from sqlalchemy import String, Text, Float, Boolean, DateTime, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
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

    start_date: Mapped[datetime] = mapped_column(Date, nullable=True)
    due_date: Mapped[datetime] = mapped_column(Date, nullable=True, index=True)
    share_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, default=generate_share_token)

    portal_recipient_email: Mapped[str] = mapped_column(String(255), nullable=True)

    milestones: Mapped[list["Milestone"]] = relationship("Milestone", back_populates="project", cascade="all, delete-orphan")
    tasks: Mapped[list["Task"]] = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    contracts: Mapped[list["Contract"]] = relationship("Contract", back_populates="project", cascade="all, delete-orphan")
    change_requests: Mapped[list["ChangeRequest"]] = relationship("ChangeRequest", back_populates="project", cascade="all, delete-orphan")
    files: Mapped[list["ProjectFile"]] = relationship("ProjectFile", back_populates="project", cascade="all, delete-orphan")

class Milestone(Base, TimestampMixin):
    __tablename__ = "milestones"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    deliverable_note: Mapped[str] = mapped_column(Text, nullable=True)

    due_date: Mapped[datetime] = mapped_column(Date, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    approved_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="milestones")

class Task(Base, TimestampMixin):
    __tablename__ = "tasks"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="todo")  # todo, in_progress, review, done
    priority: Mapped[str] = mapped_column(String(50), default="medium")  # low, medium, high, urgent
    estimated_hours: Mapped[float] = mapped_column(Float, default=0.0)
    # Task due date (P4): a flat checklist cannot tell you what today's work is.
    # Indexed on (project_id, due_date) in the migration for the Today view.
    due_date: Mapped[datetime] = mapped_column(Date, nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="tasks")
    comments: Mapped[list["TaskComment"]] = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")

class TaskComment(Base, TimestampMixin):
    __tablename__ = "task_comments"

    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    task: Mapped["Task"] = relationship("Task", back_populates="comments")


class ChangeRequest(Base, TimestampMixin):
    """A priced, auditable scope change on a project (P3).

    "One more small thing" is the #1 freelance profit killer and there was no
    mechanism to price or record it. A change request carries a price and an
    impact in days; the client approves or declines from the public portal with
    a decision timestamp, so scope creep becomes a signed, billable event
    instead of free work. workspace_id is denormalised for the one-column tenant
    guard used everywhere else."""
    __tablename__ = "change_requests"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    impact_days: Mapped[int] = mapped_column(default=0, nullable=False)
    # requested / approved / rejected / implemented
    status: Mapped[str] = mapped_column(String(20), default="requested", nullable=False, index=True)
    requested_by: Mapped[str] = mapped_column(String(255), nullable=True)
    decided_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    decision_note: Mapped[str] = mapped_column(Text, nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="change_requests")


class ProjectFile(Base, TimestampMixin):
    """A Cloudinary or storage document belonging to a project: briefs, specs,
    assets, deliverables. Stored securely with sandboxed workspace isolation."""
    __tablename__ = "project_files"

    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    file_key: Mapped[str] = mapped_column(String(512), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=True)
    size_bytes: Mapped[int] = mapped_column(default=0, nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="document", nullable=False)

    project: Mapped["Project"] = relationship("Project", back_populates="files")
