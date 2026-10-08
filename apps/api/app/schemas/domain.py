from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Any, Dict, Literal, Optional, List
from datetime import datetime, date
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
    status: Literal["lead", "active", "archived", "vip"] = "active"
    # Dedup UX: a same-phone collision raises 409 with the candidate; the UI
    # retries with this flag when the user confirms it really is a different
    # person. An email collision can never be overridden.
    allow_duplicate: bool = False

class ClientUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    company_name: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, min_length=5, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    website: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = Field(None, max_length=20_000)
    # SE7: mirrors ClientCreate's whitelist. A free-text status silently broke
    # the vip/archived filters in the UI; an unknown value is now a 422.
    status: Optional[Literal["lead", "active", "archived", "vip"]] = None

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
    # Revenue tracking, computed from this client's invoices when listing:
    # total_billed = every invoice that left draft (sent/overdue/paid),
    # total_paid = the subset that actually landed. Defaults keep the schema
    # usable for single-client responses that skip the aggregation.
    total_billed: float = 0.0
    total_paid: float = 0.0
    days_since_touch: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

# ------------------------------------------------------------------------------
# Clients productivity schemas (C1-C6)
# ------------------------------------------------------------------------------
class ClientEarningsOut(BaseModel):
    """C1 — the money answer a client card should always have given."""
    client_id: str
    name: str
    currency: str = "USD"
    lifetime_revenue: float = 0.0
    total_invoiced: float = 0.0
    total_paid: float = 0.0
    outstanding: float = 0.0
    avg_deal_size: float = 0.0
    days_to_payment: Optional[float] = None
    lifetime_hours: float = 0.0
    invoice_count: int = 0

class TopIncomeSourceOut(BaseModel):
    client_id: str
    name: str
    total_paid: float
    invoice_count: int

class ProjectFileIn(BaseModel):
    """Register a document already uploaded to storage / Cloudinary. The key must
    be the sandboxed one returned by storage flow."""
    file_key: str = Field(..., min_length=3, max_length=512)
    file_name: str = Field(..., min_length=1, max_length=255)
    content_type: Optional[str] = Field(None, max_length=120)
    size_bytes: int = Field(0, ge=0)
    category: str = Field("document", min_length=1, max_length=50)

class ProjectFileOut(BaseModel):
    id: str
    project_id: str
    file_key: str
    file_name: str
    content_type: Optional[str] = None
    size_bytes: int
    category: str
    created_at: datetime

    class Config:
        from_attributes = True

class ClientRelationshipOut(BaseModel):
    """C6 — Dashboard summary cards for client profile."""
    client_id: str
    currency: str = "USD"
    # Card 1: Projects
    total_projects: int = 0
    open_projects: int = 0
    completed_projects: int = 0
    # Card 2: Financials (Amount / Revenue)
    total_revenue: float = 0.0
    paid_amount: float = 0.0
    pending_amount: float = 0.0
    # Card 3: Contracts
    total_contracts: int = 0
    signed_contracts: int = 0
    pending_contracts: int = 0
    unsigned_contracts: int = 0
    unsigned_contract_value: float = 0.0
    # Card 4: Invoices
    total_invoices: int = 0
    paid_invoices: int = 0
    pending_invoices: int = 0
    overdue_invoices: int = 0
    overdue_value: float = 0.0
    # Compatibility
    unbilled_hours: float = 0.0
    unbilled_value: float = 0.0
    days_since_touch: Optional[int] = None

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
    priority: Literal["low", "medium", "high", "urgent"] = "medium"
    next_follow_up_at: Optional[UTCDatetime] = None
    notes: Optional[str] = Field(None, max_length=20_000)
    # Same dedup contract as ClientCreate (phone hit overridable, email hit never).
    allow_duplicate: bool = False

class LeadUpdate(BaseModel):
    """Every field is optional so the pipeline board can patch one cell."""
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    company: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, min_length=5, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    source: Optional[str] = Field(None, max_length=100)
    # SE8: won/lost are deliberately excluded from the generic PATCH. Closing a
    # deal is a decision with consequences (it auto-creates a Client / feeds win
    # rate), so it must go through POST /leads/{id}/close with a reason, never a
    # stray stage edit that could silently spawn a roster row or skew stats.
    stage: Optional[Literal["new", "contacted", "proposal", "negotiation"]] = None
    estimated_value: Optional[float] = Field(None, ge=0, le=_MAX_MONEY)
    # Aligned to the four levels the pipeline board and cards actually render.
    priority: Optional[Literal["low", "medium", "high", "urgent"]] = None
    next_follow_up_at: Optional[UTCDatetime] = None
    notes: Optional[str] = Field(None, max_length=20_000)

