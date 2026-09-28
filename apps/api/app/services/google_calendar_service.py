"""Google Calendar integration service (optional per-user OAuth connection).

Deliberately dependency-light: plain OAuth + Calendar REST calls over httpx
(no google-api-python-client). The app only READS the user's calendar
(calendar.readonly scope) and mirrors events into our own `calendar_events`
table, so revoking access at Google fully de-provisions the feature.

Token lifecycle: Google issues a long-lived refresh_token (access_type=offline);
the short-lived access_token is cached on the connection row and refreshed
lazily whenever it is missing/expired before an API call.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.calendar import CalendarEvent, GoogleCalendarConnection

AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
# Read-only: we mirror events into our DB, we never write to Google.
CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly"

GOOGLE_TOKEN_EXPIRY_SKEW = timedelta(minutes=5)


class GoogleCalendarError(Exception):
    """Raised for any Google OAuth/API failure with a safe user-facing message."""


def is_configured() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def build_auth_url(state: str) -> str:
    """Consent-screen URL for the connect flow. `state` is persisted on the
    connection row and re-checked on callback (CSRF protection)."""
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": CALENDAR_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    }
    return f"{AUTH_BASE_URL}?{urlencode(params)}"


async def exchange_code_for_tokens(code: str) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.post(TOKEN_URL, data={
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        })
    if res.status_code != 200:
        raise GoogleCalendarError(f"Google rejected the authorization code (HTTP {res.status_code})")
    return res.json()


async def refresh_access_token(conn: GoogleCalendarConnection) -> str:
    """Refresh (or return the still-valid cached) access token for a connection."""
    now = datetime.utcnow()
    if conn.access_token and conn.access_token_expires_at and conn.access_token_expires_at > now + GOOGLE_TOKEN_EXPIRY_SKEW:
        return conn.access_token

    if not conn.refresh_token:
        raise GoogleCalendarError("Google Calendar connection is missing its refresh token — reconnect required")

    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.post(TOKEN_URL, data={
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "refresh_token": conn.refresh_token,
            "grant_type": "refresh_token",
        })
    if res.status_code != 200:
        raise GoogleCalendarError(f"Google token refresh failed (HTTP {res.status_code}) — reconnect required")

    payload = res.json()
    conn.access_token = payload["access_token"]
    conn.access_token_expires_at = now + timedelta(seconds=int(payload.get("expires_in", 3600)))
    return conn.access_token


def _parse_google_instant(value: Optional[Dict[str, Any]]) -> Optional[datetime]:
    """Google returns either dateTime (RFC3339 with offset) or date (all-day)."""
    if not value:
        return None
    raw = value.get("dateTime") or value.get("date")
    if not raw:
        return None
    try:
        if "T" in raw:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            # Normalize to naive UTC to match the rest of the app's storage
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return datetime.strptime(raw, "%Y-%m-%d")
    except ValueError:
        return None


async def fetch_google_events(access_token: str, time_min: datetime, time_max: datetime) -> List[Dict[str, Any]]:
    """All events on the user's primary calendar in [time_min, time_max), UTC."""
    events: List[Dict[str, Any]] = []
    page_token: Optional[str] = None
    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            params: Dict[str, Any] = {
                "singleEvents": "true",
                "orderBy": "startTime",
                "timeMin": time_min.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "timeMax": time_max.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
            if page_token:
                params["pageToken"] = page_token
            res = await client.get(CALENDAR_EVENTS_URL, params=params, headers={"Authorization": f"Bearer {access_token}"})
            if res.status_code != 200:
                raise GoogleCalendarError(f"Google Calendar API error (HTTP {res.status_code})")
            body = res.json()
            events.extend(body.get("items", []))
            page_token = body.get("nextPageToken")
            if not page_token:
                break
    return events


def _map_event_fields(google_event: Dict[str, Any]) -> Dict[str, Any]:
    start = _parse_google_instant(google_event.get("start"))
    end = _parse_google_instant(google_event.get("end"))
    if start is None or end is None:
        return {}
    # Google's all-day end is exclusive — pull it back one day so the chip
    # lands on the right date in inclusive-range queries.
    if google_event.get("start", {}).get("date"):
        end = end - timedelta(days=1)

    conferencing = (google_event.get("conferences") or [{}])[0].get("conferenceData") or {}
    meeting_link = conferencing.get("entryPoints", [{}])[0].get("uri") if conferencing.get("entryPoints") else None
    meeting_link = meeting_link or google_event.get("hangoutsLink") or google_event.get("htmlLink")

    return {
        "title": (google_event.get("summary") or "(Untitled event)")[:255],
        "description": google_event.get("description"),
        "start_time": start,
        "end_time": end,
        "is_all_day": bool(google_event.get("start", {}).get("date")),
        "meeting_link": meeting_link,
        "google_calendar_id": google_event.get("organizer", {}).get("email") if google_event.get("organizer") else None,
    }


async def sync_connection(session: AsyncSession, conn: GoogleCalendarConnection) -> Dict[str, int]:
    """Mirror Google events into calendar_events (upsert + soft-delete).

    Shared by the manual "Sync now" endpoint and the Inngest cron job so both
    paths use identical logic against the real DB.
    """
    access_token = await refresh_access_token(conn)
    now = datetime.utcnow()
    time_min = now - timedelta(days=settings.GOOGLE_SYNC_LOOKBACK_DAYS)
    time_max = now + timedelta(days=settings.GOOGLE_SYNC_LOOKAHEAD_DAYS)
    google_events = await fetch_google_events(access_token, time_min, time_max)

    seen_ids: List[str] = []
    created = updated = 0
    for ge in google_events:
        gid = ge.get("id")
        if not gid:
            continue
        # Cancelled events never enter the mirror; they are soft-deleted below
        # because their id is absent from `seen_ids`.
        if ge.get("status") == "cancelled":
            continue
        mapped = _map_event_fields(ge)
        if not mapped:
            continue
        seen_ids.append(gid)

        res = await session.execute(
            select(CalendarEvent).where(CalendarEvent.google_event_id == gid)
        )
        event = res.scalar_one_or_none()
        if event is None:
            session.add(CalendarEvent(
                workspace_id=conn.workspace_id,
                source="google",
                event_type="meeting",
                google_event_id=gid,
                **mapped,
            ))
            created += 1
        else:
            for key, value in mapped.items():
                setattr(event, key, value)
            event.is_deleted = False
            updated += 1

    # Soft-delete mirrored events that vanished from the synced window/cancelled
    res = await session.execute(
        select(CalendarEvent).where(
            CalendarEvent.workspace_id == conn.workspace_id,
            CalendarEvent.source == "google",
            CalendarEvent.is_deleted == False,  # noqa: E712
        )
    )
    deleted = 0
    for event in res.scalars().all():
        if event.google_event_id not in seen_ids:
            event.is_deleted = True
            deleted += 1

    conn.last_synced_at = datetime.utcnow()
    await session.commit()
    return {"created": created, "updated": updated, "deleted": deleted}
