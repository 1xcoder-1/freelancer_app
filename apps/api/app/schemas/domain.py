from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Any, Dict, Literal, Optional, List
from datetime import datetime
import json as _json

from app.schemas.types import UTCDatetime

# String length caps mirror the SQLAlchemy column widths: an over-long value
# used to sail past pydantic and blow up in the driver (a 500 + Sentry event).
# Money is bounded below at 0 (a negative expense/invoice line is data
# corruption, not a refund) and capped so Float columns stay sane.
_MAX_MONEY = 100_000_000.0

# ------------------------------------------------------------------------------
# Client Schemas
# ------------------------------------------------------------------------------
class ClientCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    company_name: Optional[str] = Field(None, max_length=255)
    email: str = Field(..., min_length=5, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    website: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = Field(None, max_length=20_000)
    status: Literal["lead", "active", "archived"] = "active"

class ClientOut(BaseModel):
    id: str
    workspace_id: str
    name: str
    company_name: Optional[str] = None
    email: str
    phone: Optional[str] = None
    website: Optional[str] = None
    status: str
    notes: Optional[str] = None
    health_score: float = 100.0
    created_at: datetime

    class Config:
        from_attributes = True

# ------------------------------------------------------------------------------
# Lead Pipeline Schemas
# ------------------------------------------------------------------------------
class LeadCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    company: Optional[str] = Field(None, max_length=255)
    email: str = Field(..., min_length=5, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    source: Optional[str] = Field(None, max_length=100)
    stage: Literal["new", "contacted", "proposal", "negotiation", "won", "lost"] = "new"
    estimated_value: float = Field(0.0, ge=0, le=_MAX_MONEY)
    priority: Literal["low", "medium", "high"] = "medium"
    next_follow_up_at: Optional[UTCDatetime] = None
    notes: Optional[str] = Field(None, max_length=20_000)

class LeadUpdate(BaseModel):
    """Every field is optional so the pipeline board can patch one cell."""
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    company: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, min_length=5, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    source: Optional[str] = Field(None, max_length=100)
    stage: Optional[Literal["new", "contacted", "proposal", "negotiation", "won", "lost"]] = None
    estimated_value: Optional[float] = Field(None, ge=0, le=_MAX_MONEY)
    priority: Optional[Literal["low", "medium", "high"]] = None
    next_follow_up_at: Optional[UTCDatetime] = None
    notes: Optional[str] = Field(None, max_length=20_000)

class LeadContactLog(BaseModel):
    """Body for POST /leads/{id}/log-contact — stamps the touch and optionally
    schedules the next one in the same action (never a bare timestamp update)."""
    note: Optional[str] = Field(None, max_length=10_000)
    next_follow_up_at: Optional[UTCDatetime] = None

class LeadOut(BaseModel):
    id: str
    workspace_id: str
    name: str
    company: Optional[str] = None
    email: str
    phone: Optional[str] = None
    source: Optional[str] = None
    stage: str
    estimated_value: float
    priority: str
    last_contact_at: Optional[datetime] = None
    next_follow_up_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ------------------------------------------------------------------------------
# Project, Milestone & Task Schemas
# ------------------------------------------------------------------------------
class MilestoneCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=10_000)
    amount: float = Field(0.0, ge=0, le=_MAX_MONEY)
    deliverable_note: Optional[str] = Field(None, max_length=10_000)

class MilestoneOut(BaseModel):
    id: str
    project_id: str
    title: str
    description: Optional[str] = None
    amount: float
    is_completed: bool
    deliverable_note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=10_000)
    priority: Literal["low", "medium", "high", "urgent"] = "medium"
    estimated_hours: float = Field(0.0, ge=0, le=10_000)

class TaskUpdate(BaseModel):
    """Every field is optional so the UI can patch a single kanban column."""
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=10_000)
    status: Optional[Literal["todo", "in_progress", "review", "done"]] = None
    priority: Optional[Literal["low", "medium", "high", "urgent"]] = None
    estimated_hours: Optional[float] = Field(None, ge=0, le=10_000)