class LeadClose(BaseModel):
    """Body for POST /leads/{id}/close — the only sanctioned way to reach a
    terminal stage (SE8/L3). `lost` requires a structured reason so the
    'lost by reason' analytics stay honest; `won` triggers the email-deduped
    client creation that a generic stage edit used to do by accident."""
    outcome: Literal["won", "lost"]
    reason: Optional[Literal[
        "price", "no-budget", "went-competitor", "ghosted",
        "timing", "scope-mismatch", "other",
    ]] = None
    note: Optional[str] = Field(None, max_length=2_000)

    @field_validator("reason")
    @classmethod
    def _reason_required_for_loss(cls, v):
        # Enforced jointly with outcome in the endpoint (Pydantic can't see the
        # other field here without a model_validator); kept as a type guard.
        return v

class LeadContactLog(BaseModel):
    """Body for POST /leads/{id}/log-contact — stamps the touch and optionally
    schedules the next one in the same action (never a bare timestamp update)."""
    note: Optional[str] = Field(None, max_length=10_000)
    next_follow_up_at: Optional[UTCDatetime] = None

class StartWorkRequest(BaseModel):
    """F3 — one action turns a won lead into the working records it implies,
    in a single transaction. Client (email-deduped) and Project are always
    created; the contract draft and first invoice are opt-in so nothing
    the freelancer didn't ask for appears. Every created id comes back so the
    UI can deep-link straight to them."""
    project_title: Optional[str] = Field(None, max_length=255)
    create_contract: bool = False
    contract_title: Optional[str] = Field(None, max_length=255)
    contract_content: Optional[str] = Field(None, max_length=200_000)
    create_invoice: bool = False
    invoice_amount: Optional[float] = Field(None, ge=0, le=_MAX_MONEY)

class StartOutcome(BaseModel):
    """The created ids (F3). Client/project are always present; the rest are
    returned only when requested. reused_client flags the email-dedup path so
    the UI can say 'existing client linked' instead of implying a new row."""
    lead_id: str
    client_id: str
    reused_client: bool = False
    project_id: Optional[str] = None
    contract_id: Optional[str] = None
    invoice_id: Optional[str] = None

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
    # L3/L5 surfaced for the loss-reason analytics and response-speed metrics.
    reason_lost: Optional[str] = None
    reason_lost_note: Optional[str] = None
    first_contact_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class LeadConvertRequest(BaseModel):
    """Body for POST /leads/{id}/convert-to-client (all optional — the web
    client has always posted {} here).

    ``merge_into_client_id`` closes the 'same person, different email' loop:
    after convert-preview flags a weak match and the user confirms it is the
    same human, convert updates THAT roster row instead of creating a new one."""
    merge_into_client_id: Optional[str] = Field(None, min_length=1, max_length=64)

class LeadConvertPreviewOut(BaseModel):
    """Pre-flight answer for 'Make this client': what convert-to-client would
    do BEFORE the user commits, so the dialog can promise the right thing.

    ``match``: 'email' = the roster already has this exact person (convert
    reuses + fills gaps, never duplicates); 'weak' = a same-name/phone client
    exists but the email differs, so the UI asks 'same person?' first; 'none'
    = plain create."""
    match: Literal["email", "weak", "none"]
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    same_person: bool = False

# ------------------------------------------------------------------------------
# Interaction Schemas (F2)
# ------------------------------------------------------------------------------
# One append-only touch table for leads + clients. `person_type` is a
# polymorphic pointer (never a FK both ways); the endpoint validates the
# referenced lead/client exists in the caller's workspace before inserting.
class InteractionCreate(BaseModel):
    person_type: Literal["lead", "client"]
    person_id: str = Field(..., min_length=1, max_length=36)
    kind: Literal["call", "email", "meeting", "message", "note"] = "note"
    direction: Literal["inbound", "outbound"] = "outbound"
    summary: Optional[str] = Field(None, max_length=2000)
    occurred_at: Optional[UTCDatetime] = None
    next_action_at: Optional[UTCDatetime] = None

