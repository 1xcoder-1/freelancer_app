"""Money-cascade gaps: lead→client button, intake→lead, invoice-from-tracked-time.

Hermetic by convention — each test drives only the public API against the
throwaway SQLite schema from conftest, with its own mock-token workspace.
"""

from helpers import make_client, make_project, make_invoice  # noqa: F401


# ------------------------------------------------------------------------------
# Lead → Client (explicit convert action)
# ------------------------------------------------------------------------------
async def _make_lead(client, email="deal@nova.test", **over):
    payload = {"name": "Nova Ltd", "email": email, "company": "Nova Ltd", "stage": "proposal", "estimated_value": 4000.0}
    payload.update(over)
    res = await client.post("/api/v1/leads", json=payload)
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def test_convert_lead_to_client_creates_roster_client(client):
    lid = await _make_lead(client)
    res = await client.post(f"/api/v1/leads/{lid}/convert-to-client")
    assert res.status_code == 200, res.text
    created = res.json()
    assert created["email"].lower() == "deal@nova.test"
    assert created["status"] == "active"

    # Lead flips to won so pipeline stats stay honest.
    lead = next(l for l in (await client.get("/api/v1/leads")).json() if l["id"] == lid)
    assert lead["stage"] == "won"

    # Client now exists in the roster.
    roster = (await client.get("/api/v1/clients")).json()
    assert any(c["email"].lower() == "deal@nova.test" for c in roster)


async def test_convert_lead_is_idempotent_by_email(client):
    lid = await _make_lead(client, email="twice@nova.test")
    first = (await client.post(f"/api/v1/leads/{lid}/convert-to-client")).json()["id"]
    second = (await client.post(f"/api/v1/leads/{lid}/convert-to-client")).json()["id"]
    assert first == second  # never spawns a duplicate client
    roster = (await client.get("/api/v1/clients")).json()
    assert sum(1 for c in roster if c["email"] == "twice@nova.test") == 1


async def test_convert_lead_is_workspace_isolated(client, client_b):
    lid = await _make_lead(client, email="mine@nova.test")
    res = await client_b.post(f"/api/v1/leads/{lid}/convert-to-client")
    assert res.status_code == 404  # cross-tenant id must not be reachable


# ------------------------------------------------------------------------------
# Intake submission → Lead
# ------------------------------------------------------------------------------
async def _submit_intake(client, email="resp@acme.test", name="Riley Respond"):
    form = (await client.post(
        "/api/v1/intake",
        json={"title": "Project Intake", "questions": [{"id": "q1", "label": "Goal", "type": "text", "required": True}]},
    )).json()
    await client.post(
        f"/api/v1/intake/public/{form['token']}/submit",
        json={"client_name": name, "client_email": email, "answers": {"Goal": "Ship an app"}},
    )
    subs = (await client.get(f"/api/v1/intake/{form['id']}/submissions")).json()
    return subs[0]["id"]


async def test_convert_intake_submission_to_lead(client):
    sid = await _submit_intake(client)
    res = await client.post(f"/api/v1/intake/submissions/{sid}/convert-to-lead")
    assert res.status_code == 200, res.text
    lead = res.json()
    assert lead["email"] == "resp@acme.test"
    assert lead["source"] == "Intake form"
    assert lead["stage"] == "new"
    leads = (await client.get("/api/v1/leads")).json()
    assert any(l["email"] == "resp@acme.test" for l in leads)


async def test_convert_intake_submission_is_idempotent(client):
    sid = await _submit_intake(client, email="dup@acme.test")
    first = (await client.post(f"/api/v1/intake/submissions/{sid}/convert-to-lead")).json()["id"]
    second = (await client.post(f"/api/v1/intake/submissions/{sid}/convert-to-lead")).json()["id"]
    assert first == second


async def test_unbilled_time_lists_ready_hours(client):
    cid = await make_client(client, name="Timely Co", email="t@timely.test")
    pid = await make_project(client, client_id=cid)
    await client.post("/api/v1/time-entries", json={
        "project_id": pid, "duration_seconds": 7200, "hourly_rate": 100.0, "is_billable": True, "description": "Build",
    })
    res = await client.get("/api/v1/invoices/unbilled-time")
    assert res.status_code == 200, res.text
    rows = res.json()
    assert len(rows) == 1
    assert rows[0]["client_id"] == cid
    assert rows[0]["hours"] == 2.0
    assert rows[0]["amount"] == 200.0


async def test_invoice_from_tracked_time_marks_entries_billed(client):
    cid = await make_client(client, name="Bill Me Ltd", email="b@bill.test")
    pid = await make_project(client, client_id=cid)
    entry = (await client.post("/api/v1/time-entries", json={
        "project_id": pid, "duration_seconds": 3600, "hourly_rate": 90.0, "is_billable": True,
    })).json()

    res = await client.post("/api/v1/invoices", json={
        "client_id": cid, "invoice_number": "INV-T-001", "status": "draft",
        # Real UI flow: the tracked hour arrives as its own line item AND id.
        "items": [
            {"description": "Design", "quantity": 1, "unit_price": 500.0},
            {"description": "Website Rebuild — Tracked work (1.0 h)", "quantity": 1.0, "unit_price": 90.0},
        ],
        "time_entry_ids": [entry["id"]],
    })
    assert res.status_code == 201, res.text
    # total = manual 500 + tracked 90
    assert res.json()["total_amount"] == 590.0

    # The hour is now billed — it must vanish from the unbilled pool…
    assert (await client.get("/api/v1/invoices/unbilled-time")).json() == []
    # …and re-using the same entry is rejected, never double-billed.
    again = await client.post("/api/v1/invoices", json={
        "client_id": cid, "invoice_number": "INV-T-002", "status": "draft",
        "items": [{"description": "X", "quantity": 1, "unit_price": 1.0}],
        "time_entry_ids": [entry["id"]],
    })
    assert again.status_code == 422


async def test_tracked_time_wrong_client_is_rejected(client):
    owner = await make_client(client, name="Owner", email="o@owner.test")
    other = await make_client(client, name="Other", email="x@other.test")
    pid = await make_project(client, client_id=owner)
    entry = (await client.post("/api/v1/time-entries", json={
        "project_id": pid, "duration_seconds": 1800, "hourly_rate": 80.0, "is_billable": True,
    })).json()
    res = await client.post("/api/v1/invoices", json={
        "client_id": other,
        "invoice_number": "INV-X-001", "status": "draft",
        "items": [{"description": "X", "quantity": 1, "unit_price": 1.0}],
        "time_entry_ids": [entry["id"]],
    })
    assert res.status_code == 422  # entry belongs to a different client's project
