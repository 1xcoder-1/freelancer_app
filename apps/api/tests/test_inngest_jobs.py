"""Regression guard for the Inngest function *entrypoints*.

The other job tests call the module-level helpers (sync_all_connections,
mark_overdue_invoices) directly, which is exactly how a broken decorated
function slipped through: the SDK executes the async handler as
`await handler(ctx)` (inngest v0.5.x), but the handlers were declared
`async def fn(ctx, step)` — so every real invocation (the */15 calendar cron,
at minimum) crashed with
`TypeError: ... missing 1 required positional argument: 'step'`, which the SDK
surfaces as HTTP 500 and the Dev Server retries until the run fails.

These tests drive the actual `_handler` coroutines the way the SDK does, with a
stub ctx whose step helper runs the passed callable. They assert the handler
takes exactly one `ctx` argument AND that it runs to completion, so a future
signature/body mistake fails here instead of in production.
"""

import logging
import types
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.inngest_functions.booking_jobs import (
    booking_reminder_24h,
    booking_reminder_1h,
)
from app.inngest_functions.calendar_jobs import google_calendar_sync
from app.inngest_functions.invoice_jobs import invoice_overdue_scan, invoice_reminder_4d
from app.inngest_functions.lead_jobs import lead_proposal_expiry_scan
from app.inngest_functions.contract_jobs import contract_reminder_3d, contract_expiry_scan
from app.inngest_functions.proposal_jobs import proposal_reminder_3d
from app.inngest_functions.project_jobs import project_status_scan, project_task_day_scan
from app.inngest_functions.task_jobs import scan_task_due_alerts, task_due_alert_scan
from app.models.notification import Notification


class _StubStep:
    async def run(self, _name, fn):
        return await fn()

    async def sleep_until(self, _name, _until):
        return None


def _make_ctx(event_data=None):
    return types.SimpleNamespace(
        step=_StubStep(),
        logger=logging.getLogger("inngest-test"),
        event=types.SimpleNamespace(data=event_data or {}),
    )


ALL_FUNCTIONS = [
    booking_reminder_24h,
    booking_reminder_1h,
    google_calendar_sync,
    invoice_overdue_scan,
    invoice_reminder_4d,
    lead_proposal_expiry_scan,
    contract_reminder_3d,
    contract_expiry_scan,
    proposal_reminder_3d,
    project_status_scan,
    project_task_day_scan,
    task_due_alert_scan,
]


@pytest.mark.parametrize("fn", ALL_FUNCTIONS, ids=lambda f: f.get_id())
def test_handler_signature_takes_only_ctx(fn):
    # The SDK calls `await handler(ctx)`; a stray `step` param is a hard TypeError.
    params = list(fn._handler.__code__.co_varnames[: fn._handler.__code__.co_argcount])
    assert params == ["ctx"], f"{fn.get_id()} handler must accept exactly (ctx)"


@pytest.mark.asyncio
async def test_google_calendar_sync_entrypoint_runs():
    assert await google_calendar_sync._handler(_make_ctx()) is not None


@pytest.mark.asyncio
async def test_invoice_overdue_scan_entrypoint_runs():
    result = await invoice_overdue_scan._handler(_make_ctx())
    assert result["marked_overdue"] == 0


@pytest.mark.asyncio
async def test_lead_proposal_expiry_scan_entrypoint_runs():
    # No proposals in the throwaway schema -> nothing expired, no crash.
    result = await lead_proposal_expiry_scan._handler(_make_ctx())
    assert result["expired"] == 0


@pytest.mark.asyncio
async def test_invoice_reminder_4d_entrypoint_runs():
    # No due date / unknown invoice -> sleep is stubbed and the check short-circuits.
    result = await invoice_reminder_4d._handler(_make_ctx({"invoice_id": "missing"}))
    assert result.get("skipped") is True


@pytest.mark.asyncio
async def test_booking_reminder_24h_entrypoint_runs():
    # Missing required fields -> returns immediately without emailing.
    result = await booking_reminder_24h._handler(_make_ctx({}))
    assert result.get("skipped") is True


@pytest.mark.asyncio
async def test_booking_reminder_1h_entrypoint_runs():
    # B6 nudge: missing required fields -> returns immediately without emailing.
    result = await booking_reminder_1h._handler(_make_ctx({}))
    assert result.get("skipped") is True


@pytest.mark.asyncio
async def test_contract_reminder_3d_entrypoint_runs():
    # Missing required fields -> returns immediately without emailing.
    result = await contract_reminder_3d._handler(_make_ctx({}))
    assert result.get("skipped") is True


@pytest.mark.asyncio
async def test_contract_expiry_scan_entrypoint_runs():
    # N2: empty throwaway schema -> nothing expired, but the sweep + emit must run.
    result = await contract_expiry_scan._handler(_make_ctx())
    assert result["expired"] == 0


@pytest.mark.asyncio
async def test_proposal_reminder_3d_entrypoint_runs():
    # Missing required fields -> returns immediately without emailing.
    result = await proposal_reminder_3d._handler(_make_ctx({}))
    assert result.get("skipped") is True


@pytest.mark.asyncio
async def test_project_status_scan_entrypoint_runs():
    result = await project_status_scan._handler(_make_ctx())
    assert "active_projects_count" in result
    assert "pending_milestones_count" in result


