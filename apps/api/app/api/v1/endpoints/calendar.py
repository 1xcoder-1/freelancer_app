"""Dashboard Calendar API — live, DB-backed calendar feed + Google sync.

The feed merges, at query time, straight from Neon:
  - calendar_events rows (user-created blocks + Google-mirrored events)
  - booking appointments (client-booked meetings, always current)
  - invoice due dates (deadline chips)

Google Calendar is an OPTIONAL per-workspace OAuth connection: connect →
callback (code exchange) → sync (manual or via the Inngest cron job in
app/inngest_functions/calendar_jobs.py). All Google data is mirrored into
our own DB so the calendar keeps working offline from Google.
"""

import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_authenticated_user
from app.core.database import get_db
from app.core.workspace import get_or_create_user_workspace
from app.models.booking import BookingAppointment, BookingConsultation
from app.models.calendar import CalendarEvent, GoogleCalendarConnection
from app.models.finance import Invoice
from app.schemas.domain import (
    CalendarEventCreate,
    CalendarEventOut,
    CalendarEventUpdate,
    CalendarFeedItem,
    CalendarSyncResult,
    GoogleCallbackPayload,
    GoogleConnectResponse,
    GoogleConnectionStatus,
)
from app.schemas.types import to_naive_utc
from app.services import google_calendar_service

router = APIRouter(prefix="/calendar", tags=["Dashboard Calendar & Google Sync"])


def _parse_range(start: str, end: str) -> tuple[datetime, datetime]:
    """Parse the feed window and put it on the DB's axis.

    Every timestamp column here is a naive UTC `timestamp`, so a tz-aware range
    (`2026-09-01T00:00:00Z` or `...+05:00`) used to reach asyncpg as an aware
    parameter and blew up with a 500 on GET /events. Normalising both bounds to
    naive UTC makes aware and naive input equally valid and comparable.
    """
    try:
        start_dt = to_naive_utc(datetime.fromisoformat(start))
        end_dt = to_naive_utc(datetime.fromisoformat(end))
    except ValueError:
        raise HTTPException(status_code=400, detail="start/end must be ISO-8601 datetimes")
    if end_dt <= start_dt:
        raise HTTPException(status_code=400, detail="end must be after start")
    # Clamp to a sane window so no request scans years of rows
    if (end_dt - start_dt).days > 366:
        raise HTTPException(status_code=400, detail="range window too large (max 366 days)")
    return start_dt, end_dt


async def _get_connection(db: AsyncSession, workspace_id: str) -> Optional[GoogleCalendarConnection]:
    res = await db.execute(
        select(GoogleCalendarConnection).where(GoogleCalendarConnection.workspace_id == workspace_id)
    )
    return res.scalar_one_or_none()


@router.get("/events", response_model=List[CalendarFeedItem])
async def list_calendar_events(
    start: str = Query(..., description="ISO-8601 range start (inclusive)"),
    end: str = Query(..., description="ISO-8601 range end (exclusive)"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Live unified calendar feed for the dashboard, computed from the DB."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    start_dt, end_dt = _parse_range(start, end)

    items: List[CalendarFeedItem] = []

    # 1) Stored events: user-created blocks + Google-mirrored rows
    ev_res = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.workspace_id == workspace.id,
            CalendarEvent.is_deleted == False,  # noqa: E712
            CalendarEvent.start_time < end_dt,
            CalendarEvent.end_time >= start_dt,
        ).order_by(CalendarEvent.start_time)
    )
    for ev in ev_res.scalars().all():
        items.append(CalendarFeedItem(
            id=ev.id, title=ev.title, description=ev.description,
            event_type=ev.event_type, start_time=ev.start_time, end_time=ev.end_time,
            is_all_day=ev.is_all_day, source=ev.source,
            client_name=ev.client_name, meeting_link=ev.meeting_link,
        ))

    # 2) Client-booked appointments (booking module stays the source of truth)
    appt_res = await db.execute(
        select(BookingAppointment, BookingConsultation.title, BookingConsultation.duration_minutes)
        .join(BookingConsultation, BookingAppointment.consultation_id == BookingConsultation.id)
        .where(
            BookingConsultation.workspace_id == workspace.id,
            BookingAppointment.appointment_time >= start_dt,
            BookingAppointment.appointment_time < end_dt,
        )
    )
    for appt, c_title, duration in appt_res.all():
        items.append(CalendarFeedItem(
            id=appt.id, title=c_title or "Client meeting",
            description=appt.notes, event_type="meeting",
            start_time=appt.appointment_time,
            end_time=appt.appointment_time + timedelta(minutes=duration or 30),
            is_all_day=False, source="booking",
            client_name=appt.client_name, meeting_link=appt.meeting_link,
            status=appt.payment_status,
        ))

    # 3) Invoice due dates → deadline chips (all-day)
    inv_res = await db.execute(
        select(Invoice).where(
            Invoice.workspace_id == workspace.id,
            Invoice.status.in_(["sent", "overdue"]),
            Invoice.due_date.is_not(None),
            Invoice.due_date >= start_dt,
            Invoice.due_date < end_dt,
        )
    )
    for inv in inv_res.scalars().all():
        due = inv.due_date if isinstance(inv.due_date, datetime) else datetime.combine(inv.due_date, datetime.min.time())
        items.append(CalendarFeedItem(
            id=inv.id, title=f"Invoice {inv.invoice_number} due",
            event_type="deadline", start_time=due, end_time=due,
            is_all_day=True, source="invoice", status=inv.status,
        ))

    items.sort(key=lambda i: i.start_time)
    return items


