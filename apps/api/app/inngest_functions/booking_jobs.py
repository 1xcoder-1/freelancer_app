"""Inngest durable workflows for booking: reminders + calendar sync.

* `booking.reminder-24h` / `booking.reminder-1h` — sleep until 24h / 1h before
  the appointment, then email the client with the meeting link (B6 extends the
  single 24h reminder to a short-notice nudge).
* `booking.google-meet-sync` / `booking.google-event-cancel` — write the
  appointment into the freelancer's connected Google Calendar with a real
  Google Meet conference, and cancel that event when the booking is cancelled.
"""

from datetime import datetime, timedelta
from typing import Optional

import inngest
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.inngest_client import inngest_client
from app.models.booking import BookingAppointment, BookingConsultation
from app.models.calendar import GoogleCalendarConnection
from app.services.email_service import (
    build_booking_nudge_email,
    build_booking_reminder_email,
    send_email,
)
from app.services.google_calendar_service import (
    GoogleCalendarError,
    create_calendar_event,
    create_meet_event,
    delete_event,
    refresh_access_token,
    update_event,
)

REMINDER_LEAD_HOURS = 24
NUDGE_LEAD_MINUTES = 60


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
        fresh_link = await _live_meeting_link(data)
        subject, text, html = build_booking_reminder_email(
            client_name=str(data.get("client_name") or "there"),
            consultation_title=str(data.get("consultation_title") or "your consultation"),
            appointment_time=appointment_time,
            meeting_link=fresh_link or None,
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
        fresh_link = await _live_meeting_link(data)
        subject, text, html = build_booking_nudge_email(
            client_name=str(data.get("client_name") or "there"),
            consultation_title=str(data.get("consultation_title") or "your consultation"),
            appointment_time=appointment_time,
            meeting_link=fresh_link or None,
        )
        return await send_email(to=str(client_email), subject=subject, text=text, html=html)

    result = await ctx.step.run("send-booking-nudge", _send)
    ctx.logger.info(f"Booking nudge delivered via {result.get('provider')}")
    return {"sent": True, "provider": result.get("provider")}


async def _live_meeting_link(data: dict) -> Optional[str]:
    """Meeting link straight from the DB — the Meet-sync job may have replaced
    the placeholder written at scheduling time with the real hangout URL."""
    appt_id = str(data.get("appointment_id") or "")
    if not appt_id:
        return data.get("meeting_link")
    try:
        async with AsyncSessionLocal() as session:
            appt = (await session.execute(
                select(BookingAppointment).where(BookingAppointment.id == appt_id)
            )).scalar_one_or_none()
            return (appt.meeting_link if appt and appt.meeting_link else data.get("meeting_link"))
    except Exception:
        return data.get("meeting_link")


async def _sync_google_event(appointment_id: str) -> dict:
    """Create (or PATCH on reschedule) the Google Calendar event with a real
    Meet link. No-op when the workspace never connected a calendar."""
    async with AsyncSessionLocal() as session:
        appt = (await session.execute(
            select(BookingAppointment).where(BookingAppointment.id == appointment_id)
        )).scalar_one_or_none()
        if appt is None:
            return {"skipped": True, "reason": "appointment-not-found"}
        consultation = (await session.execute(
            select(BookingConsultation).where(BookingConsultation.id == appt.consultation_id)
        )).scalar_one_or_none()
        if consultation is None:
            return {"skipped": True, "reason": "consultation-not-found"}
        conn = (await session.execute(
            select(GoogleCalendarConnection).where(
                GoogleCalendarConnection.workspace_id == consultation.workspace_id
            )
        )).scalar_one_or_none()
        if conn is None or not conn.refresh_token:
            return {"skipped": True, "reason": "no-google-connection"}

        end_time = appt.appointment_time + timedelta(minutes=consultation.duration_minutes)
        title = f"{consultation.title} — {appt.client_name}"
        description = (
            f"Booked via Freelance Book. Client: {appt.client_name} <{appt.client_email}>"
            + (f"\nNotes: {appt.notes}" if appt.notes else "")
        )
        access_token = await refresh_access_token(conn)

        if appt.google_event_id:
            await update_event(
                access_token,
                appt.google_event_id,
                title=title,
                start=appt.appointment_time,
                end=end_time,
                attendee_email=appt.client_email,
                attendee_name=appt.client_name,
                description=description,
            )
            action = "updated"
        elif conn.meet_enabled:
            result = await create_meet_event(
                access_token,
                title=title,
                description=description,
                start=appt.appointment_time,
                end=end_time,
                attendee_email=appt.client_email,
                attendee_name=appt.client_name,
                request_id=f"freelancebook-{appt.id}",
            )
            appt.google_event_id = result.get("google_event_id")
            if result.get("meeting_link"):
                appt.meeting_link = result["meeting_link"]
            action = "created"
        else:
            # Meet toggled off: the event still lands on Google Calendar,
            # just without a conference.
            result = await create_calendar_event(
                access_token,
                title=title,
                description=description,
                start=appt.appointment_time,
                end=end_time,
                attendee_email=appt.client_email,
                attendee_name=appt.client_name,
            )
            appt.google_event_id = result.get("google_event_id")
            action = "created"
        await session.commit()
        return {"synced": True, "action": action, "appointment_id": appt.id, "meeting_link": appt.meeting_link}


@inngest_client.create_function(
    fn_id="booking.google-meet-sync",
    trigger=inngest.TriggerEvent(event="booking.scheduled"),
)
async def booking_google_meet_sync(ctx: inngest.Context) -> dict:
    """Provision the Google Calendar event + Meet link for a new or rescheduled
    booking. Failures (revoked access, old readonly token) fall back to the
    in-app meeting link and are logged, never surfaced to the booking flow."""
    data = dict(ctx.event.data)
    appointment_id = str(data.get("appointment_id") or "")
    if not appointment_id:
        return {"skipped": True, "reason": "missing-appointment-id"}

    def _safe(err: Exception) -> dict:
        return {"skipped": True, "reason": "google-error", "detail": str(err)[:300]}

    try:
        result = await ctx.step.run("sync-google-meet-event", lambda: _sync_google_event(appointment_id))
    except GoogleCalendarError as err:
        ctx.logger.warning(f"Google Meet sync skipped for {appointment_id}: {err}")
        return _safe(err)
    ctx.logger.info(f"Google Meet sync: {result}")
    return result


async def _cancel_google_event(appointment_id: str) -> dict:
    async with AsyncSessionLocal() as session:
        appt = (await session.execute(
            select(BookingAppointment).where(BookingAppointment.id == appointment_id)
        )).scalar_one_or_none()
        if appt is None or not appt.google_event_id:
            return {"skipped": True, "reason": "no-google-event"}
        consultation = (await session.execute(
            select(BookingConsultation).where(BookingConsultation.id == appt.consultation_id)
        )).scalar_one_or_none()
        conn = (await session.execute(
            select(GoogleCalendarConnection).where(
                GoogleCalendarConnection.workspace_id == consultation.workspace_id
            )
        )).scalar_one_or_none() if consultation else None
        if conn is None or not conn.refresh_token:
            return {"skipped": True, "reason": "no-google-connection"}
        access_token = await refresh_access_token(conn)
        await delete_event(access_token, appt.google_event_id)
        await session.commit()
        return {"cancelled": True, "appointment_id": appt.id}


@inngest_client.create_function(
    fn_id="booking.google-event-cancel",
    trigger=inngest.TriggerEvent(event="booking.status-changed"),
)
async def booking_google_event_cancel(ctx: inngest.Context) -> dict:
    """When a booking is cancelled the Google event goes with it, so the
    freelancer's calendar and the client's invite stay truthful."""
    data = dict(ctx.event.data)
    if str(data.get("status") or "") != "cancelled":
        return {"skipped": True, "reason": "not-cancelled"}
    appointment_id = str(data.get("appointment_id") or "")
    if not appointment_id:
        return {"skipped": True, "reason": "missing-appointment-id"}

    try:
        result = await ctx.step.run("cancel-google-event", lambda: _cancel_google_event(appointment_id))
    except GoogleCalendarError as err:
        ctx.logger.warning(f"Google event cancel skipped for {appointment_id}: {err}")
        return {"skipped": True, "reason": "google-error", "detail": str(err)[:300]}
    ctx.logger.info(f"Google event cancel: {result}")
    return result
