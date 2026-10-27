"""Inngest durable workflow for Task Management due-date alerts.

The hourly scan walks every open task card whose ``due_date`` has arrived or
passed and appends one inbox alert per (card, kind, due_date) — through the
same ``notifications.push_notification`` write path the invoice/contract
producers use, so the SSE stream and the sidebar badge light up with no
extra wiring. Alerts deep-link to the board
(``/dashboard/planner/tasks/{board_id}``).

Cards have no status transition to hide behind the way invoices do ('sent' ->
'overdue' happens exactly once, which is the invoice scan's implicit dedupe),
so idempotency here is explicit: every task alert row carries a
``notifications.dedupe_key`` — ``task-due:<card_id>:<kind>:<due_date>`` —
guarded by a unique partial index. The inverse step auto-resolves: the inbox
has no 'resolved' lifecycle (rows are only read or dismissed), so an alert
whose condition no longer holds (card completed, deleted, or its due_date
moved out of the overdue/today window) has its still-unread row swept.
"""

from datetime import date, datetime

import inngest
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.inngest_client import inngest_client
from app.models.notification import Notification
from app.models.task_management import TaskCard
from app.services.notify import push_notification
from app.services.realtime import publish_changed

# Dotted kinds, matching the existing producers the inbox UI styles by prefix
# ('invoice.paid', 'contract.signed', ...). Unmapped kinds fall back to the
# inbox's default glyph, so these render fine even before the UI learns them.
TASK_DUE_TODAY_KIND = "task.due_today"
TASK_OVERDUE_KIND = "task.overdue"

_TASK_KINDS = (TASK_DUE_TODAY_KIND, TASK_OVERDUE_KIND)


def _as_date(value) -> date | None:
    if value is None:
        return None
    return value.date() if isinstance(value, datetime) else value


def _alert_key(card_id: str, kind: str, due: date) -> str:
    """Stable idempotency key: one alert per (card, kind, due_date). A card
    whose due date moves forward and comes due again later gets a fresh key —
    and therefore a fresh alert — which is the intended behaviour."""
    return f"task-due:{card_id}:{kind}:{due.isoformat()}"


async def scan_task_due_alerts(session, now: datetime | None = None) -> dict:
    """Hourly sweep: create due-today/overdue alerts, sweep the stale ones.

    Module-level (not inside the step closure) so the hermetic test suite can
    run it directly against a session — the established seam, same as
    ``mark_overdue_invoices``. Idempotent: keyed rows already present (read or
    unread) are skipped, so the dev-startup reconcile and the hourly cron can
    both call it without ever double-alerting."""
    today = (now or datetime.utcnow()).date()

    # Open cards at or past their due date. Completed and future-due cards are
    # absent from this result, so their stale alerts fall out of `live_keys`
    # below and get swept by the auto-resolve pass.
    res = await session.execute(
        select(TaskCard).where(
            TaskCard.completed.is_(False),
            TaskCard.due_date.is_not(None),
            TaskCard.due_date <= today,
        )
    )
    live_keys: dict[str, dict] = {}
    for card in res.scalars().all():
        due = _as_date(card.due_date)
        if due is None:
            continue
        kind = TASK_DUE_TODAY_KIND if due == today else TASK_OVERDUE_KIND
        days_overdue = (today - due).days
        live_keys[_alert_key(card.id, kind, due)] = {
            "workspace_id": card.workspace_id,
            "kind": kind,
            "title": (
                f"Task due today: {card.title}"
                if kind == TASK_DUE_TODAY_KIND
                else f"Task overdue: {card.title}"
            ),
            "body": (
                "Due today — open the board to keep the day on track."
                if kind == TASK_DUE_TODAY_KIND
                else f"{days_overdue} day(s) past due — open the board to complete or reschedule it."
            ),
            "link": f"/dashboard/planner/tasks/{card.board_id}",
        }

    # Dedupe: a key that already has ANY row (read or unread) never re-alerts.
    # The unique partial index is the race safety net if the dev-startup
    # reconcile and the cron overlap — push_notification's savepoint absorbs
    # the collision and the caller's commit is unaffected.
    created = 0
    if live_keys:
        res = await session.execute(
            select(Notification.dedupe_key).where(
                Notification.dedupe_key.in_(list(live_keys.keys()))
            )
        )
        existing = set(res.scalars().all())
        for key, payload in live_keys.items():
            if key in existing:
                continue
            await push_notification(
                session,
                payload["workspace_id"],
                payload["kind"],
                payload["title"],
                body=payload["body"],
                link=payload["link"],
                dedupe_key=key,
            )
            created += 1

    # Auto-resolve: delete still-unread task alerts that no longer apply —
    # the card was completed, deleted, or its due_date moved out of the
    # overdue/today window (including forward, then back: a new due date is a
    # new key and alerts afresh, per the one-alert-per-(card, kind, due_date)
    # rule). Read rows are history the user has already seen and stay.
    resolved = 0
    resolved_workspaces: set[str] = set()
    res = await session.execute(
        select(Notification).where(
            Notification.kind.in_(_TASK_KINDS),
            Notification.is_read.is_(False),
            Notification.dedupe_key.is_not(None),
        )
    )
    for notification in res.scalars().all():
        if notification.dedupe_key in live_keys:
            continue
        resolved_workspaces.add(notification.workspace_id)
        await session.delete(notification)
        resolved += 1

    await session.commit()

    # Rows created via push_notification ping their workspace's SSE stream
    # through its delayed fan-out; deletions bypass that helper, so ping the
    # affected workspaces here (the commit has landed — the client's refetch
    # really sees the removal).
    for workspace_id in resolved_workspaces:
        publish_changed(workspace_id)

    return {"created": created, "resolved": resolved}


@inngest_client.create_function(
    # Hourly, off the */15 calendar-sync grid and the invoice scan's :15 — a
    # lapsed card should surface in the inbox within the hour, like invoices.
    fn_id="task.due-alert-scan",
    trigger=inngest.TriggerCron(cron="50 * * * *"),
)
async def task_due_alert_scan(ctx: inngest.Context) -> dict:
    """Hourly sweep: one inbox alert per open task card due today / overdue."""

    async def _scan() -> dict:
        async with AsyncSessionLocal() as session:
            return await scan_task_due_alerts(session)

    result = await ctx.step.run("scan-task-due-alerts", _scan)
    ctx.logger.info(
        f"Task due alert scan finished: {result['created']} created, "
        f"{result['resolved']} resolved"
    )
    return result
