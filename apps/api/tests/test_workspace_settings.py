"""Workspace settings now persist to the DB (not browser storage) and the
saved currency/rate flow through to the values the rest of the app reads."""

import asyncio

from app.schemas.domain import WorkspaceOut


async def test_settings_round_trip(client):
    payload = {
        "business_name": "Nova Studio",
        "professional_title": "Full-stack freelancer",
        "currency": "EUR",
        "default_hourly_rate": 95.0,
        "invoice_prefix": "NOVA-",
        "payment_terms": "Net 15",
    }
    put = await client.put("/api/v1/workspace", json=payload)
    assert put.status_code == 200, put.text

    got = await client.get("/api/v1/workspace")
    assert got.status_code == 200
    body = got.json()
    assert body["business_name"] == "Nova Studio"
    assert body["currency"] == "EUR"
    assert body["default_hourly_rate"] == 95.0
    assert body["invoice_prefix"] == "NOVA-"


async def test_partial_update_keeps_other_fields(client):
    await client.put("/api/v1/workspace", json={"currency": "GBP", "default_hourly_rate": 50.0})
    # Save only the prefix; currency must survive (exclude_unset semantics)
    await client.put("/api/v1/workspace", json={"invoice_prefix": "GBP-"})
    body = (await client.get("/api/v1/workspace")).json()
    assert body["invoice_prefix"] == "GBP-"
    assert body["currency"] == "GBP"
    assert body["default_hourly_rate"] == 50.0


async def test_currency_pattern_is_enforced(client):
    res = await client.put("/api/v1/workspace", json={"currency": "usd"})
    assert res.status_code == 422


async def test_timer_uses_workspace_default_rate(client):
    # Project with no per-project rate falls back to the saved workspace rate.
    await client.put("/api/v1/workspace", json={"default_hourly_rate": 120.0})
    res = await client.post(
        "/api/v1/projects", json={"title": "NoRate", "budget": 1000.0, "hourly_rate": 0.0}
    )
    assert res.status_code == 201
    pid = res.json()["id"]

    session = (await client.post("/api/v1/timer/start", json={"project_id": pid})).json()
    await asyncio.sleep(1.05)
    stopped = await client.post(f"/api/v1/timer/{session['id']}/stop")
    entry = stopped.json()
    assert entry is not None
    assert entry["hourly_rate"] == 120.0


async def test_legacy_null_billing_columns_do_not_500():
    """init_db adds new billing columns via raw ALTER TABLE as NULL-able with no
    DB default, so a workspace that existed before them returns NULL for
    currency / default_hourly_rate / invoice_prefix. WorkspaceOut used to type
    those as non-Optional, so response validation failed and GET /workspace
    returned a sanitized 500. They must instead fall back to the column default."""
    out = WorkspaceOut.model_validate({
        "id": "ws-1",
        "name": "Ada's Workspace",
        "slug": "ada-workspace",
        "currency": None,
        "default_hourly_rate": None,
        "invoice_prefix": None,
    })
    assert out.currency == "USD"
    assert out.default_hourly_rate == 0.0
    assert out.invoice_prefix == "INV-"