class TaskOut(BaseModel):
    id: str
    project_id: str
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    estimated_hours: float
    created_at: datetime

    class Config:
        from_attributes = True

class MilestoneUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=10_000)
    amount: Optional[float] = Field(None, ge=0, le=_MAX_MONEY)
    is_completed: Optional[bool] = None
    deliverable_note: Optional[str] = Field(None, max_length=10_000)

class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    client_id: Optional[str] = Field(None, max_length=36)
    description: Optional[str] = Field(None, max_length=20_000)
    status: Literal["planning", "in_progress", "completed", "paused"] = "in_progress"
    budget: float = Field(0.0, ge=0, le=_MAX_MONEY)
    hourly_rate: float = Field(0.0, ge=0, le=100_000)

class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    client_id: Optional[str] = Field(None, max_length=36)
    description: Optional[str] = Field(None, max_length=20_000)
    status: Optional[Literal["planning", "in_progress", "completed", "paused"]] = None
    budget: Optional[float] = Field(None, ge=0, le=_MAX_MONEY)
    hourly_rate: Optional[float] = Field(None, ge=0, le=100_000)

class ProjectOut(BaseModel):
    id: str
    workspace_id: str
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: str
    budget: float
    hourly_rate: float
    share_token: str
    progress_pct: int = 0
    tracked_hours: float = 0.0
    tasks: List[TaskOut] = []
    milestones: List[MilestoneOut] = []
    created_at: datetime

    class Config:
        from_attributes = True

class PublicMilestoneOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    amount: float
    is_completed: bool
    deliverable_note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PublicProjectPortalOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: str
    budget: float
    share_token: str
    progress_pct: int
    freelancer_name: str
    client_name: Optional[str] = None
    milestones: List[PublicMilestoneOut] = []
    completed_milestones_count: int
    total_milestones_count: int
    active_tasks_count: int
    completed_tasks_count: int
    contract_status: Optional[str] = None
    contract_signed: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

# ------------------------------------------------------------------------------
# Invoice Schemas
# ------------------------------------------------------------------------------
class InvoiceItemCreate(BaseModel):
    description: str = Field(..., min_length=1, max_length=255)
    quantity: float = Field(1.0, ge=0, le=100_000)
    unit_price: float = Field(0.0, ge=0, le=_MAX_MONEY)

class InvoiceCreate(BaseModel):
    client_id: str = Field(..., min_length=1, max_length=36)
    invoice_number: str = Field(..., min_length=1, max_length=50)
    status: Literal["draft", "sent", "paid", "overdue"] = "sent"
    due_date: Optional[UTCDatetime] = None
    notes: Optional[str] = Field(None, max_length=10_000)
    items: List[InvoiceItemCreate] = Field(default_factory=list, max_length=200)

class InvoiceItemOut(BaseModel):
    id: str
    description: str
    quantity: float
    unit_price: float
    amount: float

    class Config:
        from_attributes = True

class InvoiceOut(BaseModel):
    id: str
    workspace_id: str
    client_id: str
    client_name: Optional[str] = None
    invoice_number: str
    status: str
    issue_date: datetime
    due_date: Optional[datetime] = None
    total_amount: float
    notes: Optional[str] = None
    paid_at: Optional[datetime] = None
    items: List[InvoiceItemOut] = []
    created_at: datetime

    class Config:
        from_attributes = True

class InvoiceStatusUpdate(BaseModel):
    """Whitelisted so `PATCH /invoices/{id}/status` cannot store an arbitrary
    string that no dashboard filter, reminder job or PDF renderer understands."""
    status: Literal["draft", "sent", "paid", "overdue"]

# ------------------------------------------------------------------------------
# Workspace (Settings page) Schemas
# ------------------------------------------------------------------------------
class WorkspaceUpdate(BaseModel):
    """Business profile + billing defaults, persisted on the workspace row.

    Only sent fields are applied (endpoints use `exclude_unset`), so the
    Settings page can save one tab without touching the others.
    """
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    business_name: Optional[str] = Field(None, max_length=255)
    professional_title: Optional[str] = Field(None, max_length=255)
    tax_id: Optional[str] = Field(None, max_length=80)
    currency: Optional[str] = Field(None, pattern="^[A-Z]{3,10}$")
    default_hourly_rate: Optional[float] = Field(None, ge=0, le=100_000)
    invoice_prefix: Optional[str] = Field(None, min_length=1, max_length=20)
    payment_terms: Optional[str] = Field(None, max_length=120)
    late_fee_policy: Optional[str] = Field(None, max_length=200)
    payment_notes: Optional[str] = Field(None, max_length=10_000)

