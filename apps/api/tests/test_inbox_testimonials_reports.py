"""Inbox, testimonials, reports and shared links: the four new module surfaces.

Covers the notification producers (invoice paid, contract signed, testimonial
submitted), the testimonial token lifecycle (create → submit → approve → revoke),
the reports summary shape, share-link aggregation, and planner carry-over.
Hermetic: public API only against the throwaway SQLite schema from conftest.
"""

from datetime import date, timedelta

from helpers import make_client, make_invoice, make_project  # noqa: F401


async def _todo(client, board_id, text="Draft proposal", days_ago=None, is_done=False):
    payload = {"text": text}
    if days_ago is not None:
        payload["date"] = (date.today() - timedelta(days=days_ago)).isoformat()
    res = await client.post(f"/api/v1/planner/boards/{board_id}/todos", json=payload)
    assert res.status_code == 201, res.text
    todo_id = res.json()["id"]
    if is_done:
        await client.patch(f"/api/v1/planner/todos/{todo_id}", json={"is_done": True})
    return todo_id


async def _board(client, name="Weekly plan"):
    res = await client.post("/api/v1/planner/boards", json={"name": name})
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _pay(client, invoice_id, amount=400.0):
    """Money lands through the client-facing pay link — the only payment writer."""
    token = (await client.get(f"/api/v1/invoices/{invoice_id}")).json()["token"]
    res = await client.post(f"/api/v1/invoices/public/{token}/pay", json={
        "amount": amount,
        "method": "bank_transfer",
    })
    assert res.status_code == 201, res.text
    return res.json()


# ------------------------------------------------------------------------------
# Inbox: producers, read state, isolation
# ------------------------------------------------------------------------------

async def test_inbox_starts_empty(client):
    res = await client.get("/api/v1/notifications")
    assert res.status_code == 200 and res.json() == []
    count = await client.get("/api/v1/notifications/unread-count")
    assert count.json() == {"count": 0}


async def test_marking_invoice_paid_pushes_notification(client):
    client_id = await make_client(client)
    invoice_id = await make_invoice(client, client_id, status="sent")

    res = await client.patch(f"/api/v1/invoices/{invoice_id}/status", json={"status": "paid"})
    assert res.status_code == 200, res.text

    feed = (await client.get("/api/v1/notifications")).json()
    assert [n["kind"] for n in feed] == ["invoice.paid"]
    assert feed[0]["is_read"] is False
    assert feed[0]["link"] == "/dashboard/projects?tab=invoices"

    # Only the transition pushes: re-setting the same status adds no row.
    await client.patch(f"/api/v1/invoices/{invoice_id}/status", json={"status": "paid"})
    assert len((await client.get("/api/v1/notifications")).json()) == 1


async def test_inbox_read_all_and_delete(client):
    client_id = await make_client(client)
    invoice_id = await make_invoice(client, client_id, status="sent")
    await client.patch(f"/api/v1/invoices/{invoice_id}/status", json={"status": "overdue"})

    assert (await client.get("/api/v1/notifications/unread-count")).json()["count"] == 1

    feed = (await client.get("/api/v1/notifications")).json()
    res = await client.post(f"/api/v1/notifications/{feed[0]['id']}/read")
    assert res.status_code == 200 and res.json()["is_read"] is True
    assert (await client.get("/api/v1/notifications/unread-count")).json()["count"] == 0

    # unread-only filter now returns nothing, but the row is still in the feed.
    assert (await client.get("/api/v1/notifications", params={"unread_only": True})).json() == []

    res = await client.post("/api/v1/notifications/read-all")
    assert res.json()["marked"] == 0

    victim = (await client.get("/api/v1/notifications")).json()[0]["id"]
    assert (await client.delete(f"/api/v1/notifications/{victim}")).status_code == 204
    assert (await client.get("/api/v1/notifications")).json() == []


async def test_inbox_is_workspace_scoped(client, client_b):
    client_id = await make_client(client)
    invoice_id = await make_invoice(client, client_id, status="sent")
    await client.patch(f"/api/v1/invoices/{invoice_id}/status", json={"status": "paid"})

    assert len((await client.get("/api/v1/notifications")).json()) == 1
    assert (await client_b.get("/api/v1/notifications")).json() == []

    other_id = (await client.get("/api/v1/notifications")).json()[0]["id"]
    # Foreign ids 404 rather than leaking existence.
    assert (await client_b.post(f"/api/v1/notifications/{other_id}/read")).status_code == 404
    assert (await client_b.delete(f"/api/v1/notifications/{other_id}")).status_code == 404


