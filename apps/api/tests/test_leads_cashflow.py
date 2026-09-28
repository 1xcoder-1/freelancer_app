"""Lead Pipeline + Cash Flow Guard: lifecycle, isolation, validation, math.

Hermetic by convention — each test drives only the public API against the
throwaway SQLite schema from conftest, with its own mock-token workspace.
"""

from datetime import datetime, timedelta

from helpers import make_client, make_invoice


def _lead_payload(name="Nova Ltd", email="ping@nova.test", **overrides):
    payload = {
        "name": name,
        "email": email,
        "company": name,
        "stage": "new",
        "estimated_value": 2500.0,
        "priority": "high",
    }
    payload.update(overrides)
    return payload


async def _make_lead(client, **overrides):
    res = await client.post("/api/v1/leads", json=_lead_payload(**overrides))
    assert res.status_code == 201, res.text
    return res.json()["id"]


# ------------------------------------------------------------------------------
# Lead lifecycle
# ------------------------------------------------------------------------------
async def test_lead_crud_lifecycle(client):
    lid = await _make_lead(client)
    listing = (await client.get("/api/v1/leads")).json()
    assert any(l["id"] == lid for l in listing)

    res = await client.patch(f"/api/v1/leads/{lid}", json={"stage": "proposal"})
    assert res.status_code == 200, res.text
    assert res.json()["stage"] == "proposal"

    res = await client.delete(f"/api/v1/leads/{lid}")
    assert res.status_code == 204
    assert all(l["id"] != lid for l in (await client.get("/api/v1/leads")).json())


async def test_stage_is_whitelisted(client):
    lid = await _make_lead(client)
    res = await client.patch(f"/api/v1/leads/{lid}", json={"stage": "definitely_won"})
    assert res.status_code == 422


async def test_lead_validation_bounds(client):
    # Over-long name must 422 before reaching the driver (no 500s)
    res = await client.post("/api/v1/leads", json=_lead_payload(name="x" * 300))
    assert res.status_code == 422
    # Negative money is data corruption, not a deal
    res = await client.post("/api/v1/leads", json=_lead_payload(estimated_value=-5))
    assert res.status_code == 422