class WorkspaceOut(BaseModel):
    id: str
    name: str
    slug: str
    business_name: Optional[str] = None
    professional_title: Optional[str] = None
    tax_id: Optional[str] = None
    currency: str = "USD"
    default_hourly_rate: float = 0.0
    invoice_prefix: str = "INV-"
    payment_terms: Optional[str] = None
    late_fee_policy: Optional[str] = None
    payment_notes: Optional[str] = None

    # Billing columns are added to an existing workspace via raw ALTER TABLE,
    # which leaves legacy rows NULL (the ORM `default=` only fires on INSERT).
    # Treat NULL like the column default so GET /workspace never fails response
    # validation for a user who provisioned their workspace before these fields.
    @field_validator("currency", "invoice_prefix", mode="before")
    @classmethod
    def _blank_text_to_default(cls, value, info):
        defaults = {"currency": "USD", "invoice_prefix": "INV-"}
        return value if value else defaults[info.field_name]

    @field_validator("default_hourly_rate", mode="before")
    @classmethod
    def _null_rate_to_default(cls, value):
        return 0.0 if value is None else value

    class Config:
        from_attributes = True

# ------------------------------------------------------------------------------
# Time Entry Schemas
# ------------------------------------------------------------------------------
class TimeEntryCreate(BaseModel):
    project_id: str = Field(..., min_length=1, max_length=36)
    task_id: Optional[str] = Field(None, max_length=36)
    description: Optional[str] = Field(None, max_length=2_000)
    # 100 h is far beyond any honest manual entry but keeps a rogue client from
    # poisoning tracked hours / invoiced amounts with an astronomical value.
    duration_seconds: int = Field(0, ge=0, le=360_000)
    hourly_rate: float = Field(0.0, ge=0, le=100_000)
    is_billable: bool = True

class TimeEntryOut(BaseModel):
    id: str
    workspace_id: str
    project_id: str
    project_title: Optional[str] = None
    task_id: Optional[str] = None
    description: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: int
    hourly_rate: float
    is_billable: bool
    is_invoiced: bool
    created_at: datetime

    class Config:
        from_attributes = True

# ------------------------------------------------------------------------------
# Live Timer Sessions (server-clock-owned stopwatch)
# ------------------------------------------------------------------------------
class TimerStartRequest(BaseModel):
    project_id: str = Field(..., min_length=1, max_length=36)
    description: Optional[str] = Field(None, max_length=500)
    is_billable: bool = True

class TimerSessionOut(BaseModel):
    """Server-clock truth: `elapsed_seconds` is computed by the server from its
    own clock, so a refresh, a closed tab or a second device all resume the
    same run.
    """
    id: str
    workspace_id: str
    project_id: str
    project_title: Optional[str] = None
    description: Optional[str] = None
    is_billable: bool
    is_running: bool
    started_at: datetime
    paused_at: Optional[datetime] = None
    accumulated_seconds: int = 0
    elapsed_seconds: int = 0
    ended_at: Optional[datetime] = None

# ------------------------------------------------------------------------------
# Expense Schemas
# ------------------------------------------------------------------------------
class ExpenseCreate(BaseModel):
    project_id: Optional[str] = Field(None, max_length=36)
    category: str = Field("General", min_length=1, max_length=100)
    amount: float = Field(..., ge=0, le=_MAX_MONEY)
    description: Optional[str] = Field(None, max_length=10_000)
    receipt_cloudinary_url: Optional[str] = Field(None, max_length=512)

class ExpenseOut(BaseModel):
    id: str
    workspace_id: str
    project_id: Optional[str] = None
    category: str
    amount: float
    description: Optional[str] = None
    receipt_cloudinary_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# ------------------------------------------------------------------------------
