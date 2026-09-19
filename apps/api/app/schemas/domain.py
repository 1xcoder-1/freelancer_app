from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# ------------------------------------------------------------------------------
# Workspace & User Schemas
# ------------------------------------------------------------------------------
class WorkspaceOut(BaseModel):
    id: str
    name: str
    slug: str
    currency: str = "USD"
    created_at: datetime

    class Config:
        from_attributes = True

# ------------------------------------------------------------------------------
# Client Schemas
# ------------------------------------------------------------------------------
class ClientCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    company_name: Optional[str] = None
    email: str = Field(..., min_length=5, max_length=255)
    phone: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None
    status: str = "active"

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
# Project, Milestone & Task Schemas
# ------------------------------------------------------------------------------
class MilestoneCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    amount: float = 0.0
    deliverable_note: Optional[str] = None

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
    description: Optional[str] = None
    priority: str = "medium"
    estimated_hours: float = 0.0

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

class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    client_id: Optional[str] = None
    description: Optional[str] = None
    status: str = "in_progress"
    budget: float = 0.0
    hourly_rate: float = 0.0

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
    description: str
    quantity: float = 1.0
    unit_price: float = 0.0

class InvoiceCreate(BaseModel):
    client_id: str
    invoice_number: str
    status: str = "sent"
    due_date: Optional[datetime] = None
    notes: Optional[str] = None
    items: List[InvoiceItemCreate] = []

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
    items: List[InvoiceItemOut] = []
    created_at: datetime

    class Config:
        from_attributes = True

# ------------------------------------------------------------------------------
# Time Entry Schemas
# ------------------------------------------------------------------------------
class TimeEntryCreate(BaseModel):
    project_id: str
    task_id: Optional[str] = None
    description: Optional[str] = None
    duration_seconds: int = 0
    hourly_rate: float = 0.0
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
# Expense Schemas
# ------------------------------------------------------------------------------
class ExpenseCreate(BaseModel):
    project_id: Optional[str] = None
    category: str = "General"
    amount: float
    description: Optional[str] = None
    receipt_cloudinary_url: Optional[str] = None

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
    project_id: str
    client_id: Optional[str] = None
    title: str = Field(..., min_length=2, max_length=255)
    content: str = Field(..., min_length=10)
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    sender_signature: Optional[str] = None

class ContractSignRequest(BaseModel):
    client_signature: str = Field(..., description="Canvas base64 data URL or typed legal signature")
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None

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
    client_id: Optional[str] = None
    project_id: Optional[str] = None
    title: str = Field(..., min_length=2, max_length=255)
    client_scope: str = Field(..., min_length=5)
    budget: float = 0.0
    pitch_content: str = Field(..., min_length=5)
    status: str = "sent"

class ProposalAIGenerateRequest(BaseModel):
    client_scope: str = Field(..., min_length=5)
    target_budget: float = 1500.0

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
    id: str
    label: str
    type: str = "text"  # text, textarea, select, file
    required: bool = True
    options: Optional[List[str]] = None

class IntakeFormCreate(BaseModel):
    client_id: Optional[str] = None
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    questions: List[IntakeQuestion] = []

class IntakeSubmissionCreate(BaseModel):
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    answers: dict = {}

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
    description: Optional[str] = None
    duration_minutes: int = 30
    price: float = 0.0
    meeting_provider: str = "google_meet"
    is_active: bool = True

class BookingAppointmentCreate(BaseModel):
    consultation_id: str
    client_name: str = Field(..., min_length=2)
    client_email: str = Field(..., min_length=5)
    appointment_time: datetime
    notes: Optional[str] = None

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

