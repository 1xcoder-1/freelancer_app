"""Read-only automation state for the dashboard Automations page.

Surfaces what the background workflows are currently doing for this
workspace: overdue protection totals, reminder pipeline coverage, and the
active email provider. Pure aggregates — no job-mutating endpoints here.
"""

from datetime import datetime, timedelta
from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_authenticated_user
from app.core.config import settings
from app.core.database import get_db
from app.core.workspace import get_or_create_user_workspace
from app.models.booking import BookingAppointment, BookingConsultation
from app.models.finance import Invoice
from app.services.email_service import provider_name

router = APIRouter(prefix="/automations", tags=["Automations"])


@router.get("/state")
async def get_automation_state(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    now = datetime.utcnow()

    # Single conditional-aggregate pass over this workspace's invoices
    # (same CASE/FILTER pattern the optimized dashboard stats use).
    inv_row = (
        await db.execute(
            select(
                func.count(Invoice.id).filter(Invoice.status == "overdue"),
                func.coalesce(func.sum(Invoice.total_amount).filter(Invoice.status == "overdue"), 0.0),
                func.count(Invoice.id).filter(Invoice.status == "sent"),
            ).where(Invoice.workspace_id == workspace.id)
        )
    ).one()
    overdue_count, overdue_amount, sent_count = inv_row

    upcoming_count = (
        await db.scalar(
            select(func.count(BookingAppointment.id))
            .join(BookingConsultation, BookingAppointment.consultation_id == BookingConsultation.id)
            .where(
                BookingConsultation.workspace_id == workspace.id,
                BookingAppointment.appointment_time >= now,
                BookingAppointment.appointment_time < now + timedelta(days=7),
            )
        )
        or 0
    )

    return {
        "enabled": settings.INNGEST_ENABLED,
        "overdue_scan_cron": "0 6 * * *",
        "reminder_grace_days": 4,
        "booking_reminder_lead_hours": 24,
        "overdue_invoice_count": int(overdue_count),
        "overdue_invoice_amount": float(overdue_amount),
        "sent_unpaid_count": int(sent_count),
        "upcoming_appointments_7d_count": int(upcoming_count),
        "email_provider": provider_name(),
        "web_app_url": settings.WEB_APP_URL,
        "timestamp": now.isoformat(),
    }