async def test_contract_signing_pushes_notification(client):
    client_id = await make_client(client)
    project_id = await make_project(client, client_id)
    res = await client.post("/api/v1/contracts", json={
        "project_id": project_id,
        "client_id": client_id,
        "title": "Retainer agreement",
        "content": "We will rebuild the marketing site over six weeks.",
        "recipient_name": "Dana",
        "recipient_email": "dana@acme.test",
    })
    assert res.status_code == 201, res.text
    contract = res.json()

    # Opening the link is a signal too, so it lands in the inbox.
    assert (await client.get(f"/api/v1/contracts/public/{contract['token']}")).status_code == 200
    kinds = [n["kind"] for n in (await client.get("/api/v1/notifications")).json()]
    assert "contract.viewed" in kinds

    res = await client.post(f"/api/v1/contracts/public/{contract['token']}/sign", json={
        "client_signature": "data:image/png;base64,AAAA",
        "recipient_name": "Dana",
    })
    assert res.status_code == 200, res.text
    kinds = [n["kind"] for n in (await client.get("/api/v1/notifications")).json()]
    assert "contract.signed" in kinds


# ------------------------------------------------------------------------------
# Testimonials: request → public submit → approve → revoke
# ------------------------------------------------------------------------------

async def test_testimonial_request_and_public_submit_roundtrip(client):
    client_id = await make_client(client)
    res = await client.post("/api/v1/testimonials", json={
        "client_id": client_id,
        "author_name": "Dana Reyes",
        "author_role": "Head of Product",
        "context_label": "Website rebuild",
    })
    assert res.status_code == 201, res.text
    request = res.json()
    assert request["status"] == "pending" and request["quote"] is None
    assert request["submit_url"] == f"/testimonial/{request['token']}"

    view = await client.get(f"/api/v1/testimonials/public/{request['token']}")
    assert view.status_code == 200
    assert view.json() == {
        "author_name": "Dana Reyes",
        "author_role": "Head of Product",
        "context_label": "Website rebuild",
        "submitted": False,
    }

    res = await client.post(f"/api/v1/testimonials/public/{request['token']}", json={
        "quote": "  Shipped two weeks early and the handover was flawless.  ",
        "rating": 5,
    })
    assert res.status_code == 200, res.text

    stored = [t for t in (await client.get("/api/v1/testimonials")).json()][0]
    assert stored["quote"] == "Shipped two weeks early and the handover was flawless."
    assert stored["rating"] == 5 and stored["submitted_at"]

    # One link, one quote: a second submission is refused.
    again = await client.post(f"/api/v1/testimonials/public/{request['token']}", json={"quote": "again"})
    assert again.status_code == 409
    assert (await client.get(f"/api/v1/testimonials/public/{request['token']}")).status_code == 409

    # Landing a quote also pings the inbox.
    kinds = [n["kind"] for n in (await client.get("/api/v1/notifications")).json()]
    assert "testimonial.submitted" in kinds


async def test_testimonial_moderation_and_revocation(client):
    res = await client.post("/api/v1/testimonials", json={"author_name": "Sam"})
    tid = res.json()["id"]
    token = res.json()["token"]

    assert (await client.patch(f"/api/v1/testimonials/{tid}", json={"status": "approved"})).json()["status"] == "approved"
    assert (await client.get("/api/v1/testimonials", params={"status": "approved"})).json()[0]["id"] == tid
    assert (await client.get("/api/v1/testimonials", params={"status": "rejected"})).json() == []

    # Deleting the row retires the token with it.
    assert (await client.delete(f"/api/v1/testimonials/{tid}")).status_code == 204
    assert (await client.get(f"/api/v1/testimonials/public/{token}")).status_code == 404


async def test_testimonial_validation_and_isolation(client, client_b):
    res = await client.post("/api/v1/testimonials", json={"client_id": "not-a-client", "author_name": "Sam"})
    assert res.status_code == 404

    res = await client.post("/api/v1/testimonials", json={"author_name": "   "})
    assert res.status_code == 422

    mine = (await client.post("/api/v1/testimonials", json={"author_name": "Sam"})).json()

    # Rating is validated where the client types it, not on the request row.
    res = await client.post(f"/api/v1/testimonials/public/{mine['token']}", json={"quote": "Great", "rating": 9})
    assert res.status_code == 422

    assert (await client_b.patch(f"/api/v1/testimonials/{mine['id']}", json={"status": "approved"})).status_code == 404
    assert (await client_b.delete(f"/api/v1/testimonials/{mine['id']}")).status_code == 404
    assert (await client_b.get("/api/v1/testimonials")).json() == []


# ------------------------------------------------------------------------------
# Reports summary
# ------------------------------------------------------------------------------