@pytest.mark.asyncio
async def test_project_task_day_scan_entrypoint_runs():
    # P4 briefing: empty throwaway schema -> zero buckets, but the handler must
    # run through the collect step + guarded emit without raising.
    result = await project_task_day_scan._handler(_make_ctx())
    assert result["overdue_count"] == 0
    assert result["due_today_count"] == 0


@pytest.mark.asyncio
async def test_task_due_alert_scan_entrypoint_runs():
    # Empty throwaway schema -> nothing due, nothing stale, no crash.
    result = await task_due_alert_scan._handler(_make_ctx())
    assert result["created"] == 0
    assert result["resolved"] == 0


# ---- task due-date alerts: create / dedupe / auto-resolve -------------------

async def _make_board(client) -> str:
    """Drive the public API like the UI: create a board (creation seeds the
    default lists) and return (board_id, first_list_id)."""
    res = await client.post("/api/v1/tasks/boards", json={"name": "Alerts Board"})
    assert res.status_code == 201, res.text
    board_id = res.json()["id"]
    res = await client.get(f"/api/v1/tasks/boards/{board_id}/full")
    assert res.status_code == 200, res.text
    return board_id, res.json()["lists"][0]["id"]


async def _make_card(client, list_id: str, title: str, due) -> str:
    res = await client.post(
        f"/api/v1/tasks/lists/{list_id}/cards",
        json={"title": title, "due_date": due.isoformat()},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


@pytest.mark.asyncio
async def test_task_due_alerts_created_deduped_and_resolved(client):
    # Dates are cut on the UTC calendar — the same clock the scan uses — so
    # the buckets are deterministic regardless of the test machine's timezone.
    today = datetime.utcnow().date()
    yesterday = today - timedelta(days=1)

    board_id, list_id = await _make_board(client)
    today_card = await _make_card(client, list_id, "Ship the landing page", today)
    overdue_card = await _make_card(client, list_id, "Old follow-up", yesterday)

    async with AsyncSessionLocal() as session:
        result = await scan_task_due_alerts(session)
    assert result["created"] == 2
    assert result["resolved"] == 0

    async with AsyncSessionLocal() as session:
        rows = (
            await session.execute(select(Notification).order_by(Notification.kind))
        ).scalars().all()
    by_kind = {n.kind: n for n in rows}
    assert set(by_kind) == {"task.due_today", "task.overdue"}

    due_today = by_kind["task.due_today"]
    assert due_today.title == "Task due today: Ship the landing page"
    # Deep link goes to the BOARD, through the same `link` field every other
    # producer uses (the inbox router.pushes it verbatim).
    assert due_today.link == f"/dashboard/planner/tasks/{board_id}"
    assert due_today.dedupe_key == f"task-due:{today_card}:task.due_today:{today.isoformat()}"
    assert due_today.is_read is False

    overdue = by_kind["task.overdue"]
    assert overdue.title == "Task overdue: Old follow-up"
    assert overdue.link == f"/dashboard/planner/tasks/{board_id}"
    assert overdue.dedupe_key == f"task-due:{overdue_card}:task.overdue:{yesterday.isoformat()}"

    # Idempotent: the dev-startup reconcile after the cron must not re-alert.
    async with AsyncSessionLocal() as session:
        again = await scan_task_due_alerts(session)
    assert again == {"created": 0, "resolved": 0}

    # Auto-resolve: completing the overdue card sweeps its unread alert, and
    # pushing the due-today card out of the window sweeps its alert too.
    res = await client.patch(f"/api/v1/tasks/cards/{overdue_card}", json={"completed": True})
    assert res.status_code == 200, res.text
    future = (today + timedelta(days=5)).isoformat()
    res = await client.patch(f"/api/v1/tasks/cards/{today_card}", json={"due_date": future})
    assert res.status_code == 200, res.text

    async with AsyncSessionLocal() as session:
        result = await scan_task_due_alerts(session)
    assert result == {"created": 0, "resolved": 2}

    async with AsyncSessionLocal() as session:
        remaining = (
            await session.execute(
                select(Notification).where(
                    Notification.kind.in_(("task.due_today", "task.overdue")),
                    Notification.is_read.is_(False),
                )
            )
        ).scalars().all()
    assert remaining == []


@pytest.mark.asyncio
async def test_task_alert_rescheduled_back_onto_a_day_alerts_afresh(client):
    """One alert per (card, kind, due_date): a card moved forward and later
    brought back due gets a NEW alert (fresh key), not a resurrected one."""
    today = datetime.utcnow().date()
    board_id, list_id = await _make_board(client)
    card_id = await _make_card(client, list_id, "Reschedule me", today)

    async with AsyncSessionLocal() as session:
        assert (await scan_task_due_alerts(session))["created"] == 1

    res = await client.patch(
        f"/api/v1/tasks/cards/{card_id}",
        json={"due_date": (today + timedelta(days=3)).isoformat()},
    )
    assert res.status_code == 200, res.text
    async with AsyncSessionLocal() as session:
        assert (await scan_task_due_alerts(session))["resolved"] == 1

    # Back onto today: the old key was swept, so a fresh alert is created.
    res = await client.patch(
        f"/api/v1/tasks/cards/{card_id}", json={"due_date": today.isoformat()}
    )
    assert res.status_code == 200, res.text
    async with AsyncSessionLocal() as session:
        result = await scan_task_due_alerts(session)
    assert result == {"created": 1, "resolved": 0}

