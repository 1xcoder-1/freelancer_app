import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, time
from app.core.database import get_db
from app.core.auth import require_authenticated_user
from app.core.inngest_client import emit
from app.core.workspace import get_or_create_user_workspace
from app.models.booking import BookingConsultation, BookingAppointment, BookingBlockedDay
from app.models.client import Client
from app.models.finance import Invoice, InvoiceItem
from app.models.intake import IntakeForm
from app.models.workspace import Workspace
from app.schemas.domain import (
    BookingConsultationCreate,
    BookingConsultationOut,
    PublicBookingConsultationOut,
    BookingAppointmentOut,
    PublicAppointmentCreate,
    BookingAppointmentStatusUpdate,
    BookingRescheduleRequest,
    BookingSlotsOut,
    PublicAppointmentOut,
    BookingAgendaOut,
)

router = APIRouter(prefix="/booking", tags=["Booking & Consultation Calendar"])

# A client may move their own appointment only this many times before they have
# to talk to the freelancer (B3). Also the ceiling on how far the open-slot
# generator will look ahead in one request, so a huge max_advance_days never
# turns a 15s poll into an unbounded scan.
MAX_RESCHEDULES = 3
_SLOT_HORIZON_CAP = 30
_MAX_SLOTS_PER_RESPONSE = 200

# Appointments that keep a slot taken. A cancelled/no-show slot frees up so the
# same time can be offered again; a completed one is in the past anyway but
# stays blocked to avoid an accidental rebook over history.
_ACTIVE_STATUSES = ("pending", "confirmed", "completed")


def _minutes_of_day(dt: datetime) -> int:
    return dt.hour * 60 + dt.minute


def _slot_end(consultation: BookingConsultation, start: datetime) -> datetime:
    return start + timedelta(minutes=consultation.duration_minutes)


def _conflicts(existing: datetime, consultation: BookingConsultation, start: datetime) -> bool:
    """True when `start..start+duration` overlaps `existing..existing+duration`
    once the required buffer is accounted for on both sides."""
    dur = consultation.duration_minutes
    buf = consultation.buffer_minutes
    new_end = start + timedelta(minutes=dur)
    ex_end = existing + timedelta(minutes=dur)
    # No overlap only if one finishes (plus buffer) before the other starts.
    overlap = (start - timedelta(minutes=buf)) < ex_end and new_end > (existing - timedelta(minutes=buf))
    return overlap


async def _active_times(db: AsyncSession, consultation_id: str, lo: datetime, hi: datetime, exclude_id: Optional[str] = None) -> List[datetime]:
    """Active appointment start-times inside [lo, hi) (bounded window), so the
    overlap test never scans the whole table on a 15s poll."""
    stmt = (
        select(BookingAppointment.appointment_time)
        .where(
            BookingAppointment.consultation_id == consultation_id,
            BookingAppointment.status.in_(_ACTIVE_STATUSES),
            BookingAppointment.appointment_time >= lo,
            BookingAppointment.appointment_time < hi,
        )
    )
    if exclude_id:
        stmt = stmt.where(BookingAppointment.id != exclude_id)
    rows = (await db.execute(stmt)).all()
    return [r[0] for r in rows]


async def _blocked_dates(db: AsyncSession, consultation_id: str) -> set:
    rows = (await db.execute(
        select(BookingBlockedDay.date).where(BookingBlockedDay.consultation_id == consultation_id)
    )).all()
    return {r[0] for r in rows}


def _validate_slot_rules(consultation: BookingConsultation, when: datetime, now: datetime) -> None:
    """B1: reject past / too-soon / too-far / closed-weekday / outside-window
    requests server-side. Raises 422 with a specific reason."""
    if when < now + timedelta(hours=consultation.min_lead_hours):
        raise HTTPException(
            status_code=422,
            detail=f"Appointments must be at least {consultation.min_lead_hours} hour(s) in the future.",
        )
    if when > now + timedelta(days=consultation.max_advance_days):
        raise HTTPException(
            status_code=422,
            detail=f"Appointments can not be booked more than {consultation.max_advance_days} days ahead.",
        )
    # weekday_mask is Mon..Sun -> Python weekday() is Mon=0..Sun=6, aligned.
    if consultation.weekday_mask[when.weekday()] != "1":
        raise HTTPException(status_code=422, detail="That day is outside the available booking days.")
    mod = _minutes_of_day(when)
    if mod < consultation.start_minute or mod + consultation.duration_minutes > consultation.end_minute:
        raise HTTPException(status_code=422, detail="That time is outside the available hours.")