async def test_reports_summary_shape(client):
    client_id = await make_client(client)
    await make_project(client, client_id, budget=5000.0)
    invoice_id = await make_invoice(client, client_id, status="sent", invoice_number="INV-900")

    await _pay(client, invoice_id, 1200.0)
    await client.post("/api/v1/leads", json={
        "name": "Nina", "company": "Globex", "email": "nina@globex.test", "estimated_value": 2500.0,
    })
    await client.post("/api/v1/expenses", json={
        "category": "Software & Subscriptions", "amount": 20.0, "is_recurring": True,
    })

    res = await client.get("/api/v1/reports/summary")
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["months_window"] == 6
    assert sum(row["total"] for row in data["revenue_by_month"]) == 1200.0
    assert data["revenue_by_client"][0]["client"] == "Acme Corp"
    assert data["revenue_by_client"][0]["total"] == 1200.0
    assert data["invoices"]["paid_count"] == 1
    assert data["invoices"]["paid_total"] == 1200.0
    assert data["invoices"]["awaiting_count"] == 0
    assert data["expenses"]["recurring_run_rate"] >= 20.0
    assert data["lead_funnel"]["pipeline_value"] >= 2500.0
    assert data["lead_funnel"]["win_rate"] is None  # nothing closed yet
    assert set(data["lead_funnel"]["stages"]) == {
        "new", "contacted", "proposal", "negotiation", "won", "lost",
    }
    assert data["lead_funnel"]["stages"]["new"] == 1
    assert "total_at_stake" in data["revenue_at_stake"]["totals"]


async def test_reports_summary_is_workspace_scoped(client, client_b):
    client_id = await make_client(client)
    invoice_id = await make_invoice(client, client_id, status="sent")
    await client.patch(f"/api/v1/invoices/{invoice_id}/status", json={"status": "paid"})

    mine = (await client.get("/api/v1/reports/summary")).json()
    theirs = (await client_b.get("/api/v1/reports/summary")).json()

    assert mine["invoices"]["paid_total"] > 0
    assert theirs["invoices"]["paid_total"] == 0.0
    assert theirs["revenue_by_client"] == []


# ------------------------------------------------------------------------------
# Shared links manager
# ------------------------------------------------------------------------------

async def test_share_links_aggregates_public_tokens(client):
    client_id = await make_client(client)
    project_id = await make_project(client, client_id)
    invoice_id = await make_invoice(client, client_id, status="sent")

    await client.post("/api/v1/contracts", json={
        "project_id": project_id,
        "client_id": client_id,
        "title": "SOW",
        "content": "Deliver the migration in three phases with sign-off gates.",
        "recipient_name": "Dana",
    })
    await client.post("/api/v1/intake", json={
        "title": "Project brief",
        "questions": [{"id": "goal", "label": "What is the goal?", "type": "text"}],
    })
    board_id = await _board(client)
    await client.post(f"/api/v1/planner/boards/{board_id}/share", json={"expires_at": None})

    res = await client.get("/api/v1/share-links")
    assert res.status_code == 200, res.text
    links = res.json()
    by_module = {}
    for link in links:
        by_module.setdefault(link["module"], []).append(link)

    assert {link["label"] for link in by_module["invoices"]} == {"INV-001"}
    assert by_module["invoices"][0]["kind"] == "pay_link"
    assert by_module["invoices"][0]["is_active"] is True
    assert by_module["invoices"][0]["path"] != ""
    assert by_module["contracts"][0]["kind"] == "esign_link"
    assert by_module["intake"][0]["kind"] == "intake_form"
    assert by_module["planner"][0]["kind"] == "readonly_board"
    assert by_module["planner"][0]["subtitle"] is None


async def test_share_links_are_read_only_and_scoped(client, client_b):
    # No mutation verbs on the aggregate — revocation lives in each module.
    assert (await client.post("/api/v1/share-links", json={})).status_code == 405

    client_id = await make_client(client)
    await make_invoice(client, client_id, status="sent")
    assert (await client.get("/api/v1/share-links")).json()
    assert (await client_b.get("/api/v1/share-links")).json() == []


# ------------------------------------------------------------------------------
# Planner carry-over
# ------------------------------------------------------------------------------

async def test_carry_over_moves_only_undone_past_todos(client):
    board_id = await _board(client)
    overdue_a = await _todo(client, board_id, "Send invoice", days_ago=3)
    overdue_b = await _todo(client, board_id, "Book the call", days_ago=1)
    done = await _todo(client, board_id, "Archived", days_ago=2, is_done=True)
    future = await _todo(client, board_id, "Next sprint", days_ago=-4)
    undated = await _todo(client, board_id, "Someday")

    res = await client.post(f"/api/v1/planner/boards/{board_id}/carry-over")
    assert res.status_code == 200, res.text
    today = date.today().isoformat()
    assert res.json()["moved"] == 2 and res.json()["date"] == today

    board = (await client.get(f"/api/v1/planner/boards/{board_id}")).json()
    dates = {t["id"]: t["date"] for t in board["todos"]}
    assert dates[overdue_a] == today
    assert dates[overdue_b] == today
    assert dates[done] != today
    assert dates[future] != today
    assert dates[undated] is None

    # Idempotent: nothing is overdue any more.
    assert (await client.post(f"/api/v1/planner/boards/{board_id}/carry-over")).json()["moved"] == 0


async def test_carry_over_rejects_foreign_board(client, client_b):
    board_id = await _board(client)
    assert (await client_b.post(f"/api/v1/planner/boards/{board_id}/carry-over")).status_code == 404