class InteractionOut(BaseModel):
    id: str
    workspace_id: str
    person_type: str
    person_id: str
    kind: str
    direction: str
    summary: Optional[str] = None
    occurred_at: datetime
    next_action_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

# ------------------------------------------------------------------------------
# Revenue-At-Stake Aggregate (F4)
# ------------------------------------------------------------------------------
# Shared by GET /contracts/at-stake and GET /projects/at-risk. Every bucket is
# computed in one grouped pass; no per-row N+1. Money is always the workspace
# currency and never trusts a client-supplied total.
class RevenueAtStakeOut(BaseModel):
    currency: str = "USD"
    total_at_stake: float = 0.0
    unsigned_contracts_value: float = 0.0
    unsigned_contracts_count: int = 0
    unbilled_value: float = 0.0
    unbilled_hours: float = 0.0
    unpaid_invoices_value: float = 0.0
    unpaid_invoices_count: int = 0

# ------------------------------------------------------------------------------
# Project, Milestone & Task Schemas
# ------------------------------------------------------------------------------
class MilestoneCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=10_000)
    amount: float = Field(0.0, ge=0, le=_MAX_MONEY)
    deliverable_note: Optional[str] = Field(None, max_length=10_000)
    due_date: Optional[date] = None

class MilestoneOut(BaseModel):
    id: str
    project_id: str
    title: str
    description: Optional[str] = None
    amount: float
    is_completed: bool
    deliverable_note: Optional[str] = None
    # P6 deliverable sign-off: submitted (freelancer) and approved (client) are
    # separate dates so "waiting on client" is measurable, not a checkbox.
    due_date: Optional[date] = None
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=10_000)
    priority: Literal["low", "medium", "high", "urgent"] = "medium"
    estimated_hours: float = Field(0.0, ge=0, le=10_000)
    due_date: Optional[date] = None

class TaskUpdate(BaseModel):
    """Every field is optional so the UI can patch a single kanban column."""
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=10_000)
    status: Optional[Literal["todo", "in_progress", "review", "done"]] = None
    priority: Optional[Literal["low", "medium", "high", "urgent"]] = None
    estimated_hours: Optional[float] = Field(None, ge=0, le=10_000)
    due_date: Optional[date] = None

class TaskOut(BaseModel):
    id: str
    project_id: str
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    estimated_hours: float
    due_date: Optional[date] = None
    # P5 actual vs estimated: summed from TimeEntry rows linked to this task.
    actual_hours: float = 0.0
    created_at: datetime

    class Config:
        from_attributes = True

class MilestoneUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=10_000)
    amount: Optional[float] = Field(None, ge=0, le=_MAX_MONEY)
    is_completed: Optional[bool] = None
    deliverable_note: Optional[str] = Field(None, max_length=10_000)
    due_date: Optional[date] = None

class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    client_id: Optional[str] = Field(None, max_length=36)
    description: Optional[str] = Field(None, max_length=20_000)
    status: Literal["planning", "in_progress", "completed", "paused"] = "in_progress"
    budget: float = Field(0.0, ge=0, le=_MAX_MONEY)
    hourly_rate: float = Field(0.0, ge=0, le=100_000)
    start_date: Optional[date] = None
    due_date: Optional[date] = None

class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    client_id: Optional[str] = Field(None, max_length=36)
    description: Optional[str] = Field(None, max_length=20_000)
    status: Optional[Literal["planning", "in_progress", "completed", "paused"]] = None
    budget: Optional[float] = Field(None, ge=0, le=_MAX_MONEY)
    hourly_rate: Optional[float] = Field(None, ge=0, le=100_000)
    start_date: Optional[date] = None
    due_date: Optional[date] = None

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
    # P1 unbilled time surfaced on the project that earned it (was invoice-only).
    unbilled_hours: float = 0.0
    unbilled_value: float = 0.0
    # P1/P2 real schedule columns + a derived deadline verdict.
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    deadline: Optional[Dict[str, Any]] = None
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
    due_date: Optional[date] = None
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PublicChangeRequestOut(BaseModel):
    id: str
    title: str
    detail: Optional[str] = None
    price: float
    impact_days: int
    status: str
    requested_by: Optional[str] = None
    decided_at: Optional[datetime] = None
    decision_note: Optional[str] = None

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
    # P3 change requests (scope-creep guard) shown in the portal so the client
    # can approve/decline a priced change with an audit timestamp.
    change_requests: List[PublicChangeRequestOut] = []
    # SE4: whether this viewer has proven the recipient email yet. Approving
    # actions are blocked until the portal verifies, so a leaked link is inert.
    recipient_verified: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