async def _assert_no_overlap(db: AsyncSession, consultation: BookingConsultation, when: datetime, exclude_id: Optional[str] = None) -> None:
    dur = consultation.duration_minutes
    pad = timedelta(minutes=dur + consultation.buffer_minutes + 5)
    busy = await _active_times(db, consultation.id, when - pad, when + pad, exclude_id=exclude_id)
    for t in busy:
        if _conflicts(t, consultation, when):
            raise HTTPException(status_code=409, detail="That slot has just been taken. Please pick another time.")


async def _ensure_client(db: AsyncSession, workspace_id: str, name: str, email: str) -> Client:
    """Find-or-create a Client by email in this workspace (B3/B4). A paid
    consult needs a Client to own its invoice; a completed call needs one to
    carry the outcome forward."""
    existing = (await db.execute(
        select(Client).where(Client.workspace_id == workspace_id, func.lower(Client.email) == email.lower())
    )).scalar_one_or_none()
    if existing:
        return existing
    client = Client(workspace_id=workspace_id, name=name, email=email, status="active")
    db.add(client)
    await db.flush()
    return client


async def _no_show_count(db: AsyncSession, workspace_id: str, email: str) -> int:
    return (await db.execute(
        select(func.count(BookingAppointment.id))
        .join(BookingConsultation, BookingAppointment.consultation_id == BookingConsultation.id)
        .where(
            BookingConsultation.workspace_id == workspace_id,
            func.lower(BookingAppointment.client_email) == email.lower(),
            BookingAppointment.no_show.is_(True),
        )
    )).scalar_one() or 0


def _appt_dict(appt: BookingAppointment, consultation_title: Optional[str], invoice_token: Optional[str]) -> Dict[str, Any]:
    return {
        "id": appt.id,
        "consultation_id": appt.consultation_id,
        "consultation_title": consultation_title,
        "client_name": appt.client_name,
        "client_email": appt.client_email,
        "appointment_time": appt.appointment_time,
        "meeting_link": appt.meeting_link,
        "payment_status": appt.payment_status,
        "notes": appt.notes,
        "status": appt.status,
        "token": appt.token,
        "reschedule_count": appt.reschedule_count,
        "no_show": appt.no_show,
        "invoice_id": appt.invoice_id,
        "invoice_token": invoice_token,
        "client_id": appt.client_id,
        "created_at": appt.created_at,
    }


async def _serialize_appt(db: AsyncSession, appt: BookingAppointment) -> Dict[str, Any]:
    c = (await db.execute(select(BookingConsultation).where(BookingConsultation.id == appt.consultation_id))).scalar_one_or_none()
    inv_token = None
    if appt.invoice_id:
        inv_token = (await db.execute(select(Invoice.token).where(Invoice.id == appt.invoice_id))).scalar_one_or_none()
    return _appt_dict(appt, c.title if c else None, inv_token)