@router.post("/events", response_model=CalendarEventOut, status_code=status.HTTP_201_CREATED)
async def create_calendar_event(
    payload: CalendarEventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    payload.validate_range()

    event = CalendarEvent(
        workspace_id=workspace.id,
        title=payload.title,
        description=payload.description,
        event_type=payload.event_type,
        start_time=payload.start_time,
        end_time=payload.end_time,
        is_all_day=payload.is_all_day,
        client_name=payload.client_name,
        project_id=payload.project_id,
        meeting_link=payload.meeting_link,
        source="local",
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


@router.patch("/events/{event_id}", response_model=CalendarEventOut)
async def update_calendar_event(
    event_id: str,
    payload: CalendarEventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    res = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.workspace_id == workspace.id,
            CalendarEvent.source == "local",  # google rows are read-only mirrors
        )
    )
    event = res.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Calendar event not found")

    changes = payload.model_dump(exclude_unset=True)
    if changes.get("start_time") and changes.get("end_time") and changes["end_time"] < changes["start_time"]:
        raise HTTPException(status_code=400, detail="end_time must be after start_time")
    for key, value in changes.items():
        setattr(event, key, value)

    await db.commit()
    await db.refresh(event)
    return event


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_calendar_event(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    res = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.workspace_id == workspace.id,
            CalendarEvent.source == "local",
        )
    )
    event = res.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Calendar event not found")

    await db.delete(event)
    await db.commit()
    return None


# ------------------------------------------------------------------------------
# Google Calendar — optional OAuth connection + sync
# ------------------------------------------------------------------------------
@router.get("/google/status", response_model=GoogleConnectionStatus)
async def google_status(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    conn = await _get_connection(db, workspace.id)
    return GoogleConnectionStatus(
        connected=bool(conn and conn.refresh_token),
        configured=google_calendar_service.is_configured(),
        google_email=conn.google_email if conn else None,
        last_synced_at=conn.last_synced_at if conn else None,
        sync_enabled=bool(conn and conn.sync_enabled),
    )


@router.post("/google/connect", response_model=GoogleConnectResponse)
async def google_connect(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Start the OAuth dance: store a CSRF state on the connection row and
    hand the frontend the Google consent-screen URL to open."""
    if not google_calendar_service.is_configured():
        raise HTTPException(
            status_code=400,
            detail="Google Calendar integration is not configured on this server (GOOGLE_CLIENT_ID/SECRET missing)",
        )
    _, workspace = await get_or_create_user_workspace(db, current_user)

    state = secrets.token_urlsafe(24)
    conn = await _get_connection(db, workspace.id)
    if conn is None:
        conn = GoogleCalendarConnection(workspace_id=workspace.id, oauth_state=state)
        db.add(conn)
    else:
        conn.oauth_state = state
    await db.commit()

    return GoogleConnectResponse(auth_url=google_calendar_service.build_auth_url(state))


@router.post("/google/callback", response_model=GoogleConnectionStatus)
async def google_callback(
    payload: GoogleCallbackPayload,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Exchange the redirect ?code=&state= for tokens (called by the frontend
    callback page with the Clerk bearer token — keeps auth consistent), then
    run the first sync immediately so the calendar is populated right away."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    conn = await _get_connection(db, workspace.id)
    if not conn or not conn.oauth_state:
        raise HTTPException(status_code=400, detail="No pending Google Calendar connect request — start from the calendar")
    if not secrets.compare_digest(conn.oauth_state, payload.state):
        raise HTTPException(status_code=400, detail="Invalid OAuth state — please retry the connect flow")

    try:
        tokens = await google_calendar_service.exchange_code_for_tokens(payload.code)
    except google_calendar_service.GoogleCalendarError as e:
        raise HTTPException(status_code=502, detail=str(e))

    conn.refresh_token = tokens.get("refresh_token") or conn.refresh_token
    conn.access_token = tokens.get("access_token")
    if tokens.get("expires_in"):
        conn.access_token_expires_at = datetime.utcnow() + timedelta(seconds=int(tokens["expires_in"]))
    conn.google_email = tokens.get("email") or conn.google_email
    conn.oauth_state = None
    conn.sync_enabled = True
    await db.commit()

    # Immediate first sync (best-effort: connection stays usable if Google is down)
    try:
        await google_calendar_service.sync_connection(db, conn)
    except google_calendar_service.GoogleCalendarError as e:
        print(f"Initial Google Calendar sync failed for workspace {workspace.id}: {e}")

    await db.refresh(conn)
    return GoogleConnectionStatus(
        connected=True, configured=True,
        google_email=conn.google_email, last_synced_at=conn.last_synced_at,
        sync_enabled=conn.sync_enabled,
    )


@router.post("/google/sync", response_model=CalendarSyncResult)
async def google_sync(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Manual 'Sync now' — same code path as the Inngest cron job."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    conn = await _get_connection(db, workspace.id)
    if not conn or not conn.refresh_token:
        raise HTTPException(status_code=400, detail="Google Calendar is not connected for this workspace")

    try:
        result = await google_calendar_service.sync_connection(db, conn)
    except google_calendar_service.GoogleCalendarError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return CalendarSyncResult(**result, synced_at=conn.last_synced_at or datetime.utcnow())


@router.delete("/google/disconnect", status_code=status.HTTP_204_NO_CONTENT)
async def google_disconnect(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Drop tokens and the mirrored Google rows (local events are untouched)."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    conn = await _get_connection(db, workspace.id)
    if not conn:
        return None

    res = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.workspace_id == workspace.id,
            CalendarEvent.source == "google",
        )
    )
    for event in res.scalars().all():
        await db.delete(event)
    await db.delete(conn)
    await db.commit()
    return None