class PortalVerifyIn(BaseModel):
    """SE4 first-touch identity: the viewer confirms the email this project was
    shared with. Stored once on the project; approving actions must match it."""
    email: str = Field(..., min_length=5, max_length=255)

class ChangeRequestCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    detail: Optional[str] = Field(None, max_length=10_000)
    price: float = Field(0.0, ge=0, le=_MAX_MONEY)
    impact_days: int = Field(0, ge=0, le=3650)
    requested_by: Optional[str] = Field(None, max_length=255)

class ChangeRequestUpdate(BaseModel):
    status: Optional[Literal["requested", "approved", "rejected", "implemented"]] = None
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    detail: Optional[str] = Field(None, max_length=10_000)
    price: Optional[float] = Field(None, ge=0, le=_MAX_MONEY)
    impact_days: Optional[int] = Field(None, ge=0, le=3650)

class ChangeRequestOut(BaseModel):
    id: str
    project_id: str
    workspace_id: str
    title: str
    detail: Optional[str] = None
    price: float
    impact_days: int
    status: str
    requested_by: Optional[str] = None
    decided_at: Optional[datetime] = None
    decision_note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ChangeRequestDecision(BaseModel):
    """Client decision posted from the public portal. `email` is the SE4
    recipient guard (must match the verified address); the reason is optional."""
    decision: Literal["approved", "rejected"]
    email: str = Field(..., min_length=5, max_length=255)
    note: Optional[str] = Field(None, max_length=2_000)


class ProjectMilestoneSubmitIn(BaseModel):
    """P6 — freelancer marks a deliverable submitted, optionally noting what
    was delivered, which starts the client's sign-off clock."""
    note: Optional[str] = Field(None, max_length=10_000)

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
    # Tracked time billed on this invoice: the client sends the entry ids it
    # imported as line items; the server re-validates them (workspace-owned,
    # billable, not already invoiced) and stamps them billed — double-billing
    # an entry is rejected rather than silently counted twice.
    time_entry_ids: List[str] = Field(default_factory=list, max_length=500)

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
    # Owning project (V6/P1): lets a project page list only its own invoices
    # instead of filtering by client (which showed another project's invoices).
    project_id: Optional[str] = None
    invoice_number: str
    status: str
    issue_date: datetime
    due_date: Optional[datetime] = None
    total_amount: float
    notes: Optional[str] = None
    paid_at: Optional[datetime] = None
    # Public payment link handle (V1): the UI builds /pay/{token} from this so
    # it never has to expose or copy the internal invoice id.
    token: Optional[str] = None
    items: List[InvoiceItemOut] = []
    created_at: datetime

    class Config:
        from_attributes = True

class InvoiceStatusUpdate(BaseModel):
    """Whitelisted so `PATCH /invoices/{id}/status` cannot store an arbitrary
    string that no dashboard filter, reminder job or PDF renderer understands."""
    status: Literal["draft", "sent", "paid", "overdue"]

# ---- Public payment page (V1) ------------------------------------------------
# The client opens /pay/{token}; nothing here trusts a client-supplied invoice
# id, and the payment amount is bounded so a rogue body can never post an
# absurd figure. Responses expose only what a payer needs to see.
class InvoicePaymentCreate(BaseModel):
    amount: float = Field(..., gt=0, le=_MAX_MONEY)
    method: Literal["bank_transfer", "cash", "card", "paypal", "stripe", "other"] = "bank_transfer"
    reference: Optional[str] = Field(None, max_length=255)
    note: Optional[str] = Field(None, max_length=2_000)

