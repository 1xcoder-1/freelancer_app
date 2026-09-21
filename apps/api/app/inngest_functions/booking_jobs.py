"""Inngest durable workflow for booking: 24h-before appointment reminders."""

from datetime import datetime, timedelta

import inngest

from app.core.inngest_client import inngest_client
from app.services.email_service import build_booking_reminder_email, send_email

REMINDER_LEAD_HOURS = 24


@inngest_client.create_function(
    fn_id="booking.reminder-24h",
    trigger=inngest.TriggerEvent(event="booking.scheduled"),
)
async def booking_reminder_24h(ctx: inngest.Context, step: inngest.Step) -> dict:
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
        await step.sleep_until("wait-until-24h-before", wake_at)

    async def _send() -> dict:
        subject, text, html = build_booking_reminder_email(
            client_name=str(data.get("client_name") or "there"),
            consultation_title=str(data.get("consultation_title") or "your consultation"),
            appointment_time=appointment_time,
            meeting_link=data.get("meeting_link") or None,
        )
        return await send_email(to=str(client_email), subject=subject, text=text, html=html)

    result = await step.run("send-booking-reminder", _send)
    ctx.logger.info(f"Booking reminder delivered via {result.get('provider')}")
    return {"sent": True, "provider": result.get("provider")}