# Contract & E-Signature Schemas
# ------------------------------------------------------------------------------
class ContractCreate(BaseModel):
    project_id: str = Field(..., min_length=1, max_length=36)
    client_id: Optional[str] = Field(None, max_length=36)
    title: str = Field(..., min_length=2, max_length=255)
    content: str = Field(..., min_length=10, max_length=200_000)
    recipient_name: Optional[str] = Field(None, max_length=255)
    recipient_email: Optional[str] = Field(None, max_length=255)
    sender_signature: Optional[str] = Field(None, max_length=100_000)

class ContractSignRequest(BaseModel):
    client_signature: str = Field(..., min_length=1, max_length=500_000, description="Canvas base64 data URL or typed legal signature")
    recipient_name: Optional[str] = Field(None, max_length=255)
    recipient_email: Optional[str] = Field(None, max_length=255)

class ContractOut(BaseModel):
    id: str
    workspace_id: str
    project_id: str
    project_title: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    title: str
    content: str
    status: str
    token: str
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    sender_signature: Optional[str] = None
    sender_signed_at: Optional[datetime] = None
    viewed_at: Optional[datetime] = None
    viewed_user_agent: Optional[str] = None
    client_signature: Optional[str] = None
    client_signed_at: Optional[datetime] = None
    client_ip: Optional[str] = None
    client_user_agent: Optional[str] = None
    file_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PublicContractOut(BaseModel):
    id: str
    title: str
    content: str
    status: str
    token: str
    project_title: Optional[str] = None
    freelancer_name: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    sender_signature: Optional[str] = None
    sender_signed_at: Optional[datetime] = None
    viewed_at: Optional[datetime] = None
    client_signature: Optional[str] = None
    client_signed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

# ------------------------------------------------------------------------------
# Proposal & AI Pitch Schemas
# ------------------------------------------------------------------------------
class ProposalCreate(BaseModel):
    client_id: Optional[str] = Field(None, max_length=36)
    project_id: Optional[str] = Field(None, max_length=36)
    title: str = Field(..., min_length=2, max_length=255)
    client_scope: str = Field(..., min_length=5, max_length=20_000)
    budget: float = Field(0.0, ge=0, le=_MAX_MONEY)
    pitch_content: str = Field(..., min_length=5, max_length=200_000)
    status: Literal["draft", "sent", "accepted", "declined"] = "sent"

class ProposalStatusUpdate(BaseModel):
    """Win rate on the report card is only meaningful once proposals can actually
    move through accepted/declined, so the lifecycle is enforced at the edge."""
    status: Literal["draft", "sent", "accepted", "declined"]

class ProposalAIGenerateRequest(BaseModel):
    client_scope: str = Field(..., min_length=5, max_length=20_000)
    target_budget: float = Field(1500.0, ge=0, le=_MAX_MONEY)

class ProposalAIGenerateResponse(BaseModel):
    title: str
    pitch_content: str
    deliverables: List[str]
    suggested_budget: float
    estimated_timeline: str

class ProposalOut(BaseModel):
    id: str
    workspace_id: str
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    project_id: Optional[str] = None
    title: str
    client_scope: str
    budget: float
    status: str
    pitch_content: str
    token: str
    created_at: datetime

    class Config:
        from_attributes = True

# ------------------------------------------------------------------------------
# Client Intake Forms Schemas
# ------------------------------------------------------------------------------
class IntakeQuestion(BaseModel):
    id: str = Field(..., min_length=1, max_length=100)
    label: str = Field(..., min_length=1, max_length=500)
    type: Literal["text", "textarea", "select", "file"] = "text"
    required: bool = True
    options: Optional[List[str]] = Field(None, max_length=50)

class IntakeFormCreate(BaseModel):
    client_id: Optional[str] = Field(None, max_length=36)
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=10_000)
    questions: List[IntakeQuestion] = Field(default_factory=list, max_length=100)

class IntakeSubmissionCreate(BaseModel):
    client_name: Optional[str] = Field(None, max_length=255)
    client_email: Optional[str] = Field(None, max_length=255)
    answers: dict = Field(default_factory=dict)

