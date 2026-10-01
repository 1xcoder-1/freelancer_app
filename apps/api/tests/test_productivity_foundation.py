"""Phase 2 foundation — Interactions (F2), Revenue-at-Stake (F4), and the SE7/SE8
schema-literal hardening.

Hermetic by convention: each test drives only the public API against the
throwaway SQLite schema from conftest, with its own mock-token workspace.
"""

from datetime import datetime, timedelta

from helpers import make_client, make_project, make_invoice


async def _make_time_entry(client, project_id, seconds=3600, rate=100.0):
    res = await client.post(
        "/api/v1/time-entries",
        json={"project_id": project_id, "duration_seconds": seconds, "hourly_rate": rate, "is_billable": True},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _make_contract(client, project_id, title="MSA", content="Terms and conditions of engagement."):
    res = await client.post(
        "/api/v1/contracts",
        json={"project_id": project_id, "title": title, "content": content},
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _make_lead(client, name="Nova Ltd", email="ping@nova.test", **overrides):
    payload = {
        "name": name,
        "email": email,
        "company": name,
        "stage": "new",
        "estimated_value": 2500.0,
        "priority": "high",
    }
    payload.update(overrides)
    res = await client.post("/api/v1/leads", json=payload)
    assert res.status_code == 201, res.text
    return res.json()["id"]


# ------------------------------------------------------------------------------
# F2 — Interactions
# ------------------------------------------------------------------------------
async def test_log_client_touch_feeds_feed_and_silence_chip(client):
    cid = await make_client(client, name="Quiet Co", email="q@quiet.test")
    res = await client.post(
        "/api/v1/interactions",
        json={"person_type": "client", "person_id": cid, "kind": "call", "direction": "inbound", "summary": "Kickoff"},
    )
    assert res.status_code == 201, res.text
    created = res.json()
    assert created["kind"] == "call" and created["summary"] == "Kickoff"

    feed = (await client.get(f"/api/v1/interactions?person_type=client&person_id={cid}")).json()
    assert len(feed) == 1 and feed[0]["id"] == created["id"]

    summary = (await client.get(f"/api/v1/interactions/summary?person_type=client&person_id={cid}")).json()
    assert summary["touch_count"] == 1
    assert summary["days_since_last_touch"] == 0  # a touch logged now reads "not silent"


async def test_lead_touch_mirrors_pipeline_and_first_contact(client):
    lid = await _make_lead(client)
    lead = (await client.get(f"/api/v1/leads/{lid}")).json()
    # L5: first_contact_at is set once on create and never moves.
    assert lead["first_contact_at"] is not None

    await client.post(
        "/api/v1/interactions",
        json={"person_type": "lead", "person_id": lid, "kind": "email", "direction": "outbound", "summary": "Requote"},
    )
    after = (await client.get(f"/api/v1/leads/{lid}")).json()
    # The denormalised mirror advanced, first_contact stayed.
    assert after["last_contact_at"] is not None
    assert after["first_contact_at"] == lead["first_contact_at"]


async def test_interaction_rejects_foreign_person_and_bad_kind(client, client_b):
    cid = await make_client(client)
    # Cross-tenant id must 404, never reveal existence.
    res = await client_b.post(
        "/api/v1/interactions",
        json={"person_type": "client", "person_id": cid, "kind": "note"},
    )
    assert res.status_code == 404, res.text
    # Unknown kind is a client bug -> 422, never a silent insert.
    res = await client.post(
        "/api/v1/interactions",
        json={"person_type": "client", "person_id": cid, "kind": "carrier-pigeon"},
    )
    assert res.status_code == 422


# ------------------------------------------------------------------------------
# F4 — Revenue at stake
# ------------------------------------------------------------------------------
async def test_at_stake_sums_three_buckets(client):
    cid = await make_client(client, name="AtStake Co", email="as@stake.test")
    pid = await make_project(client, client_id=cid, budget=5000.0)
    await _make_contract(client, pid)                 # unsigned -> 5000 (project budget)
    await _make_time_entry(client, pid, seconds=7200, rate=100.0)  # 2h -> 200
    await make_invoice(client, cid, status="sent", invoice_number="INV-AS-1")  # 1200

    body = (await client.get("/api/v1/contracts/at-stake")).json()
    totals = body["totals"]
    assert totals["unsigned_contracts_value"] == 5000.0
    assert totals["unbilled_value"] == 200.0
    assert abs(totals["unbilled_hours"] - 2.0) < 0.01
    assert totals["unpaid_invoices_value"] == 1200.0
    assert totals["total_at_stake"] == 6400.0


async def test_at_stake_excludes_signed_and_draft(client):
    cid = await make_client(client, name="Done Co", email="d@done.test")
    pid = await make_project(client, client_id=cid, budget=4000.0)
    contract = await _make_contract(client, pid)
    # Signing removes the contract from the at-stake set.
    signed = await client.post(
        f"/api/v1/contracts/public/{contract['token']}/sign",
        json={"client_signature": "data:image/png;base64,AAAA"},
    )
    assert signed.status_code == 200, signed.text
    # A draft invoice is not yet receivable.
    await make_invoice(client, cid, status="draft", invoice_number="INV-DR-1")

    totals = (await client.get("/api/v1/contracts/at-stake")).json()["totals"]
    assert totals["unsigned_contracts_value"] == 0.0
    assert totals["unsigned_contracts_count"] == 0
    assert totals["unpaid_invoices_value"] == 0.0


async def test_projects_at_risk_rollup_and_tenant_scope(client, client_b):
    cid = await make_client(client, name="Risk Co", email="r@risk.test")
    pid = await make_project(client, client_id=cid, budget=3000.0)
    await _make_contract(client, pid)
    await _make_time_entry(client, pid, seconds=3600, rate=90.0)  # 90

    body = (await client.get("/api/v1/projects/at-risk")).json()
    proj = next(p for p in body["projects"] if p["project_id"] == pid)
    assert proj["unsigned_contract_value"] == 3000.0
    assert proj["unbilled_value"] == 90.0
    assert proj["total_at_risk"] == 3090.0

    # A different workspace sees none of this.
    other = (await client_b.get("/api/v1/projects/at-risk")).json()
    assert other["projects"] == []
    assert other["totals"]["total_at_stake"] == 0.0


# ------------------------------------------------------------------------------
# SE7 — client status is a Literal on update
# ------------------------------------------------------------------------------
async def test_client_update_rejects_free_text_status(client):
    cid = await make_client(client)
    res = await client.patch(f"/api/v1/clients/{cid}", json={"status": "mostly-active"})
    assert res.status_code == 422, res.text
    res = await client.patch(f"/api/v1/clients/{cid}", json={"status": "vip"})
    assert res.status_code == 200 and res.json()["status"] == "vip"


# ------------------------------------------------------------------------------
# SE8 — terminal lead stages go through the dedicated close endpoint
# ------------------------------------------------------------------------------
async def test_generic_patch_cannot_reach_terminal_stage(client):
    lid = await _make_lead(client)
    res = await client.patch(f"/api/v1/leads/{lid}", json={"stage": "won"})
    assert res.status_code == 422, res.text


async def test_close_won_creates_client_once(client):
    lid = await _make_lead(client, name="Bright Co", email="hire@bright.test")
    res = await client.post(f"/api/v1/leads/{lid}/close", json={"outcome": "won"})
    assert res.status_code == 200, res.text
    assert res.json()["stage"] == "won"

    clients = (await client.get("/api/v1/clients")).json()
    assert len([c for c in clients if c["email"] == "hire@bright.test"]) == 1

    # Re-closing must stay idempotent — never a duplicate roster row.
    await client.post(f"/api/v1/leads/{lid}/close", json={"outcome": "won"})
    clients = (await client.get("/api/v1/clients")).json()
    assert len([c for c in clients if c["email"] == "hire@bright.test"]) == 1


async def test_close_lost_requires_structured_reason(client):
    lid = await _make_lead(client, email="gone@lost.test")
    res = await client.post(f"/api/v1/leads/{lid}/close", json={"outcome": "lost"})
    assert res.status_code == 422, res.text  # no reason -> reject
    res = await client.post(
        f"/api/v1/leads/{lid}/close",
        json={"outcome": "lost", "reason": "price", "note": "over budget"},
    )
    assert res.status_code == 200, res.text
    lead = (await client.get(f"/api/v1/leads/{lid}")).json()
    assert lead["stage"] == "lost"
    assert lead["reason_lost"] == "price"


async def test_close_is_workspace_isolated(client, client_b):
    lid = await _make_lead(client)
    res = await client_b.post(f"/api/v1/leads/{lid}/close", json={"outcome": "won"})
    assert res.status_code == 404, res.text
