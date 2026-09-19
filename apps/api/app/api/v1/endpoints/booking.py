from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.core.database import get_db
from app.core.auth import require_authenticated_user
from app.core.workspace import get_or_create_user_workspace
from app.models.booking import BookingConsultation, BookingAppointment
from app.models.workspace import Workspace
from app.schemas.domain import (
    BookingConsultationCreate,
    BookingConsultationOut,
    PublicBookingConsultationOut,
    BookingAppointmentCreate,
    BookingAppointmentOut,
)

router = APIRouter(prefix="/booking", tags=["Booking & Consultation Calendar"])

@router.get("", response_model=List[BookingConsultationOut])
async def list_consultations(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(BookingConsultation).where(BookingConsultation.workspace_id == workspace.id).order_by(BookingConsultation.created_at.desc())
    result = await db.execute(stmt)
    consultations = result.scalars().all()

    # If new workspace has none, create standard defaults in DB
    if not consultations:
        default1 = BookingConsultation(
            workspace_id=workspace.id,
            title="30-Min Strategy & Architecture Consultation",
            description="Clients pick a time on your calendar and must pay before the meeting is confirmed.",
            duration_minutes=30,
            price=100.0,
            meeting_provider="google_meet",
            is_active=True
        )
        default2 = BookingConsultation(
            workspace_id=workspace.id,
            title="15-Min Free Discovery Call",
            description="Quick introductory call to qualify client leads and review project scopes.",
            duration_minutes=15,
            price=0.0,
            meeting_provider="google_meet",
            is_active=True
        )
        db.add_all([default1, default2])
        await db.commit()
        await db.refresh(default1)
        await db.refresh(default2)
        consultations = [default1, default2]

    out = []
    for c in consultations:
        app_stmt = select(func.count(BookingAppointment.id)).where(BookingAppointment.consultation_id == c.id)
        app_res = await db.execute(app_stmt)
        count = app_res.scalar_one() or 0

        out.append({
            "id": c.id,
            "workspace_id": c.workspace_id,
            "title": c.title,
            "description": c.description,
            "duration_minutes": c.duration_minutes,
            "price": c.price,
            "meeting_provider": c.meeting_provider,
            "is_active": c.is_active,
            "token": c.token,
            "appointments_count": count,
            "created_at": c.created_at
        })
    return out

@router.post("", response_model=BookingConsultationOut, status_code=status.HTTP_201_CREATED)
async def create_consultation(
    payload: BookingConsultationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)

    consultation = BookingConsultation(
        workspace_id=workspace.id,
        title=payload.title,
        description=payload.description,
        duration_minutes=payload.duration_minutes,
        price=payload.price,
        meeting_provider=payload.meeting_provider,
        is_active=payload.is_active
    )
    db.add(consultation)
    await db.commit()
    await db.refresh(consultation)

    return {
        "id": consultation.id,
        "workspace_id": consultation.workspace_id,
        "title": consultation.title,
        "description": consultation.description,
        "duration_minutes": consultation.duration_minutes,
        "price": consultation.price,
        "meeting_provider": consultation.meeting_provider,
        "is_active": consultation.is_active,
        "token": consultation.token,
        "appointments_count": 0,
        "created_at": consultation.created_at
    }

@router.delete("/{consultation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_consultation(
    consultation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(BookingConsultation).where(
        BookingConsultation.id == consultation_id,
        BookingConsultation.workspace_id == workspace.id
    )
    result = await db.execute(stmt)
    consultation = result.scalar_one_or_none()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    await db.delete(consultation)
    await db.commit()
    return None

@router.get("/appointments", response_model=List[BookingAppointmentOut])
async def list_appointments(
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
    result = await db.execute(stmt)
    rows = result.all()

    out = []
    for appt, c_title in rows:
        out.append({
            "id": appt.id,
            "consultation_id": appt.consultation_id,
            "consultation_title": c_title,
            "client_name": appt.client_name,
            "client_email": appt.client_email,
            "appointment_time": appt.appointment_time,
            "meeting_link": appt.meeting_link,
            "payment_status": appt.payment_status,
            "notes": appt.notes,
            "created_at": appt.created_at
        })
    return out

@router.get("/public/{token}", response_model=PublicBookingConsultationOut)
async def get_public_consultation(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(BookingConsultation).where(BookingConsultation.token == token)
    result = await db.execute(stmt)
    consultation = result.scalar_one_or_none()
    if not consultation:
        raise HTTPException(status_code=404, detail="Booking consultation not found")

    w_res = await db.execute(select(Workspace).where(Workspace.id == consultation.workspace_id))
    workspace = w_res.scalar_one_or_none()

    return {
        "id": consultation.id,
        "title": consultation.title,
        "description": consultation.description,
        "duration_minutes": consultation.duration_minutes,
        "price": consultation.price,
        "freelancer_name": workspace.name if workspace else "Freelancer",
        "token": consultation.token,
        "created_at": consultation.created_at
    }

@router.post("/public/{token}/schedule", response_model=BookingAppointmentOut, status_code=status.HTTP_201_CREATED)
async def schedule_public_appointment(
    token: str,
    payload: BookingAppointmentCreate,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(BookingConsultation).where(BookingConsultation.token == token)
    result = await db.execute(stmt)
    consultation = result.scalar_one_or_none()
    if not consultation:
        raise HTTPException(status_code=404, detail="Booking consultation not found")

    # Generate auto meeting link
    meeting_link = f"https://meet.google.com/{consultation.token[:3]}-{consultation.token[3:7]}-{consultation.token[7:10]}"
    payment_status = "paid" if consultation.price > 0 else "free"

    appointment = BookingAppointment(
        consultation_id=consultation.id,
        client_name=payload.client_name,
        client_email=payload.client_email,
        appointment_time=payload.appointment_time,
        meeting_link=meeting_link,
        payment_status=payment_status,
        notes=payload.notes
    )
    db.add(appointment)
    await db.commit()
    await db.refresh(appointment)

    return {
        "id": appointment.id,
        "consultation_id": appointment.consultation_id,
        "consultation_title": consultation.title,
        "client_name": appointment.client_name,
        "client_email": appointment.client_email,
        "appointment_time": appointment.appointment_time,
        "meeting_link": appointment.meeting_link,
        "payment_status": appointment.payment_status,
        "notes": appointment.notes,
        "created_at": appointment.created_at
    }