class PublicInvoiceOut(BaseModel):
    """What the payer sees: identity + money state, never the workspace id."""
    invoice_number: str
    status: str
    client_name: Optional[str] = None
    currency: str = "USD"
    issue_date: datetime
    due_date: Optional[datetime] = None
    total_amount: float
    amount_paid: float
    amount_due: float
    notes: Optional[str] = None
    items: List[InvoiceItemOut] = []

    class Config:
        from_attributes = True

class InvoicePaymentOut(BaseModel):
    id: str
    amount: float
    method: str
    reference: Optional[str] = None
    note: Optional[str] = None
    paid_at: datetime

    class Config:
        from_attributes = True

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
    # Cash Runway: real money in the bank. Bounded so a typo or a malicious
    # payload can never produce a runway figure in the trillions.
    bank_balance: Optional[float] = Field(None, ge=-10_000_000, le=100_000_000)

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
    bank_balance: float = 0.0
    bank_balance_updated_at: Optional[datetime] = None

    # Billing columns are added to an existing workspace via raw ALTER TABLE,
    # which leaves legacy rows NULL (the ORM `default=` only fires on INSERT).
    # Treat NULL like the column default so GET /workspace never fails response
    # validation for a user who provisioned their workspace before these fields.
    @field_validator("currency", "invoice_prefix", mode="before")
    @classmethod
    def _blank_text_to_default(cls, value, info):
        defaults = {"currency": "USD", "invoice_prefix": "INV-"}
        return value if value else defaults[info.field_name]

    @field_validator("default_hourly_rate", "bank_balance", mode="before")
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
    is_recurring: bool = False

class ExpenseUpdate(BaseModel):
    """Closed whitelist for PATCH /expenses/{id}: only these fields can ever
    be written, and each keeps the same bounds as create."""
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    amount: Optional[float] = Field(None, ge=0, le=_MAX_MONEY)
    description: Optional[str] = Field(None, max_length=10_000)
    is_recurring: Optional[bool] = None

class ExpenseOut(BaseModel):
    id: str
    workspace_id: str
    project_id: Optional[str] = None
    category: str
    amount: float
    description: Optional[str] = None
    receipt_cloudinary_url: Optional[str] = None
    is_recurring: bool = False
    created_at: datetime

    # Dev auto-sync adds the column with raw ALTER TABLE, leaving legacy rows
    # NULL (the ORM default only fires on INSERT). NULL simply means "not a
    # subscription".
    @field_validator("is_recurring", mode="before")
    @classmethod
    def _null_to_false(cls, value):
        return False if value is None else value

    class Config:
        from_attributes = True

# ------------------------------------------------------------------------------
# Contract & E-Signature Schemas
# ------------------------------------------------------------------------------
# SE5 — the public sign route is an *unauthenticated* POST whose body used to
# accept a 500 KB free-text blob with no scheme check, so a leaked token let
# anyone store `javascript:`/`data:image/svg+xml` payloads (the SE6 XSS vector)
# that the portal later renders inline. Signatures are therefore constrained to
# an explicit allow-list of safe forms and capped at 256 KB; everything else is
# rejected at the edge with a 422 before it ever reaches the DB.
_SIG_MAX_CHARS = 256 * 1024  # ~256 KB cap on a base64 blob / typed name
_SAFE_IMAGE_SIG_PREFIXES = ("data:image/png;base64,", "data:image/webp;base64,")
_SIG_SAFE_PREFIXES = _SAFE_IMAGE_SIG_PREFIXES + ("typed:",)
# Schemes that must never be stored, even in a display-name field.
_DANGEROUS_SIG_SCHEMES = ("data:", "javascript:", "vbscript:", "blob:", "file:", "<")


def _assert_signature_size(value: str) -> str:
    if len(value) > _SIG_MAX_CHARS:
        raise ValueError("Signature exceeds the 256 KB limit.")
    return value


def _validate_client_signature(value: str) -> str:
    """Strict for the public (unauthenticated) client signature."""
    _assert_signature_size(value)
    lowered = value.strip().lower()
    if not any(lowered.startswith(p) for p in _SIG_SAFE_PREFIXES):
        raise ValueError("Signature must be a PNG/WebP image or a typed signature.")
    return value


def _validate_sender_signature(value: str) -> str:
    """The authorized-sender field is free text (a name/title), so it only has
    to reject scheme-smuggling and stay bounded — it is never rendered as HTML."""
    _assert_signature_size(value)
    lowered = value.strip().lower()
    if any(lowered.startswith(s) for s in _DANGEROUS_SIG_SCHEMES):
        raise ValueError("Sender signature must be a plain name or typed value.")
    return value


