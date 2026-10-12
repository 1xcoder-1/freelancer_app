"""Book AI Q&A: deterministic intents answered from real workspace data.

Every assertion pins the engine to actual record ids/amounts — the whole
point is that no number is invented.
"""

from helpers import make_client, make_invoice, make_project  # noqa: F401


async def _ask(client, question):
    res = await client.post("/api/v1/book-ai/ask", json={"question": question})
    assert res.status_code == 200, res.text
    return res.json()


async def _track_time(client, project_id, hours=10.0, rate=100.0, billable=True):
    res = await client.post("/api/v1/time-entries", json={
        "project_id": project_id,
        "duration_seconds": int(hours * 3600),
        "hourly_rate": rate,
        "is_billable": billable,
    })
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def test_status_advertises_capabilities(client):
    res = await client.get("/api/v1/book-ai/status")
    assert res.status_code == 200
    data = res.json()
    assert data["available"] is True
    assert len(data["capabilities"]) >= 4


async def test_client_billing_intent_counts_real_invoices(client):
    cid = await make_client(client)
    inv = await make_invoice(client, cid, status="sent", invoice_number="INV-001")
    # Drafts are not billing yet — this one must be ignored.
    await make_invoice(client, cid, status="draft", invoice_number="INV-002")

    data = await _ask(client, "How much did I bill Acme Corp this quarter?")
    assert data["intent"] == "client_billing"
    assert "$1,200.00" in data["answer"]
    assert "1 invoice" in data["answer"]
    assert "INV-002" not in data["answer"]

    by_id = {c["id"]: c for c in data["citations"]}
    assert cid in by_id and by_id[cid]["type"] == "client"
    assert inv in by_id and by_id[inv]["type"] == "invoice"


async def test_client_billing_discloses_ambiguous_name(client):
    cid = await make_client(client, name="Acme Corp", email="a@acme.test")
    await make_invoice(client, cid, status="paid")
    other = await make_client(client, name="Acme Industries", email="b@acme.test")
    await make_invoice(client, other, status="sent", invoice_number="INV-050")

    data = await _ask(client, "how much did I bill acme")
    assert data["intent"] == "client_billing"
    assert "also matched" in data["answer"]


async def test_effective_rate_by_client(client):
    cid = await make_client(client)  # Acme Corp
    pid = await make_project(client, cid)
    await _track_time(client, pid, hours=10.0, rate=50.0)
    await make_invoice(client, cid, status="sent")  # $1,200.00

    data = await _ask(client, "who has the best effective hourly rate?")
    assert data["intent"] == "effective_rate"
    assert "$120.00/hr" in data["answer"]  # 1200 / 10
    assert "Acme Corp" in data["answer"]
    assert data["citations"][0]["id"] == cid and data["citations"][0]["type"] == "client"


async def test_effective_rate_by_project(client):
    cid = await make_client(client)
    pid = await make_project(client, cid, title="Website Rebuild")
    entry = await _track_time(client, pid, hours=10.0, rate=50.0)
    # Billed hours link the invoice to the project (single-project import).
    res = await client.post("/api/v1/invoices", json={
        "client_id": cid,
        "invoice_number": "INV-010",
        "status": "sent",
        "items": [{"description": "Hours", "quantity": 1, "unit_price": 1200.0}],
        "time_entry_ids": [entry],
    })
    assert res.status_code == 201, res.text

    data = await _ask(client, "highest effective hourly rate across my projects?")
    assert data["intent"] == "effective_rate"
    assert "$120.00/hr" in data["answer"]
    assert "Website Rebuild" in data["answer"]
    assert data["citations"][0]["id"] == pid and data["citations"][0]["type"] == "project"


async def test_unbilled_time_on_project(client):
    cid = await make_client(client)
    pid = await make_project(client, cid, title="Mobile App")
    await _track_time(client, pid, hours=4.0, rate=75.0)
    await _track_time(client, pid, hours=2.0, rate=75.0)
    await _track_time(client, pid, hours=3.0, rate=75.0, billable=False)

    data = await _ask(client, "what is unbilled on Mobile App?")
    assert data["intent"] == "unbilled_time"
    assert "6.00" in data["answer"]     # 6 billable hours (non-billable excluded)
    assert "$450.00" in data["answer"]  # 6h x $75
    assert data["citations"][0]["id"] == pid

    # Naming no project asks which one instead of inventing an answer.
    vague = await _ask(client, "what is unbilled?")
    assert vague["intent"] == "unbilled_time"
    assert "Which project" in vague["answer"]


async def test_fallback_cites_recent_records(client):
    cid = await make_client(client)
    pid = await make_project(client, cid)
    inv = await make_invoice(client, cid, status="sent", invoice_number="INV-042")

    data = await _ask(client, "tell me about the weather today")
    assert data["intent"] == "recent_activity"
    assert "INV-042" in data["answer"] and "$1,200.00" in data["answer"]
    assert "Website Rebuild" in data["answer"]
    cited = {c["id"] for c in data["citations"]}
    assert inv in cited and pid in cited


async def test_book_ai_is_workspace_scoped(client, client_b):
    cid = await make_client(client)
    await make_invoice(client, cid, status="sent")

    mine = await _ask(client, "How much did I bill Acme Corp this year?")
    theirs = await _ask(client_b, "How much did I bill Acme Corp this year?")
    assert "$1,200.00" in mine["answer"]
    assert theirs["intent"] == "recent_activity" or "nothing" in theirs["answer"]
    # client_b has no Acme client at all, so no citation may reference it.
    assert all(c["id"] != cid for c in theirs["citations"])
