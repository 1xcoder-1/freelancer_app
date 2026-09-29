"""Cash-Flow & Financial Runway dashboard (roadmap 1.1–1.4).

Bank balance flow, 14/30/60-day expected cash windows, weeks-of-runway
math, invoiced-vs-cleared history and the vacation reserve indicator —
plus auth, bounds validation and cross-workspace isolation on the new
`bank_balance` setting. Hermetic: public API only, own mock-token
workspaces, throwaway SQLite schema from conftest.
"""

from datetime import datetime, timedelta

from helpers import make_client


async def _bank(client, balance):
    res = await client.put("/api/v1/workspace", json={"bank_balance": balance})
    assert res.status_code == 200, res.text
    return res.json()


async def _make_invoice(client, cid, number, due, amount, status="sent"):
    res = await client.post("/api/v1/invoices", json={
        "client_id": cid,
        "invoice_number": number,
        "status": status,
        "due_date": due.isoformat(),
        "items": [{"description": "Work", "quantity": 1, "unit_price": amount}],
    })
    assert res.status_code == 201, res.text
    return res.json()["id"]


# ------------------------------------------------------------------------------
# Auth + validation on the new bank_balance setting
# ------------------------------------------------------------------------------
async def test_workspace_bank_balance_requires_auth():
    from httpx import ASGITransport, AsyncClient
    from app.main import app as fastapi_app

    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as anon:
        res = await anon.put("/api/v1/workspace", json={"bank_balance": 100})
        assert res.status_code == 401


async def test_bank_balance_bounds_are_validated(client):
    # Absurdly large / out-of-range / non-numeric values must 422 at the
    # schema, never reach the row and poison the runway math.
    for bad in (1e12, -2e7, "many"):
        res = await client.put("/api/v1/workspace", json={"bank_balance": bad})
        assert res.status_code == 422, f"{bad} returned {res.status_code}"
    res = await client.put("/api/v1/workspace", json={"bank_balance": 1500.50})
    assert res.status_code == 200
    assert res.json()["bank_balance"] == 1500.50


# ------------------------------------------------------------------------------
# Cross-workspace isolation
# ------------------------------------------------------------------------------
async def test_bank_balance_is_workspace_scoped(client, client_b):
    await _bank(client_b, 500.0)
    body = (await client.get("/api/v1/cashflow/summary")).json()
    # A's runway must never see B's balance
    assert body["bank_balance"] == 0.0
    # ...and B's write went to B's own workspace only
    assert (await client_b.get("/api/v1/cashflow/summary")).json()["bank_balance"] == 500.0


# ------------------------------------------------------------------------------
# 1.1 — cash in bank + 14/30/60 expected cash
# ------------------------------------------------------------------------------
async def test_expected_cash_windows(client):
    cid = await make_client(client)
    now = datetime.utcnow()
    await _make_invoice(client, cid, "INV-W14", now + timedelta(days=10), 100.0)
    await _make_invoice(client, cid, "INV-W45", now + timedelta(days=45), 200.0)
    await _make_invoice(client, cid, "INV-LATE", now - timedelta(days=5), 300.0, status="overdue")

    body = (await client.get("/api/v1/cashflow/summary")).json()
    # Cumulative windows over not-yet-due invoices; overdue lives in aging only.
    assert body["expected_cash"]["days_14"] == 100.0
    assert body["expected_cash"]["days_30"] == 100.0
    assert body["expected_cash"]["days_60"] == 300.0
    assert body["aging"]["days_1_15"]["amount"] == 300.0


async def test_bank_balance_flows_into_summary_with_freshness(client):
    out = await _bank(client, 1234.56)
    assert out["bank_balance_updated_at"] is not None

    body = (await client.get("/api/v1/cashflow/summary")).json()
    assert body["bank_balance"] == 1234.56
    assert body["bank_balance_updated_at"] == out["bank_balance_updated_at"]


# ------------------------------------------------------------------------------
# 1.2 — monthly burn + weeks of runway
# ------------------------------------------------------------------------------
async def test_runway_is_null_until_burn_is_known(client):
    body = (await client.get("/api/v1/cashflow/summary")).json()
    assert body["runway_weeks"] is None
    assert body["runway_weeks_with_incoming"] is None


async def test_runway_math_matches_bank_over_weekly_burn(client):
    res = await client.post("/api/v1/expenses", json={"category": "Tools", "amount": 1000.0})
    assert res.status_code == 201, res.text
    await _bank(client, 1000.0)

    body = (await client.get("/api/v1/cashflow/summary")).json()
    # 1000 logged this month spread over the 6-month average
    assert abs(body["monthly_burn_rate"] - 1000.0 / 6) < 0.02
    assert body["weekly_burn_rate"] > 0
    assert abs(body["runway_weeks"] - 1000.0 / body["weekly_burn_rate"]) < 0.2
    # Nothing open → projected reach equals current runway
    assert body["runway_weeks_with_incoming"] == body["runway_weeks"]


# ------------------------------------------------------------------------------
# 1.3 — invoiced vs cleared tracker
# ------------------------------------------------------------------------------
async def test_invoiced_vs_cleared_lands_only_when_paid(client):
    cid = await make_client(client)
    now = datetime.utcnow()
    iid = await _make_invoice(client, cid, "INV-CLEAR", now + timedelta(days=7), 250.0)

    body = (await client.get("/api/v1/cashflow/summary")).json()
    this_month = body["history_6m"][-1]
    assert this_month["invoiced"] == 250.0
    assert this_month["collected"] == 0.0

    res = await client.patch(f"/api/v1/invoices/{iid}/status", json={"status": "paid"})
    assert res.status_code == 200, res.text
    body = (await client.get("/api/v1/cashflow/summary")).json()
    this_month = body["history_6m"][-1]
    assert this_month["invoiced"] == 250.0
    assert this_month["collected"] == 250.0


# ------------------------------------------------------------------------------
# 1.4 — safe-to-spend + vacation reserve
# ------------------------------------------------------------------------------
async def test_vacation_reserve_target_and_progress(client):
    res = await client.post("/api/v1/expenses", json={"category": "Rent", "amount": 600.0})
    assert res.status_code == 201, res.text
    await _bank(client, 150.0)

    body = (await client.get("/api/v1/cashflow/summary")).json()
    assert body["vacation_reserve_target"] == round(body["avg_monthly_expenses"] * 3, 2)
    assert body["vacation_reserve_target"] > 0
    expected_pct = round(150.0 / body["vacation_reserve_target"] * 100, 1)
    assert body["vacation_reserve_progress_pct"] == expected_pct
    assert body["safe_to_spend_next_30d"] >= 0.0


async def test_vacation_reserve_caps_at_100(client):
    res = await client.post("/api/v1/expenses", json={"category": "Rent", "amount": 100.0})
    assert res.status_code == 201, res.text
    await _bank(client, 9_000_000.0)

    body = (await client.get("/api/v1/cashflow/summary")).json()
    assert body["vacation_reserve_progress_pct"] == 100.0