class ContractCreate(BaseModel):
    project_id: str = Field(..., min_length=1, max_length=36)
    client_id: Optional[str] = Field(None, max_length=36)
    title: str = Field(..., min_length=2, max_length=255)
    content: str = Field(..., min_length=10, max_length=200_000)
    recipient_name: Optional[str] = Field(None, max_length=255)
    recipient_email: Optional[str] = Field(None, max_length=255)
    sender_signature: Optional[str] = Field(None, max_length=_SIG_MAX_CHARS)
    # N2: how long the sign link stays valid; seeds expires_at when sent.
    expire_days: int = Field(30, ge=1, le=365)

    @field_validator("sender_signature")
    @classmethod
    def _check_sender_sig(cls, v: Optional[str]) -> Optional[str]:
        return None if v is None else _validate_sender_signature(v)

class ContractSignRequest(BaseModel):
    client_signature: str = Field(..., min_length=1, max_length=_SIG_MAX_CHARS, description="Canvas base64 data URL (png/webp) or typed legal signature")
    recipient_name: Optional[str] = Field(None, max_length=255)
    recipient_email: Optional[str] = Field(None, max_length=255)

    @field_validator("client_signature")
    @classmethod
    def _check_client_sig(cls, v: str) -> str:
        return _validate_client_signature(v)

class ContractSenderSignRequest(BaseModel):
    """N6 counter-sign: the freelancer signs *after* the client so 'both parties
    signed' becomes true instead of being stamped at creation time."""
    sender_signature: str = Field(..., min_length=1, max_length=_SIG_MAX_CHARS)

    @field_validator("sender_signature")
    @classmethod
    def _check_sig(cls, v: str) -> str:
        return _validate_client_signature(v)

class ContractDeclineRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=2000)

class ContractEventOut(BaseModel):
    id: str
    contract_id: str
    event: str
    occurred_at: datetime
    actor_ip: Optional[str] = None
    actor_user_agent: Optional[str] = None
    note: Optional[str] = None

    class Config:
        from_attributes = True

class ContractTemplateCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    content: str = Field(..., min_length=10, max_length=200_000)
    category: Literal["general", "msa", "sow", "retainer", "nda"] = "general"

class ContractTemplateOut(BaseModel):
    id: str
    workspace_id: str
    title: str
    content: str
    category: str
    is_default: bool
    created_at: datetime

    class Config:
        from_attributes = True

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
    # N1 (surfaced viewed_ip), N2 expiry, N5 versioning, N6 execution:
    viewed_ip: Optional[str] = None
    expires_at: Optional[datetime] = None
    expire_days: int = 30
    version: int = 1
    supersedes_id: Optional[str] = None
    fully_executed_at: Optional[datetime] = None
    created_at: datetime
    # Derived on the list endpoint (server clock) so the UI never does date math
    # at render time: how long a sign link has been waiting, and days-to-expiry.
    days_awaiting: Optional[int] = None
    days_left: Optional[int] = None

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
    # N2/N5: the public page needs the expiry + a supersede flag so it can show
    # "this version has expired / please sign the latest" instead of a stale form.
    expires_at: Optional[datetime] = None
    superseded: bool = False
    fully_executed_at: Optional[datetime] = None
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
    # L4: explicit expiry wins; otherwise valid_days (default 14) seeds it from
    # now so an unanswered proposal stops reading as still-open forever.
    expires_at: Optional[UTCDatetime] = None
    valid_days: int = Field(14, ge=1, le=365)

class ProposalStatusUpdate(BaseModel):
    """Win rate on the report card is only meaningful once proposals can actually
    move through accepted/declined, so the lifecycle is enforced at the edge."""
    status: Literal["draft", "sent", "accepted", "declined", "expired"]

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
    expires_at: Optional[datetime] = None
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

class IntakeFormUpdate(BaseModel):
    client_id: Optional[str] = Field(None, max_length=36)
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=10_000)
    questions: Optional[List[IntakeQuestion]] = Field(None, max_length=100)
    status: Optional[str] = Field(None, max_length=50)

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
_WEEKDAY_MASK_DEFAULT = "1111100"

class BookingConsultationCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=10_000)
    duration_minutes: int = Field(30, ge=5, le=480)
    price: float = Field(0.0, ge=0, le=_MAX_MONEY)
    meeting_provider: Literal["google_meet", "zoom", "teams"] = "google_meet"
    is_active: bool = True
    # B2 real opening hours + B1 booking guards. weekday_mask is a 7-char
    # 0/1 string (Mon..Sun); the window is in the freelancer's timezone.
    weekday_mask: str = Field(_WEEKDAY_MASK_DEFAULT, min_length=7, max_length=7)
    start_minute: int = Field(540, ge=0, le=1439)
    end_minute: int = Field(1020, ge=1, le=1440)
    timezone: str = Field("UTC", min_length=1, max_length=64)
    min_lead_hours: int = Field(2, ge=0, le=336)     # up to 14 days notice
    max_advance_days: int = Field(60, ge=1, le=365)
    buffer_minutes: int = Field(0, ge=0, le=240)
    intake_form_id: Optional[str] = Field(None, max_length=36)
    no_show_limit: int = Field(2, ge=1, le=10)

    @field_validator("weekday_mask")
    @classmethod
    def _validate_mask(cls, v: str) -> str:
        if set(v) - {"0", "1"}:
            raise ValueError("weekday_mask must be exactly 7 characters of 0 or 1")
        return v

    @model_validator(mode="after")
    def _validate_window(self):
        if self.end_minute <= self.start_minute:
            raise ValueError("end_minute must be after start_minute")
        return self

class BookingAppointmentCreate(BaseModel):
    consultation_id: str = Field(..., min_length=1, max_length=36)
    client_name: str = Field(..., min_length=2, max_length=255)
    client_email: str = Field(..., min_length=5, max_length=255)
    appointment_time: UTCDatetime
    notes: Optional[str] = Field(None, max_length=10_000)

class PublicAppointmentCreate(BaseModel):
    """Body for the anonymous token-addressed schedule route (B1). The
    consultation is resolved from the URL token, so the client never supplies
    (or guesses) an internal id."""
    client_name: str = Field(..., min_length=2, max_length=255)
    client_email: str = Field(..., min_length=5, max_length=255)
    appointment_time: UTCDatetime
    notes: Optional[str] = Field(None, max_length=10_000)

class BookingAppointmentStatusUpdate(BaseModel):
    """Freelancer-side status transition (B3). A new `booked`/`pending` value
    is never accepted here — only the deliberate outcomes."""
    status: Literal["confirmed", "cancelled", "no_show", "completed"]

class BookingRescheduleRequest(BaseModel):
    """Client self-reschedule (B3): a token-scoped request that only ever moves
    the appointment to another server-validated slot."""
    appointment_time: UTCDatetime

class BookingSlotsOut(BaseModel):
    """Conflict-free open slots (B1/B2): computed server-side from the window,
    the booking guards, blocked days and already-booked times."""
    consultation_token: str
    timezone: str
    slots: List[datetime]

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
    status: str = "pending"
    token: Optional[str] = None
    reschedule_count: int = 0
    no_show: bool = False
    invoice_id: Optional[str] = None
    invoice_token: Optional[str] = None
    client_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PublicAppointmentOut(BaseModel):
    """The client's own view of an appointment via its token (B3). Never
    exposes the internal id, the client email back or workspace details."""
    consultation_title: Optional[str] = None
    consultation_token: Optional[str] = None
    client_name: str
    appointment_time: datetime
    status: str
    payment_status: str
    meeting_link: Optional[str] = None
    reschedule_count: int = 0
    max_reschedules: int = 3
    invoice_token: Optional[str] = None