async def _consultation_by_token(db: AsyncSession, token: str) -> BookingConsultation:
    c = (await db.execute(select(BookingConsultation).where(BookingConsultation.token == token))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Booking consultation not found")
    return c


# ------------------------------------------------------------------------------
# Freelancer-side consultation CRUD + availability
# ------------------------------------------------------------------------------
@router.get("", response_model=List[BookingConsultationOut])
async def list_consultations(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(BookingConsultation).where(BookingConsultation.workspace_id == workspace.id).order_by(BookingConsultation.created_at.desc())
    consultations = (await db.execute(stmt)).scalars().all()

    # If a new workspace has none, create standard defaults in DB
    if not consultations:
        default1 = BookingConsultation(
            workspace_id=workspace.id,
            title="30-Min Strategy & Architecture Consultation",
            description="Clients pick a time on your calendar. Paid consults are only confirmed once the invoice is paid.",
            duration_minutes=30,
            price=100.0,
            meeting_provider="google_meet",
            is_active=True,
        )
        default2 = BookingConsultation(
            workspace_id=workspace.id,
            title="15-Min Free Discovery Call",
            description="Quick introductory call to qualify client leads and review project scopes.",
            duration_minutes=15,
            price=0.0,
            meeting_provider="google_meet",
            is_active=True,
        )
        db.add_all([default1, default2])
        await db.commit()
        await db.refresh(default1)
        await db.refresh(default2)
        consultations = [default1, default2]

    counts = dict((await db.execute(
        select(BookingAppointment.consultation_id, func.count(BookingAppointment.id))
        .where(BookingAppointment.consultation_id.in_([c.id for c in consultations]))
        .group_by(BookingAppointment.consultation_id)
    )).all())

    return [
        {
            "id": c.id, "workspace_id": c.workspace_id, "title": c.title,
            "description": c.description, "duration_minutes": c.duration_minutes,
            "price": c.price, "meeting_provider": c.meeting_provider,
            "is_active": c.is_active, "token": c.token,
            "appointments_count": counts.get(c.id, 0),
            "weekday_mask": c.weekday_mask, "start_minute": c.start_minute,
            "end_minute": c.end_minute, "timezone": c.timezone,
            "min_lead_hours": c.min_lead_hours, "max_advance_days": c.max_advance_days,
            "buffer_minutes": c.buffer_minutes, "intake_form_id": c.intake_form_id,
            "no_show_limit": c.no_show_limit, "created_at": c.created_at,
        }
        for c in consultations
    ]


@router.post("", response_model=BookingConsultationOut, status_code=status.HTTP_201_CREATED)
async def create_consultation(
    payload: BookingConsultationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)

    if payload.intake_form_id:
        form = (await db.execute(
            select(IntakeForm).where(IntakeForm.id == payload.intake_form_id, IntakeForm.workspace_id == workspace.id)
        )).scalar_one_or_none()
        if not form:
            raise HTTPException(status_code=400, detail="Specified intake form does not exist in your workspace")

    consultation = BookingConsultation(
        workspace_id=workspace.id,
        title=payload.title,
        description=payload.description,
        duration_minutes=payload.duration_minutes,
        price=payload.price,
        meeting_provider=payload.meeting_provider,
        is_active=payload.is_active,
        weekday_mask=payload.weekday_mask,
        start_minute=payload.start_minute,
        end_minute=payload.end_minute,
        timezone=payload.timezone,
        min_lead_hours=payload.min_lead_hours,
        max_advance_days=payload.max_advance_days,
        buffer_minutes=payload.buffer_minutes,
        intake_form_id=payload.intake_form_id,
        no_show_limit=payload.no_show_limit,
    )
    db.add(consultation)
    await db.commit()
    await db.refresh(consultation)

    return {
        "id": consultation.id, "workspace_id": consultation.workspace_id,
        "title": consultation.title, "description": consultation.description,
        "duration_minutes": consultation.duration_minutes, "price": consultation.price,
        "meeting_provider": consultation.meeting_provider, "is_active": consultation.is_active,
        "token": consultation.token, "appointments_count": 0,
        "weekday_mask": consultation.weekday_mask, "start_minute": consultation.start_minute,
        "end_minute": consultation.end_minute, "timezone": consultation.timezone,
        "min_lead_hours": consultation.min_lead_hours, "max_advance_days": consultation.max_advance_days,
        "buffer_minutes": consultation.buffer_minutes, "intake_form_id": consultation.intake_form_id,
        "no_show_limit": consultation.no_show_limit, "created_at": consultation.created_at,
    }


@router.put("/{consultation_id}", response_model=BookingConsultationOut)
async def update_consultation(
    consultation_id: str,
    payload: BookingConsultationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    consultation = (await db.execute(
        select(BookingConsultation).where(
            BookingConsultation.id == consultation_id,
            BookingConsultation.workspace_id == workspace.id,
        )
    )).scalar_one_or_none()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    if payload.intake_form_id:
        form = (await db.execute(
            select(IntakeForm).where(IntakeForm.id == payload.intake_form_id, IntakeForm.workspace_id == workspace.id)
        )).scalar_one_or_none()
        if not form:
            raise HTTPException(status_code=400, detail="Specified intake form does not exist in your workspace")

    for field in (
        "title", "description", "duration_minutes", "price", "meeting_provider",
        "is_active", "weekday_mask", "start_minute", "end_minute", "timezone",
        "min_lead_hours", "max_advance_days", "buffer_minutes", "intake_form_id",
        "no_show_limit",
    ):
        setattr(consultation, field, getattr(payload, field))
    await db.commit()
    await db.refresh(consultation)

    count = (await db.execute(
        select(func.count(BookingAppointment.id)).where(BookingAppointment.consultation_id == consultation.id)
    )).scalar_one() or 0
    return {
        "id": consultation.id, "workspace_id": consultation.workspace_id,
        "title": consultation.title, "description": consultation.description,
        "duration_minutes": consultation.duration_minutes, "price": consultation.price,
        "meeting_provider": consultation.meeting_provider, "is_active": consultation.is_active,
        "token": consultation.token, "appointments_count": count,
        "weekday_mask": consultation.weekday_mask, "start_minute": consultation.start_minute,
        "end_minute": consultation.end_minute, "timezone": consultation.timezone,
        "min_lead_hours": consultation.min_lead_hours, "max_advance_days": consultation.max_advance_days,
        "buffer_minutes": consultation.buffer_minutes, "intake_form_id": consultation.intake_form_id,
        "no_show_limit": consultation.no_show_limit, "created_at": consultation.created_at,
    }


@router.delete("/{consultation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_consultation(
    consultation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    consultation = (await db.execute(
        select(BookingConsultation).where(
            BookingConsultation.id == consultation_id,
            BookingConsultation.workspace_id == workspace.id,
        )
    )).scalar_one_or_none()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    await db.delete(consultation)
    await db.commit()
    return None


# ------------------------------------------------------------------------------
# B2 — blackout days ("away this week")
# ------------------------------------------------------------------------------
@router.get("/{consultation_id}/blocked-days")
async def list_blocked_days(
    consultation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    consultation = (await db.execute(
        select(BookingConsultation).where(
            BookingConsultation.id == consultation_id,
            BookingConsultation.workspace_id == workspace.id,
        )
    )).scalar_one_or_none()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    rows = (await db.execute(
        select(BookingBlockedDay.date).where(BookingBlockedDay.consultation_id == consultation.id).order_by(BookingBlockedDay.date)
    )).all()
    return {"blocked_days": [r[0].isoformat() for r in rows]}


@router.post("/{consultation_id}/blocked-days", status_code=status.HTTP_201_CREATED)
async def add_blocked_day(
    consultation_id: str,
    date: datetime = Query(..., description="YYYY-MM-DD day to block"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    consultation = (await db.execute(
        select(BookingConsultation).where(
            BookingConsultation.id == consultation_id,
            BookingConsultation.workspace_id == workspace.id,
        )
    )).scalar_one_or_none()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    day = date.date()
    existing = (await db.execute(
        select(BookingBlockedDay).where(
            BookingBlockedDay.consultation_id == consultation.id,
            BookingBlockedDay.date == day,
        )
    )).scalar_one_or_none()
    if existing:
        return {"blocked_days": [day.isoformat()], "already": True}
    db.add(BookingBlockedDay(consultation_id=consultation.id, workspace_id=workspace.id, date=day))
    await db.commit()
    return {"blocked_days": [day.isoformat()]}


@router.delete("/{consultation_id}/blocked-days", status_code=status.HTTP_204_NO_CONTENT)
async def remove_blocked_day(
    consultation_id: str,
    date: datetime = Query(..., description="YYYY-MM-DD day to unblock"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    consultation = (await db.execute(
        select(BookingConsultation).where(
            BookingConsultation.id == consultation_id,
            BookingConsultation.workspace_id == workspace.id,
        )
    )).scalar_one_or_none()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    row = (await db.execute(
        select(BookingBlockedDay).where(
            BookingBlockedDay.consultation_id == consultation.id,
            BookingBlockedDay.date == date.date(),
        )
    )).scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.commit()
    return None


# ------------------------------------------------------------------------------
# Freelancer appointments list + B6 agenda
# ------------------------------------------------------------------------------
@router.get("/appointments", response_model=List[BookingAppointmentOut])
async def list_appointments(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = (
        select(BookingAppointment, BookingConsultation.title)
        .join(BookingConsultation, BookingAppointment.consultation_id == BookingConsultation.id)
        .where(BookingConsultation.workspace_id == workspace.id)
        .order_by(BookingAppointment.appointment_time.desc())
    )
    if status_filter:
        stmt = stmt.where(BookingAppointment.status == status_filter)
    rows = (await db.execute(stmt)).all()

    invoice_ids = [a.invoice_id for a, _ in rows if a.invoice_id]
    tokens: Dict[str, str] = {}
    if invoice_ids:
        inv_rows = (await db.execute(
            select(Invoice.id, Invoice.token).where(Invoice.id.in_(invoice_ids))
        )).all()
        tokens = {r[0]: r[1] for r in inv_rows}

    return [_appt_dict(a, title, tokens.get(a.invoice_id)) for a, title in rows]


@router.get("/agenda", response_model=BookingAgendaOut)
async def get_agenda(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """B6: a live clock, not a list. next_call carries a server-derived
    hours_to_next so the client render never calls Date.now()."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    now = datetime.utcnow()
    today_start = datetime.combine(now.date(), time.min)
    today_end = today_start + timedelta(days=1)
    week_end = now + timedelta(days=7)

    ws_ids = select(BookingConsultation.id).where(BookingConsultation.workspace_id == workspace.id)

    upcoming = (await db.execute(
        select(BookingAppointment, BookingConsultation.title)
        .join(BookingConsultation, BookingAppointment.consultation_id == BookingConsultation.id)
        .where(
            BookingAppointment.consultation_id.in_(ws_ids),
            BookingAppointment.status.in_(("pending", "confirmed")),
            BookingAppointment.appointment_time >= now,
        )
        .order_by(BookingAppointment.appointment_time.asc())
        .limit(1)
    )).all()

    invoice_ids = [a.invoice_id for a, _ in upcoming if a.invoice_id]
    tokens: Dict[str, str] = {}
    if invoice_ids:
        inv_rows = (await db.execute(
            select(Invoice.id, Invoice.token).where(Invoice.id.in_(invoice_ids))
        )).all()
        tokens = {r[0]: r[1] for r in inv_rows}

    next_call = None
    hours_to_next = None
    if upcoming:
        appt, title = upcoming[0]
        next_call = BookingAppointmentOut(**_appt_dict(appt, title, tokens.get(appt.invoice_id)))
        hours_to_next = round((appt.appointment_time - now).total_seconds() / 3600.0, 1)

    today_rows = (await db.execute(
        select(BookingAppointment, BookingConsultation.title)
        .join(BookingConsultation, BookingAppointment.consultation_id == BookingConsultation.id)
        .where(
            BookingAppointment.consultation_id.in_(ws_ids),
            BookingAppointment.status.in_(_ACTIVE_STATUSES),
            BookingAppointment.appointment_time >= today_start,
            BookingAppointment.appointment_time < today_end,
        )
        .order_by(BookingAppointment.appointment_time.asc())
    )).all()
    today_calls = [BookingAppointmentOut(**_appt_dict(a, title, None)) for a, title in today_rows]

    week_booked = (await db.execute(
        select(func.count(BookingAppointment.id))
        .where(
            BookingAppointment.consultation_id.in_(ws_ids),
            BookingAppointment.status.in_(_ACTIVE_STATUSES),
            BookingAppointment.appointment_time >= now,
            BookingAppointment.appointment_time < week_end,
        )
    )).scalar_one() or 0

    # Available capacity this week = open slots still on offer across active
    # consultations (bounded by the same generator the public page uses).
    week_available = 0
    consultations = (await db.execute(
        select(BookingConsultation).where(
            BookingConsultation.workspace_id == workspace.id,
            BookingConsultation.is_active.is_(True),
        )
    )).scalars().all()
    for c in consultations:
        slots = await _compute_slots(db, c, now, days=min(7, c.max_advance_days))
        week_available += len(slots)

    no_show_count = (await db.execute(
        select(func.count(BookingAppointment.id))
        .where(BookingAppointment.consultation_id.in_(ws_ids), BookingAppointment.no_show.is_(True))
    )).scalar_one() or 0

    return BookingAgendaOut(
        next_call=next_call,
        hours_to_next=hours_to_next,
        today_calls=today_calls,
        week_booked=week_booked,
        week_available=min(week_available, 999),
        no_show_count=no_show_count,
        prepayment_required=False,
    )


@router.post("/appointments/{appointment_id}/status", response_model=BookingAppointmentOut)
async def update_appointment_status(
    appointment_id: str,
    payload: BookingAppointmentStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """B3: freelancer marks confirmed / cancelled / no_show / completed. A
    completed call promotes the person to a Client record so their outcome is
    trackable and billable."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    appt = (await db.execute(
        select(BookingAppointment)
        .join(BookingConsultation, BookingAppointment.consultation_id == BookingConsultation.id)
        .where(BookingAppointment.id == appointment_id, BookingConsultation.workspace_id == workspace.id)
    )).scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    new_status = payload.status
    appt.status = new_status
    if new_status == "no_show":
        appt.no_show = True
    if new_status == "cancelled":
        appt.cancelled_at = datetime.utcnow()
    if new_status == "completed":
        client = await _ensure_client(db, workspace.id, appt.client_name, appt.client_email)
        appt.client_id = client.id
    await db.commit()
    await db.refresh(appt)
    return await _serialize_appt(db, appt)


# ------------------------------------------------------------------------------
# Public (token) routes
# ------------------------------------------------------------------------------
@router.get("/public/{token}", response_model=PublicBookingConsultationOut)
async def get_public_consultation(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    consultation = await _consultation_by_token(db, token)
    workspace = (await db.execute(select(Workspace).where(Workspace.id == consultation.workspace_id))).scalar_one_or_none()

    intake_token = None
    if consultation.intake_form_id:
        intake_token = (await db.execute(
            select(IntakeForm.token).where(IntakeForm.id == consultation.intake_form_id)
        )).scalar_one_or_none()

    return {
        "id": consultation.id,
        "title": consultation.title,
        "description": consultation.description,
        "duration_minutes": consultation.duration_minutes,
        "price": consultation.price,
        "freelancer_name": workspace.name if workspace else "",
        "token": consultation.token,
        "created_at": consultation.created_at,
        "timezone": consultation.timezone,
        "weekday_mask": consultation.weekday_mask,
        "start_minute": consultation.start_minute,
        "end_minute": consultation.end_minute,
        "min_lead_hours": consultation.min_lead_hours,
        "max_advance_days": consultation.max_advance_days,
        "buffer_minutes": consultation.buffer_minutes,
        "requires_payment": consultation.price > 0,
        "intake_form_id": consultation.intake_form_id,
        "intake_token": intake_token,
    }


async def _compute_slots(db: AsyncSession, consultation: BookingConsultation, now: datetime, days: int) -> List[datetime]:
    """B1/B2: derive conflict-free open slots for the next `days` days from the
    weekday window minus blocked days and already-booked times, honouring the
    min-lead guard."""
    horizon = max(1, min(days, _SLOT_HORIZON_CAP, consultation.max_advance_days))
    blocked = await _blocked_dates(db, consultation.id)
    lo = now
    hi = now + timedelta(days=horizon + 1)
    busy = await _active_times(db, consultation.id, lo - timedelta(days=1), hi + timedelta(days=1))

    step = consultation.duration_minutes + consultation.buffer_minutes
    if step <= 0:
        step = consultation.duration_minutes
    earliest = now + timedelta(hours=consultation.min_lead_hours)

    slots: List[datetime] = []
    for offset in range(horizon + 1):
        day = (now + timedelta(days=offset)).date()
        if consultation.weekday_mask[day.weekday()] != "1":
            continue
        if day in blocked:
            continue
        minute = consultation.start_minute
        while minute + consultation.duration_minutes <= consultation.end_minute:
            when = datetime.combine(day, time(minute // 60, minute % 60))
            if when >= earliest and when <= hi:
                if not any(_conflicts(t, consultation, when) for t in busy):
                    slots.append(when)
                    if len(slots) >= _MAX_SLOTS_PER_RESPONSE:
                        return slots
            minute += step
    return slots


@router.get("/public/{token}/slots", response_model=BookingSlotsOut)
async def get_public_slots(
    token: str,
    days: int = Query(14, ge=1, le=60),
    db: AsyncSession = Depends(get_db)
):
    """The public page polls this every ~15s so a just-taken slot disappears
    before a second client can click it (B1)."""
    consultation = await _consultation_by_token(db, token)
    now = datetime.utcnow()
    slots = await _compute_slots(db, consultation, now, days=days)
    return BookingSlotsOut(consultation_token=consultation.token, timezone=consultation.timezone, slots=slots)


@router.post("/public/{token}/schedule", response_model=BookingAppointmentOut, status_code=status.HTTP_201_CREATED)
async def schedule_public_appointment(
    token: str,
    payload: PublicAppointmentCreate,
    db: AsyncSession = Depends(get_db)
):
    """B1: every slot is re-validated server-side inside this transaction, and
    overlap is re-checked against live data so a bot or a stale tab cannot
    double-book or book a past/absurd date. B4: a paid slot stays unpaid until
    its invoice is actually settled."""
    consultation = await _consultation_by_token(db, token)
    if not consultation.is_active:
        raise HTTPException(status_code=409, detail="This consultation is not accepting bookings.")

    now = datetime.utcnow()
    when = payload.appointment_time
    _validate_slot_rules(consultation, when, now)

    blocked = await _blocked_dates(db, consultation.id)
    if when.date() in blocked:
        raise HTTPException(status_code=422, detail="That day is unavailable.")

    # B6 no-show strikes: once a person is at/over the limit, a *free* slot is
    # refused so their next booking must be a paid one (prepayment enforced via
    # B4). A paid consultation always takes payment regardless.
    if consultation.price <= 0:
        strikes = await _no_show_count(db, consultation.workspace_id, payload.client_email)
        if strikes >= consultation.no_show_limit:
            raise HTTPException(
                status_code=409,
                detail="Too many missed calls. Please book a paid consultation to continue.",
            )

    # Overlap re-check inside the transaction (single source of truth for the
    # just-taken race).
    await _assert_no_overlap(db, consultation, when)

    meeting_link = f"https://meet.google.com/{consultation.token[:3]}-{consultation.token[3:7]}-{consultation.token[7:10]}"
    is_paid = consultation.price > 0

    appointment = BookingAppointment(
        consultation_id=consultation.id,
        client_name=payload.client_name,
        client_email=payload.client_email,
        appointment_time=when,
        meeting_link=meeting_link,
        notes=payload.notes,
        # token drives the self-reschedule / view route (B3)
        token=uuid.uuid4().hex,
        status="pending" if is_paid else "confirmed",
        payment_status="unpaid" if is_paid else "free",
    )
    db.add(appointment)
    await db.flush()

    invoice_token = None
    if is_paid:
        client = await _ensure_client(db, consultation.workspace_id, payload.client_name, payload.client_email)
        appointment.client_id = client.id
        number = f"CONSULT-{datetime.utcnow():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}"
        invoice = Invoice(
            workspace_id=consultation.workspace_id,
            client_id=client.id,
            invoice_number=number,
            status="sent",
            issue_date=now,
            due_date=when,
            total_amount=consultation.price,
            notes=f"Consultation: {consultation.title}",
            items=[InvoiceItem(
                description=f"{consultation.title} ({consultation.duration_minutes} min)",
                quantity=1,
                unit_price=consultation.price,
                amount=consultation.price,
            )],
        )
        db.add(invoice)
        await db.flush()
        appointment.invoice_id = invoice.id
        invoice_token = invoice.token
    await db.commit()
    await db.refresh(appointment)

    # Durable "reminder 24h before" + a new 1h nudge (B6). The payment-confirmed
    # flow (B4) is driven by the invoice.paid event, handled in booking_jobs.
    await emit("booking.scheduled", {
        "appointment_id": appointment.id,
        "consultation_id": consultation.id,
        "workspace_id": consultation.workspace_id,
        "client_name": appointment.client_name,
        "client_email": appointment.client_email,
        "appointment_time": appointment.appointment_time.isoformat(),
        "meeting_link": appointment.meeting_link,
        "consultation_title": consultation.title,
    })

    return _appt_dict(appointment, consultation.title, invoice_token)


@router.get("/public/appointments/{appt_token}", response_model=PublicAppointmentOut)
async def get_public_appointment(
    appt_token: str,
    db: AsyncSession = Depends(get_db)
):
    """B3: the client's own appointment view via its scoped token."""
    appt = (await db.execute(
        select(BookingAppointment).where(BookingAppointment.token == appt_token)
    )).scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    consultation = (await db.execute(
        select(BookingConsultation).where(BookingConsultation.id == appt.consultation_id)
    )).scalar_one_or_none()
    invoice_token = None
    if appt.invoice_id:
        invoice_token = (await db.execute(
            select(Invoice.token).where(Invoice.id == appt.invoice_id)
        )).scalar_one_or_none()
    return PublicAppointmentOut(
        consultation_title=consultation.title if consultation else None,
        consultation_token=consultation.token if consultation else None,
        client_name=appt.client_name,
        appointment_time=appt.appointment_time,
        status=appt.status,
        payment_status=appt.payment_status,
        meeting_link=appt.meeting_link,
        reschedule_count=appt.reschedule_count,
        max_reschedules=MAX_RESCHEDULES,
        invoice_token=invoice_token,
    )


@router.post("/public/appointments/{appt_token}/reschedule", response_model=PublicAppointmentOut)
async def reschedule_public_appointment(
    appt_token: str,
    payload: BookingRescheduleRequest,
    db: AsyncSession = Depends(get_db)
):
    """B3: token-scoped self-reschedule to another server-validated slot, with a
    capped reschedule window."""
    appt = (await db.execute(
        select(BookingAppointment).where(BookingAppointment.token == appt_token)
    )).scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appt.status in ("cancelled", "completed", "no_show"):
        raise HTTPException(status_code=409, detail=f"This appointment is {appt.status} and can not be rescheduled.")
    if appt.reschedule_count >= MAX_RESCHEDULES:
        raise HTTPException(
            status_code=409,
            detail=f"Reschedule limit reached ({MAX_RESCHEDULES}). Please contact the freelancer directly.",
        )

    consultation = (await db.execute(
        select(BookingConsultation).where(BookingConsultation.id == appt.consultation_id)
    )).scalar_one_or_none()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    now = datetime.utcnow()
    when = payload.appointment_time
    _validate_slot_rules(consultation, when, now)
    blocked = await _blocked_dates(db, consultation.id)
    if when.date() in blocked:
        raise HTTPException(status_code=422, detail="That day is unavailable.")
    # Exclude the appointment's own current slot from the overlap test.
    await _assert_no_overlap(db, consultation, when, exclude_id=appt.id)

    appt.appointment_time = when
    appt.reschedule_count += 1
    await db.commit()
    await db.refresh(appt)

    await emit("booking.scheduled", {
        "appointment_id": appt.id,
        "consultation_id": consultation.id,
        "workspace_id": consultation.workspace_id,
        "client_name": appt.client_name,
        "client_email": appt.client_email,
        "appointment_time": appt.appointment_time.isoformat(),
        "meeting_link": appt.meeting_link,
        "consultation_title": consultation.title,
    })

    invoice_token = None
    if appt.invoice_id:
        invoice_token = (await db.execute(
            select(Invoice.token).where(Invoice.id == appt.invoice_id)
        )).scalar_one_or_none()
    return PublicAppointmentOut(
        consultation_title=consultation.title,
        consultation_token=consultation.token,
        client_name=appt.client_name,
        appointment_time=appt.appointment_time,
        status=appt.status,
        payment_status=appt.payment_status,
        meeting_link=appt.meeting_link,
        reschedule_count=appt.reschedule_count,
        max_reschedules=MAX_RESCHEDULES,
        invoice_token=invoice_token,
    )
