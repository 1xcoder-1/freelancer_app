"""Inngest durable workflow: periodic Google Calendar → DB mirroring.

Runs every 15 minutes and syncs every workspace that connected Google
Calendar (and left sync enabled), so the dashboard calendar stays fresh
without the user pressing "Sync now". Each connection is isolated: one
failing/revoked Google account never blocks the others.
"""

import inngest
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.inngest_client import inngest_client
from app.models.calendar import GoogleCalendarConnection
from app.services import google_calendar_service


async def sync_all_connections(limit: int = 100) -> dict:
    """Sync pass over every enabled connection. Module-level so the hermetic
    test suite can run it directly without going through Inngest."""
    if not google_calendar_service.is_configured():
        return {"skipped": True, "reason": "google-oauth-not-configured"}

    results = {"synced": 0, "failed": 0}
    async with AsyncSessionLocal() as session:
        res = await session.execute(
            select(GoogleCalendarConnection).where(
                GoogleCalendarConnection.sync_enabled == True,  # noqa: E712
                GoogleCalendarConnection.refresh_token.is_not(None),
            ).limit(limit)
        )
        connections = res.scalars().all()

        for conn in connections:
            try:
                await google_calendar_service.sync_connection(session, conn)
                results["synced"] += 1
            except Exception as e:  # noqa: BLE001 — one bad token must not stop the sweep
                print(f"Google Calendar sync failed for workspace {conn.workspace_id}: {e}")
                await session.rollback()
                results["failed"] += 1

    return results


@inngest_client.create_function(
    fn_id="google-calendar.sync",
    trigger=inngest.TriggerCron(cron="*/15 * * * *"),
)
async def google_calendar_sync(ctx: inngest.Context) -> dict:
    """Cron sweep: mirror Google events into calendar_events for all users."""

    async def _run() -> dict:
        return await sync_all_connections()

    result = await ctx.step.run("sync-google-calendars", _run)
    ctx.logger.info(f"Google Calendar sync sweep: {result}")
    return result