class BookingAgendaOut(BaseModel):
    """Live Today agenda (B6): ages and counts are derived server-side so the
    client render never has to call Date.now() (react-hooks/purity)."""
    next_call: Optional[BookingAppointmentOut] = None
    hours_to_next: Optional[float] = None
    today_calls: List[BookingAppointmentOut] = []
    week_booked: int = 0
    week_available: int = 0
    no_show_count: int = 0
    prepayment_required: bool = False

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
    weekday_mask: str = _WEEKDAY_MASK_DEFAULT
    start_minute: int = 540
    end_minute: int = 1020
    timezone: str = "UTC"
    min_lead_hours: int = 2
    max_advance_days: int = 60
    buffer_minutes: int = 0
    intake_form_id: Optional[str] = None
    no_show_limit: int = 2
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
    # B1/B2 the client needs the rules to render open slots honestly
    timezone: str = "UTC"
    weekday_mask: str = _WEEKDAY_MASK_DEFAULT
    start_minute: int = 540
    end_minute: int = 1020
    min_lead_hours: int = 2
    max_advance_days: int = 60
    buffer_minutes: int = 0
    # B4 a paid consult is not confirmed until its invoice is paid
    requires_payment: bool = False
    # B5 link an intake form so answers arrive before the call
    intake_form_id: Optional[str] = None
    intake_token: Optional[str] = None

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

# A todo's timebox column is literally named `date`; alias the type so the
# field annotation `Optional[_Date]` never resolves against the shadowing
# class attribute of the same name.
_Date = date

class PlannerTodoCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    # PL1/PL2/PL3: when, for whom, and how often a to-do lands.
    due_date: Optional[date] = None
    priority: Literal["low", "medium", "high", "urgent"] = "medium"
    project_id: Optional[str] = Field(None, max_length=36)
    recurrence: Optional[Literal["daily", "weekly"]] = None
    date: Optional[_Date] = None
    start_minute: Optional[int] = Field(None, ge=0, le=1439)
    duration_minutes: Optional[int] = Field(None, ge=0, le=1440)

    @field_validator("text")
    @classmethod
    def _strip_text(cls, value: str) -> str:
        # Dict keys / JSON pasted as a "todo" are meaningless; keep plain text
        value = value.strip()
        if not value:
            raise ValueError("text must not be blank")
        return value

class PlannerTodoUpdate(BaseModel):
    """Patch a single cell: rename, tick, untick, or (re)plan date/priority/
    project/timebox. A field left null is left untouched."""
    text: Optional[str] = Field(None, min_length=1, max_length=500)
    is_done: Optional[bool] = None
    due_date: Optional[date] = None
    priority: Optional[Literal["low", "medium", "high", "urgent"]] = None
    project_id: Optional[str] = Field(None, max_length=36)
    recurrence: Optional[Literal["daily", "weekly"]] = None
    date: Optional[_Date] = None
    start_minute: Optional[int] = Field(None, ge=0, le=1439)
    duration_minutes: Optional[int] = Field(None, ge=0, le=1440)

class PlannerTodoOut(BaseModel):
    id: str
    board_id: str
    text: str
    is_done: bool
    due_date: Optional[date] = None
    priority: str = "medium"
    project_id: Optional[str] = None
    recurrence: Optional[str] = None
    date: Optional[_Date] = None
    start_minute: Optional[int] = None
    duration_minutes: Optional[int] = None
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
    # PL6 live "Today" column: overdue / due-today / planned timebox blocks.
    overdue_count: int = 0
    due_today_count: int = 0
    planned_today_count: int = 0
    is_public: bool = False
    has_share: bool = False
    share_expires_at: Optional[datetime] = None
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
    `today` is the server's date so the day view can compute overdue/due-today
    without the client ever calling Date.now() during render.
    """
    revision: int
    todos: List[PlannerTodoOut] = []
    today: Optional[date] = None

class PlannerRevisionOut(BaseModel):
    """Save response: the new head revision (client adopts it as its base)."""
    revision: int

class PlannerShareEnable(BaseModel):
    expires_at: Optional[UTCDatetime] = None

class PlannerShareOut(BaseModel):
    is_public: bool
    share_token: Optional[str] = None
    share_url: Optional[str] = None
    expires_at: Optional[datetime] = None

class PlannerSnapshotSummary(BaseModel):
    captured_on: str
    revision: int
    created_at: datetime

class PlannerSnapshotOut(BaseModel):
    captured_on: str
    revision: int
    elements: List[Dict[str, Any]] = []
    files: Dict[str, Dict[str, Any]] = {}

class PublicPlannerBoardOut(BaseModel):
    """What an anonymous holder of a share link sees: the scene + OPEN todos,
    never edit rights, never workspace metadata or completed rows."""
    name: str
    elements: List[Dict[str, Any]] = []
    todos: List[PlannerTodoOut] = []


