"""Phase 1 — invoice productivity foundation.

V1 (public payment page + partial payments) and V6 (un-bill hours on delete),
plus the SE11 startup guard. All through the public API only, on a throwaway
schema (conftest), with Inngest disabled so emit() is a no-op.
"""

from tests.helpers import make_client, make_project, make_invoice


async def _make_time_entry(client, project_id, seconds=3600, rate=50.0):
    res = await client.post(
        "/api/v1/time-entries",
        json={"project_id": project_id, "duration_seconds": seconds, "hourly_rate": rate, "is_billable": True},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


# ---------------------------------------------------------------------------
# V1 — invoice carries a token; public page resolves it
# ---------------------------------------------------------------------------
async def test_invoice_exposes_payment_token(client):
    cid = await make_client(client)
    iid = await make_invoice(client, cid)
    res = await client.get(f"/api/v1/invoices/{iid}")
    assert res.status_code == 200, res.text
    assert res.json()["token"], "invoice must carry a public payment token"


async def test_public_invoice_read_by_token(client):
    cid = await make_client(client, name="Nova")
    iid = await make_invoice(client, cid, invoice_number="INV-900")
    token = (await client.get(f"/api/v1/invoices/{iid}")).json()["token"]

    res = await client.get(f"/api/v1/invoices/public/{token}")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["invoice_number"] == "INV-900"
    assert body["client_name"] == "Nova"
    assert body["total_amount"] == 1200.0
    assert body["amount_paid"] == 0.0
    assert body["amount_due"] == 1200.0
    # Never leaks the workspace id to an anonymous payer.
    assert "workspace_id" not in body


async def test_public_invoice_unknown_token_is_404(client):
    res = await client.get("/api/v1/invoices/public/does-not-exist")
    assert res.status_code == 404


async def test_public_pay_records_partial_then_full(client):
    cid = await make_client(client)
    iid = await make_invoice(client, cid)
    token = (await client.get(f"/api/v1/invoices/{iid}")).json()["token"]

    # A first partial payment: still open, balance reduced.
    p1 = await client.post(f"/api/v1/invoices/public/{token}/pay", json={"amount": 500.0, "method": "bank_transfer"})
    assert p1.status_code == 201, p1.text
    mid = (await client.get(f"/api/v1/invoices/public/{token}")).json()
    assert mid["amount_paid"] == 500.0
    assert mid["amount_due"] == 700.0
    assert mid["status"] != "paid"

    # The remainder flips it to paid and stamps paid_at.
    p2 = await client.post(f"/api/v1/invoices/public/{token}/pay", json={"amount": 700.0})
    assert p2.status_code == 201, p2.text
    final = (await client.get(f"/api/v1/invoices/public/{token}")).json()
    assert final["status"] == "paid"
    assert final["amount_due"] == 0.0
    inv = (await client.get(f"/api/v1/invoices/{iid}")).json()
    assert inv["paid_at"] is not None


async def test_public_pay_rejects_over_post(client):
    cid = await make_client(client)
    iid = await make_invoice(client, cid)  # total 1200
    token = (await client.get(f"/api/v1/invoices/{iid}")).json()["token"]
    res = await client.post(f"/api/v1/invoices/public/{token}/pay", json={"amount": 5000.0})
    assert res.status_code == 422


async def test_public_pay_rejects_nonpositive_amount(client):
    cid = await make_client(client)
    iid = await make_invoice(client, cid)
    token = (await client.get(f"/api/v1/invoices/{iid}")).json()["token"]
    assert (await client.post(f"/api/v1/invoices/public/{token}/pay", json={"amount": 0})).status_code == 422
    assert (await client.post(f"/api/v1/invoices/public/{token}/pay", json={"amount": -10})).status_code == 422


# ---------------------------------------------------------------------------
# V6 — deleting an invoice re-opens exactly the hours it had billed
# ---------------------------------------------------------------------------
async def test_delete_invoice_restores_linked_hours(client):
    cid = await make_client(client)
    pid = await make_project(client, client_id=cid)
    e1 = await _make_time_entry(client, pid)
    e2 = await _make_time_entry(client, pid)

    # Bill both hours on one invoice.
    res = await client.post("/api/v1/invoices", json={
        "client_id": cid,
        "invoice_number": "INV-BILL",
        "status": "sent",
        "items": [{"description": "hours", "quantity": 1, "unit_price": 100.0}],
        "time_entry_ids": [e1, e2],
    })
    assert res.status_code == 201, res.text
    iid = res.json()["id"]

    # They are now excluded from unbilled time.
    unbilled = (await client.get("/api/v1/invoices/unbilled-time")).json()
    ids = {row["id"] for row in unbilled}
    assert e1 not in ids and e2 not in ids

    # Deleting the invoice must make them billable again (the old hard-delete
    # left is_invoiced=True forever and the hours vanished).
    assert (await client.delete(f"/api/v1/invoices/{iid}")).status_code == 204
    unbilled2 = {row["id"] for row in (await client.get("/api/v1/invoices/unbilled-time")).json()}
    assert e1 in unbilled2 and e2 in unbilled2


async def test_delete_invoice_only_restores_its_own_hours(client):
    cid = await make_client(client)
    pid = await make_project(client, client_id=cid)
    shared = await _make_time_entry(client, pid)
    other = await _make_time_entry(client, pid)

    r1 = await client.post("/api/v1/invoices", json={
        "client_id": cid, "invoice_number": "INV-1", "status": "sent",
        "items": [{"description": "a", "quantity": 1, "unit_price": 10.0}],
        "time_entry_ids": [shared],
    })
    iid1 = r1.json()["id"]
    await client.post("/api/v1/invoices", json={
        "client_id": cid, "invoice_number": "INV-2", "status": "sent",
        "items": [{"description": "b", "quantity": 1, "unit_price": 10.0}],
        "time_entry_ids": [other],
    })

    await client.delete(f"/api/v1/invoices/{iid1}")
    unbilled = {row["id"] for row in (await client.get("/api/v1/invoices/unbilled-time")).json()}
    assert shared in unbilled      # INV-1's hours reopened
    assert other not in unbilled   # INV-2's hours stay billed


# ---------------------------------------------------------------------------
# Tenant isolation on the new id-bearing routes
# ---------------------------------------------------------------------------
async def test_invoice_public_read_is_not_workspace_leaky(client, client_b):
    cid = await make_client(client)
    iid = await make_invoice(client, cid)
    token = (await client.get(f"/api/v1/invoices/{iid}")).json()["token"]

    # The other tenant cannot fetch the invoice via the authenticated route.
    assert (await client_b.get(f"/api/v1/invoices/{iid}")).status_code == 404
    # and cannot delete it either.
    assert (await client_b.delete(f"/api/v1/invoices/{iid}")).status_code == 404
    assert token  # token belongs to tenant A only
