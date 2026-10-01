"""Inngest durable workflows for booking: reminders + paid-consultation confirm.

Two event-driven functions plus a module-level helper the hermetic suite can
call directly (no Dev Server needed):

* `booking.reminder-24h` / `booking.reminder-1h` — sleep until 24h / 1h before
  the appointment, then email the client with the meeting link (B6 extends the
  single 24h reminder to a short-notice nudge).
* `booking.payment-confirmed` — flips a paid consultation to `confirmed` only
  once its invoice actually reaches `paid` (B4): the slot is never "paid"
  because a price existed, it is paid when money lands.
"""

from datetime import datetime, timedelta

import inngest
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.inngest_client import inngest_client
from app.models.booking import BookingAppointment
from app.services.email_service import (
    build_booking_nudge_email,
    build_booking_reminder_email,
    send_email,
)

REMINDER_LEAD_HOURS = 24
NUDGE_LEAD_MINUTES = 60


async def confirm_paid_appointment(session, invoice_id: str) -> dict:
    """Mark the appointment tied to a now-paid invoice as confirmed + paid (B4).

    Module-level so tests run it directly. Idempotent: a second call on an
    already-confirmed appointment changes nothing."""
    appt = (await session.execute(
        select(BookingAppointment).where(BookingAppointment.invoice_id == invoice_id)
    )).scalar_one_or_none()
    if appt is None:
        return {"updated": False, "reason": "no-appointment-for-invoice"}
    changed = False
    if appt.payment_status != "paid":
        appt.payment_status = "paid"
        changed = True
    # Only auto-confirm a pending booking; never resurrect a cancelled/no-show.
    if appt.status == "pending":
        appt.status = "confirmed"
        changed = True
    if changed:
        await session.commit()
    return {"updated": changed, "appointment_id": appt.id, "status": appt.status}


@inngest_client.create_function(
    fn_id="booking.payment-confirmed",
    trigger=inngest.TriggerEvent(event="invoice.paid"),
)
async def booking_payment_confirmed(ctx: inngest.Context) -> dict:
    data = dict(ctx.event.data)
    invoice_id = str(data.get("invoice_id", ""))
    if not invoice_id:
        return {"skipped": True, "reason": "missing-invoice-id"}

    async def _confirm() -> dict:
        async with AsyncSessionLocal() as session:
            return await confirm_paid_appointment(session, invoice_id)

    result = await ctx.step.run("confirm-paid-appointment", _confirm)
    ctx.logger.info(f"Booking payment confirmed: {result}")
    return result


@inngest_client.create_function(
    fn_id="booking.reminder-24h",
    trigger=inngest.TriggerEvent(event="booking.scheduled"),
)
async def booking_reminder_24h(ctx: inngest.Context) -> dict:
    """Sleep until 24h before the appointment, then email the client with the
    meeting link. Fires from the public scheduling endpoint, so late bookings
    (less than a day out) skip the sleep and remind immediately."""
    data = dict(ctx.event.data)
    appt_raw = data.get("appointment_time")
    client_email = data.get("client_email")
    if not appt_raw or not client_email:
        return {"skipped": True, "reason": "missing-fields"}

    appointment_time = datetime.fromisoformat(str(appt_raw))
    wake_at = appointment_time - timedelta(hours=REMINDER_LEAD_HOURS)
    if wake_at > datetime.utcnow():
        await ctx.step.sleep_until("wait-until-24h-before", wake_at)

    async def _send() -> dict:
        subject, text, html = build_booking_reminder_email(
            client_name=str(data.get("client_name") or "there"),
            consultation_title=str(data.get("consultation_title") or "your consultation"),
            appointment_time=appointment_time,
            meeting_link=data.get("meeting_link") or None,
        )
        return await send_email(to=str(client_email), subject=subject, text=text, html=html)

    result = await ctx.step.run("send-booking-reminder", _send)
    ctx.logger.info(f"Booking reminder delivered via {result.get('provider')}")
    return {"sent": True, "provider": result.get("provider")}


@inngest_client.create_function(
    fn_id="booking.reminder-1h",
    trigger=inngest.TriggerEvent(event="booking.scheduled"),
)
async def booking_reminder_1h(ctx: inngest.Context) -> dict:
    """B6 short-notice nudge: a second touch one hour before the call so a
    booked slot is impossible to forget."""
    data = dict(ctx.event.data)
    appt_raw = data.get("appointment_time")
    client_email = data.get("client_email")
    if not appt_raw or not client_email:
        return {"skipped": True, "reason": "missing-fields"}

    appointment_time = datetime.fromisoformat(str(appt_raw))
    wake_at = appointment_time - timedelta(minutes=NUDGE_LEAD_MINUTES)
    if wake_at > datetime.utcnow():
        await ctx.step.sleep_until("wait-until-1h-before", wake_at)

    async def _send() -> dict:
        subject, text, html = build_booking_nudge_email(
            client_name=str(data.get("client_name") or "there"),
            consultation_title=str(data.get("consultation_title") or "your consultation"),
            appointment_time=appointment_time,
            meeting_link=data.get("meeting_link") or None,
        )
        return await send_email(to=str(client_email), subject=subject, text=text, html=html)

    result = await ctx.step.run("send-booking-nudge", _send)
    ctx.logger.info(f"Booking nudge delivered via {result.get('provider')}")
    return {"sent": True, "provider": result.get("provider")}
