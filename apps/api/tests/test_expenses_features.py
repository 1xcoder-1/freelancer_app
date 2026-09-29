"""Expenses sub-pages backend: recurring flag + safe single-row edits.

Auth, cross-workspace isolation (404, never 403/500), whitelist validation
and the subscription toggle round-trip. Hermetic: public API only against
the throwaway SQLite schema from conftest.
"""

from helpers import make_client  # noqa: F401  (kept for parity/future use)


async def _expense(client, amount=49.0, category="Software & Subscriptions", **extra):
    res = await client.post("/api/v1/expenses", json={
        "category": category,
        "amount": amount,
        "description": "Figma",
        **extra,
    })
    assert res.status_code == 201, res.text
    return res.json()


# ------------------------------------------------------------------------------
# Auth
# ------------------------------------------------------------------------------
async def test_expenses_endpoints_require_auth():
    from httpx import ASGITransport, AsyncClient
    from app.main import app as fastapi_app

    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as anon:
        assert (await anon.get("/api/v1/expenses")).status_code == 401
        assert (await anon.post("/api/v1/expenses", json={"amount": 5})).status_code == 401
        assert (await anon.patch("/api/v1/expenses/whatever", json={"is_recurring": True})).status_code == 401


# ------------------------------------------------------------------------------
# Recurring flag round-trip
# ------------------------------------------------------------------------------
async def test_expense_create_with_recurring_flag(client):
    created = await _expense(client, is_recurring=True)
    assert created["is_recurring"] is True
    listing = (await client.get("/api/v1/expenses")).json()
    assert any(e["id"] == created["id"] and e["is_recurring"] for e in listing)


async def test_expense_patch_toggles_subscription(client):
    created = await _expense(client)
    assert created["is_recurring"] is False

    res = await client.patch(f"/api/v1/expenses/{created['id']}", json={"is_recurring": True})
    assert res.status_code == 200, res.text
    assert res.json()["is_recurring"] is True

    # Toggle back — the flag is fully reversible
    res = await client.patch(f"/api/v1/expenses/{created['id']}", json={"is_recurring": False})
    assert res.json()["is_recurring"] is False


# ------------------------------------------------------------------------------
# Validation
# ------------------------------------------------------------------------------
async def test_expense_patch_bounds_are_validated(client):
    created = await _expense(client)
    for bad in (
        {"amount": -1},
        {"amount": 1e12},
        {"category": ""},
        {"category": "x" * 200},
    ):
        res = await client.patch(f"/api/v1/expenses/{created['id']}", json=bad)
        assert res.status_code == 422, f"{bad} -> {res.status_code}"

    # Unknown keys are dropped by the closed schema, never written via setattr
    res = await client.patch(
        f"/api/v1/expenses/{created['id']}", json={"workspace_id": "evil", "is_recurring": True}
    )
    assert res.status_code == 200
    assert (await client.get("/api/v1/expenses")).json()[0]["workspace_id"] == created["workspace_id"]


# ------------------------------------------------------------------------------
# Cross-workspace isolation
# ------------------------------------------------------------------------------
async def test_expense_patch_is_workspace_scoped(client, client_b):
    created = await _expense(client)

    # B cannot reach A's expense row — 404, and A's flag is untouched
    res = await client_b.patch(f"/api/v1/expenses/{created['id']}", json={"is_recurring": True})
    assert res.status_code == 404
    assert (await client.get("/api/v1/expenses")).json()[0]["is_recurring"] is False