async def test_log_contact_stamps_touch_and_appends_note(client):
    lid = await _make_lead(client)
    # Fresh lead already has a creation touch; log another with a note + schedule
    follow_up = (datetime.utcnow() + timedelta(days=3)).isoformat()
    res = await client.post(
        f"/api/v1/leads/{lid}/log-contact",
        json={"note": "Sent case study", "next_follow_up_at": follow_up},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["last_contact_at"] is not None
    assert "Sent case study" in body["notes"]
    assert body["next_follow_up_at"] is not None


async def test_won_lead_creates_client_once(client):
    lid = await _make_lead(client, name="Bright Co", email="hire@bright.test")
    res = await client.patch(f"/api/v1/leads/{lid}", json={"stage": "won"})
    assert res.status_code == 200, res.text

    clients = (await client.get("/api/v1/clients")).json()
    matches = [c for c in clients if c["email"] == "hire@bright.test"]
    assert len(matches) == 1

    # Flipping back and forth must not duplicate the client row
    await client.patch(f"/api/v1/leads/{lid}", json={"stage": "negotiation"})
    await client.patch(f"/api/v1/leads/{lid}", json={"stage": "won"})
    clients = (await client.get("/api/v1/clients")).json()
    assert len([c for c in clients if c["email"] == "hire@bright.test"]) == 1


async def test_insights_aggregate_pipeline(client):
    await _make_lead(client, email="a@a.test", stage="proposal", estimated_value=1000.0)
    await _make_lead(client, email="b@b.test", stage="new", estimated_value=500.0)
    await _make_lead(client, email="c@c.test", stage="lost", estimated_value=900.0)

    res = await client.get("/api/v1/leads/insights")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total_leads"] == 3
    assert body["stage_counts"]["proposal"] == 1
    assert body["open_pipeline_value"] == 1500.0
    # weighted: 1000*0.50 + 500*0.10
    assert abs(body["weighted_pipeline_value"] - 550.0) < 0.01
    assert body["lost_count"] == 1


# ------------------------------------------------------------------------------
# Workspace isolation (the high-security requirement)
# ------------------------------------------------------------------------------
async def test_leads_are_isolated_between_workspaces(client, client_b):
    lid = await _make_lead(client)

    # B never sees A's lead in listings or insights
    assert (await client_b.get("/api/v1/leads")).json() == []
    assert (await client_b.get("/api/v1/leads/insights")).json()["total_leads"] == 0

    # ...and cannot read, patch, log-contact or delete it — all 404, never 200/500
    res = await client_b.get(f"/api/v1/leads?stage={_lead_payload()['stage']}")
    assert res.status_code == 200
    assert all(l["id"] != lid for l in res.json())
    assert (await client_b.patch(f"/api/v1/leads/{lid}", json={"stage": "won"})).status_code == 404
    assert (await client_b.post(f"/api/v1/leads/{lid}/log-contact", json={})).status_code == 404
    assert (await client_b.delete(f"/api/v1/leads/{lid}")).status_code == 404


# ------------------------------------------------------------------------------
# Auth requirements
# ------------------------------------------------------------------------------
async def test_leads_and_cashflow_require_auth():
    from httpx import ASGITransport, AsyncClient
    from app.main import app as fastapi_app

    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as anon:
        for url in (
            "/api/v1/leads",
            "/api/v1/leads/insights",
            "/api/v1/cashflow/summary",
        ):
            res = await anon.get(url)
            assert res.status_code == 401, f"{url} returned {res.status_code}"
        res = await anon.post("/api/v1/leads", json=_lead_payload())
        assert res.status_code == 401


# ------------------------------------------------------------------------------
# Cash Flow Guard
# ------------------------------------------------------------------------------
async def test_cashflow_aging_and_receivables(client):
    cid = await make_client(client)
    # Invoice sent with a due date 20 days in the past -> days_16_30 bucket
    past_due = datetime.utcnow() - timedelta(days=20)
    inv_payload = {
        "client_id": cid,
        "invoice_number": "INV-AGING-1",
        "status": "overdue",
        "due_date": past_due.isoformat(),
        "items": [{"description": "Sprint", "quantity": 1, "unit_price": 800.0}],
    }
    res = await client.post("/api/v1/invoices", json=inv_payload)
    assert res.status_code == 201, res.text

    body = (await client.get("/api/v1/cashflow/summary")).json()
    assert body["receivables_total"] == 800.0
    assert body["aging"]["days_16_30"]["count"] == 1
    assert body["aging"]["days_16_30"]["amount"] == 800.0
    assert body["at_risk_total"] == 0.0
    # listed in the overdue strip
    assert any(o["invoice_number"] == "INV-AGING-1" and o["days_overdue"] >= 19 for o in body["overdue_invoices"])


async def test_cashflow_safe_to_spend_and_forecast_shape(client):
    body = (await client.get("/api/v1/cashflow/summary")).json()
    assert len(body["forecast_90d"]) == 3
    assert body["safe_to_spend_next_30d"] >= 0.0
    assert len(body["history_6m"]) == 6
    for month in body["history_6m"]:
        assert {"month", "collected", "expenses", "net"} <= set(month)


async def test_paid_at_stamped_and_cleared_on_status_flow(client):
    cid = await make_client(client)
    iid = await make_invoice(client, cid, status="sent", invoice_number="INV-PAY-1")

    res = await client.patch(f"/api/v1/invoices/{iid}/status", json={"status": "paid"})
    assert res.status_code == 200, res.text
    assert res.json()["paid_at"] is not None

    # Reopening the invoice must cancel the money-in stamp
    res = await client.patch(f"/api/v1/invoices/{iid}/status", json={"status": "sent"})
    assert res.json()["paid_at"] is None

    # And the paid history reflects the re-pay for cash-flow collection math
    await client.patch(f"/api/v1/invoices/{iid}/status", json={"status": "paid"})
    body = (await client.get("/api/v1/cashflow/summary")).json()
    collected_this_month = body["history_6m"][-1]["collected"]
    assert collected_this_month >= 1200.0  # helpers.make_invoice line item