class IntakeSubmissionOut(BaseModel):
    id: str
    form_id: str
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    answers: dict = {}
    created_at: datetime

    class Config:
        from_attributes = True

class IntakeFormOut(BaseModel):
    id: str
    workspace_id: str
    client_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    questions: List[IntakeQuestion] = []
    status: str
    token: str
    submissions_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

class PublicIntakeFormOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    questions: List[IntakeQuestion] = []
    freelancer_name: str
    token: str
    created_at: datetime

    class Config:
        from_attributes = True

# ------------------------------------------------------------------------------
# Booking & Consultation Schemas
# ------------------------------------------------------------------------------
class BookingConsultationCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=10_000)
    duration_minutes: int = Field(30, ge=5, le=480)
    price: float = Field(0.0, ge=0, le=_MAX_MONEY)
    meeting_provider: Literal["google_meet", "zoom", "teams"] = "google_meet"
    is_active: bool = True

class BookingAppointmentCreate(BaseModel):
    consultation_id: str = Field(..., min_length=1, max_length=36)
    client_name: str = Field(..., min_length=2, max_length=255)
    client_email: str = Field(..., min_length=5, max_length=255)
    appointment_time: UTCDatetime
    notes: Optional[str] = Field(None, max_length=10_000)

class BookingAppointmentOut(BaseModel):
    id: str
    consultation_id: str
    consultation_title: Optional[str] = None
    client_name: str
    client_email: str
    appointment_time: datetime
    meeting_link: Optional[str] = None
    payment_status: str
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class BookingConsultationOut(BaseModel):
    id: str
    workspace_id: str
    title: str
    description: Optional[str] = None
    duration_minutes: int
    price: float
    meeting_provider: str
    is_active: bool
    token: str
    appointments_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

class PublicBookingConsultationOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    duration_minutes: int
    price: float
    freelancer_name: str
    token: str
    created_at: datetime

    class Config:
        from_attributes = True


# ------------------------------------------------------------------------------
# Calendar (dashboard calendar + Google Calendar sync)
# ------------------------------------------------------------------------------
class CalendarEventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=10_000)
    event_type: str = Field(default="meeting", pattern="^(meeting|client_work|deadline|personal)$")
    start_time: UTCDatetime
    end_time: UTCDatetime
    is_all_day: bool = False
    client_name: Optional[str] = Field(None, max_length=255)
    project_id: Optional[str] = Field(None, max_length=36)
    meeting_link: Optional[str] = Field(None, max_length=512)

    @model_validator(mode="after")
    def _check_range(self):
        # Validated here (not just in the endpoint) so a reversed range is a
        # clean 422 at the edge instead of a ValueError → 500 inside the handler.
        if self.end_time < self.start_time:
            raise ValueError("end_time must be after start_time")
        return self

    def validate_range(self) -> None:
        if self.end_time < self.start_time:
            raise ValueError("end_time must be after start_time")

class CalendarEventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=10_000)
    event_type: Optional[str] = Field(None, pattern="^(meeting|client_work|deadline|personal)$")
    start_time: Optional[UTCDatetime] = None
    end_time: Optional[UTCDatetime] = None
    is_all_day: Optional[bool] = None
    client_name: Optional[str] = Field(None, max_length=255)
    project_id: Optional[str] = Field(None, max_length=36)
    meeting_link: Optional[str] = Field(None, max_length=512)

class CalendarEventOut(BaseModel):
    id: str
    workspace_id: str
    title: str
    description: Optional[str] = None
    event_type: str
    start_time: datetime
    end_time: datetime
    is_all_day: bool
    client_name: Optional[str] = None
    project_id: Optional[str] = None
    meeting_link: Optional[str] = None
    source: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CalendarFeedItem(BaseModel):
    """Unified feed item merged from calendar_events (local/google), booking
    appointments and invoice due dates — always computed live from the DB."""
    id: str
    title: str
    description: Optional[str] = None
    event_type: str  # meeting | client_work | deadline | personal
    start_time: datetime
    end_time: datetime
    is_all_day: bool = False
    source: str  # local | google | booking | invoice
    client_name: Optional[str] = None
    meeting_link: Optional[str] = None
    status: Optional[str] = None

