"""Phase 4 — Leads productivity (L1 next-up queue, L2 start-work cascade,
L3 loss reasons, L4 proposal expiry, L5 response speed, L6 source revenue).

Hermetic by convention: HTTP-driven against the throwaway SQLite schema, and the
proposal-expiry cron is exercised through its module-level helper directly, like
the other job tests.
"""

from datetime import datetime, timedelta

from app.core.database import AsyncSessionLocal
from app.inngest_functions.lead_jobs import expire_stale_proposals
from app.models.proposal import Proposal


async def _make_lead(client, email="deal@nova.test", **over):
    payload = {
        "name": "Nova Ltd", "email": email, "company": "Nova Ltd",
        "stage": "proposal", "estimated_value": 3000.0, "source": "Referral",
    }
    payload.update(over)
    res = await client.post("/api/v1/leads", json=payload)
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _make_proposal(client, title="Web Rebuild", budget=2500.0, expires_at=None, status="sent", **over):
    payload = {
        "title": title, "client_scope": "Rebuild the marketing site", "budget": budget,
        "pitch_content": "A detailed pitch for the engagement.", "status": status,
    }
    if expires_at is not None:
        payload["expires_at"] = expires_at
    payload.update(over)
    res = await client.post("/api/v1/proposals", json=payload)
    assert res.status_code == 201, res.text
    return res.json()


# ------------------------------------------------------------------------------
# L2 — start-work cascade (F3)
# ------------------------------------------------------------------------------
async def test_start_work_creates_full_cascade(client):
    lid = await _make_lead(client, "win@cascade.test", estimated_value=5000.0)
    res = await client.post(
        f"/api/v1/leads/{lid}/start-work",
        json={"create_invoice": True, "create_contract": True},
    )
    assert res.status_code == 201, res.text
    out = res.json()
    assert out["client_id"] and out["project_id"]
    assert out["contract_id"] and out["invoice_id"]
    assert out["reused_client"] is False

    # The lead is kept and flipped to won (never deleted — L2 preserves history).
    lead = next(l for l in (await client.get("/api/v1/leads")).json() if l["id"] == lid)
    assert lead["stage"] == "won"

    # Project inherits the estimated value as budget.
    proj = (await client.get(f"/api/v1/projects/{out['project_id']}")).json()
    assert proj["budget"] == 5000.0
    assert proj["client_id"] == out["client_id"]

    # Client row exists in the roster.
    roster = (await client.get("/api/v1/clients")).json()
    assert any(c["id"] == out["client_id"] for c in roster)


async def test_start_work_reuses_client_by_email(client):
    lid = await _make_lead(client, "dup@cascade.test", estimated_value=2000.0)
    first = (await client.post(f"/api/v1/leads/{lid}/start-work", json={})).json()
    # Re-run: the client must be email-deduped, not duplicated.
    second = (await client.post(f"/api/v1/leads/{lid}/start-work", json={})).json()
    assert second["reused_client"] is True
    assert second["client_id"] == first["client_id"]
    roster = (await client.get("/api/v1/clients")).json()
    assert sum(1 for c in roster if c["id"] == first["client_id"]) == 1


async def test_start_work_is_workspace_isolated(client, client_b):
    lid = await _make_lead(client, "iso@cascade.test")
    assert (await client_b.post(f"/api/v1/leads/{lid}/start-work", json={})).status_code == 404


# ------------------------------------------------------------------------------
# L3 — loss reason enum (and SE8 stage-only transitions)
# ------------------------------------------------------------------------------
async def test_close_lost_requires_structured_reason(client):
    lid = await _make_lead(client, "lost@nova.test")
    # A loss with no reason is exactly the L3 blind spot; rejected.
    assert (await client.post(f"/api/v1/leads/{lid}/close", json={"outcome": "lost"})).status_code == 422
    # An unknown reason is not a silent insert.
    assert (await client.post(f"/api/v1/leads/{lid}/close", json={"outcome": "lost", "reason": "vibes"})).status_code == 422
    # A whitelisted reason closes the deal.
    res = await client.post(f"/api/v1/leads/{lid}/close", json={"outcome": "lost", "reason": "price", "note": "budget mismatch"})
    assert res.status_code == 200, res.text
    assert res.json()["reason_lost"] == "price"


async def test_won_cannot_arrive_through_generic_patch(client):
    lid = await _make_lead(client, "se8@nova.test")
    # SE8: won/lost are excluded from the PATCH whitelist → 422, no client spawn.
    assert (await client.patch(f"/api/v1/leads/{lid}", json={"stage": "won"})).status_code == 422


# ------------------------------------------------------------------------------
# L4 — proposal expiry boundary (module helper + accept block)
# ------------------------------------------------------------------------------
async def test_expire_stale_proposals_boundary(client):
    past = await _make_proposal(client, title="Old", expires_at=(datetime.utcnow() - timedelta(days=2)).isoformat())
    future = await _make_proposal(client, title="Fresh", expires_at=(datetime.utcnow() + timedelta(days=5)).isoformat())

    async with AsyncSessionLocal() as session:
        out = await expire_stale_proposals(session, now=datetime.utcnow())
    assert out["expired"] == 1

    async with AsyncSessionLocal() as session:
        p_past = await session.get(Proposal, past["id"])
        p_future = await session.get(Proposal, future["id"])
    assert p_past.status == "expired"
    assert p_future.status == "sent"


async def test_expired_proposal_cannot_be_accepted(client):
    expired = await _make_proposal(client, title="Stale", expires_at=(datetime.utcnow() - timedelta(days=1)).isoformat())
    res = await client.patch(f"/api/v1/proposals/{expired['id']}/status", json={"status": "accepted"})
    assert res.status_code == 410


# ------------------------------------------------------------------------------
# L1 / L5 / L6 — insights queue + speed + source revenue
# ------------------------------------------------------------------------------
async def test_insights_next_up_and_source_revenue(client):
    # A won deal from Referral feeds L6 source revenue.
    lid = await _make_lead(client, "won@insights.test", estimated_value=4200.0, source="Referral")
    await client.post(f"/api/v1/leads/{lid}/close", json={"outcome": "won"})

    # A due follow-up feeds the L1 next-up queue.
    cold = await _make_lead(client, "due@insights.test", estimated_value=1800.0,
                            next_follow_up_at=(datetime.utcnow() - timedelta(hours=1)).isoformat())
    assert cold

    # A proposal awaiting reply also belongs in the queue.
    await _make_proposal(client, title="Awaiting", budget=900.0,
                         expires_at=(datetime.utcnow() + timedelta(days=7)).isoformat())

    body = (await client.get("/api/v1/leads/insights")).json()

    types = {item["type"] for item in body["next_up"]}
    assert "follow_up" in types and "proposal_reply" in types
    # Sorted by value descending — the biggest deal floats to the top.
    values = [item["value"] for item in body["next_up"]]
    assert values == sorted(values, reverse=True)

    # L6: won revenue grouped by source, not lead count.
    src = {s["source"]: s for s in body["source_revenue"]}
    assert src["Referral"]["won_value"] == 4200.0 and src["Referral"]["won_count"] == 1

    # L5: response-speed block is present (derived shape).
    assert "response_speed" in body and "median_days_to_close" in body["response_speed"]
