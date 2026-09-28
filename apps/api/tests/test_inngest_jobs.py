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

import pytest

from app.inngest_functions.booking_jobs import booking_reminder_24h
from app.inngest_functions.calendar_jobs import google_calendar_sync
from app.inngest_functions.invoice_jobs import invoice_overdue_scan, invoice_reminder_4d
from app.inngest_functions.contract_jobs import contract_reminder_3d
from app.inngest_functions.proposal_jobs import proposal_reminder_3d
from app.inngest_functions.project_jobs import project_status_scan


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
    google_calendar_sync,
    invoice_overdue_scan,
    invoice_reminder_4d,
    contract_reminder_3d,
    proposal_reminder_3d,
    project_status_scan,
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
async def test_contract_reminder_3d_entrypoint_runs():
    # Missing required fields -> returns immediately without emailing.
    result = await contract_reminder_3d._handler(_make_ctx({}))
    assert result.get("skipped") is True


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