class GoogleConnectResponse(BaseModel):
    auth_url: str
    configured: bool = True

class GoogleConnectionStatus(BaseModel):
    connected: bool
    configured: bool
    google_email: Optional[str] = None
    last_synced_at: Optional[datetime] = None
    sync_enabled: bool = False

class GoogleCallbackPayload(BaseModel):
    code: str = Field(..., min_length=10)
    state: str = Field(..., min_length=10)

class CalendarSyncResult(BaseModel):
    created: int
    updated: int
    deleted: int
    synced_at: datetime

# ------------------------------------------------------------------------------
# Planner (todo list + sketch board merged into one workspace surface)
# ------------------------------------------------------------------------------
# The Excalidraw scene is opaque JSON owned by the frontend library, so it is
# bounded by size instead of schema-validated. The caps reject a rogue payload
# that would bloat the DB row or the re-poll fan-out to every open tab.
_MAX_SCENE_BYTES = 3_000_000   # serialized whole-scene upper bound
_MAX_FILE_BYTES = 1_000_000    # per binary file (data:...;base64 URL)
_MAX_SCENE_ITEMS = 2_000       # element count cap
_MAX_SCENE_FILES = 100         # embedded file count cap

class PlannerTodoCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)

    @field_validator("text")
    @classmethod
    def _strip_text(cls, value: str) -> str:
        # Dict keys / JSON pasted as a "todo" are meaningless; keep plain text
        value = value.strip()
        if not value:
            raise ValueError("text must not be blank")
        return value

class PlannerTodoUpdate(BaseModel):
    """Patch a single cell: rename, tick, or untick."""
    text: Optional[str] = Field(None, min_length=1, max_length=500)
    is_done: Optional[bool] = None

class PlannerTodoOut(BaseModel):
    id: str
    text: str
    is_done: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PlannerBoardSave(BaseModel):
    """Whole Excalidraw scene, stored verbatim (see the _MAX_* caps above)."""
    elements: List[Dict[str, Any]] = Field(default_factory=list, max_length=_MAX_SCENE_ITEMS)
    files: Dict[str, Dict[str, Any]] = Field(default_factory=dict, max_length=_MAX_SCENE_FILES)

    @model_validator(mode="after")
    def _check_scene_size(self):
        for file in self.files.values():
            data = file.get("dataURL") if isinstance(file, dict) else None
            if isinstance(data, str) and len(data.encode("utf-8", errors="ignore")) > _MAX_FILE_BYTES:
                raise ValueError("file too large")
        try:
            payload = _json.dumps({"elements": self.elements, "files": self.files}, default=str)
        except (TypeError, ValueError) as exc:
            raise ValueError("scene is not JSON-serializable") from exc
        if len(payload.encode("utf-8", errors="ignore")) > _MAX_SCENE_BYTES:
            raise ValueError("scene too large")
        return self

class PlannerBoardSummary(BaseModel):
    """List-row metadata — never carries the (potentially large) scene."""
    id: str
    name: str
    revision: int
    todos_count: int = 0
    done_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PlannerBoardCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("name must not be blank")
        return value

class PlannerBoardRename(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("name must not be blank")
        return value

class PlannerBoardFullOut(BaseModel):
    """Whole board for the editor: scene + todos. Fetched once on open."""
    id: str
    name: str
    revision: int
    elements: List[Dict[str, Any]] = []
    files: Dict[str, Dict[str, Any]] = {}
    todos: List[PlannerTodoOut] = []

class PlannerBoardHeadOut(BaseModel):
    """Cheap real-time poll payload: revision + todos, but NOT the scene.

    Returning only what changed keeps every open tab's request tiny and fast —
    the scene itself is re-downloaded solely when the revision has moved.
    """
    revision: int
    todos: List[PlannerTodoOut] = []

class PlannerRevisionOut(BaseModel):
    """Save response: the new head revision (client adopts it as its base)."""
    revision: int


