"""Client revenue tracking: GET /clients reports per-client invoice totals.

Hermetic by convention — drives only the public API against the throwaway
SQLite schema from conftest (drafts excluded, paid counted, reopen reverses).
"""

from helpers import make_client, make_invoice


async def _clients_map(client):
    res = await client.get("/api/v1/clients")
    assert res.status_code == 200, res.text
    return {c["id"]: c for c in res.json()}


async def test_client_revenue_totals(client):
    cid = await make_client(client, name="Acme Corp", email="ops@acme.test")
    # Draft must not count as revenue; sent and paid must.
    await make_invoice(client, cid, status="draft", invoice_number="INV-D-001")
    await make_invoice(client, cid, status="sent", invoice_number="INV-S-001")
    paid_inv = await make_invoice(client, cid, status="sent", invoice_number="INV-P-001")

    res = await client.patch(f"/api/v1/invoices/{paid_inv}/status", json={"status": "paid"})
    assert res.status_code == 200, res.text

    row = (await _clients_map(client))[cid]
    assert row["total_billed"] == 2400.0  # two non-draft invoices of 1200
    assert row["total_paid"] == 1200.0    # only the settled one


async def test_reopening_paid_invoice_reverses_revenue(client):
    cid = await make_client(client, name="Beta GmbH", email="hi@beta.test")
    inv = await make_invoice(client, cid, status="sent", invoice_number="INV-R-001")
    await client.patch(f"/api/v1/invoices/{inv}/status", json={"status": "paid"})
    assert (await _clients_map(client))[cid]["total_paid"] == 1200.0

    # Reopening for correction must never leave phantom "received" money.
    await client.patch(f"/api/v1/invoices/{inv}/status", json={"status": "overdue"})
    row = (await _clients_map(client))[cid]
    assert row["total_paid"] == 0.0
    assert row["total_billed"] == 1200.0  # still out there, still owed


async def test_client_without_invoices_reports_zero(client):
    cid = await make_client(client, name="Fresh Co", email="new@fresh.test")
    row = (await _clients_map(client))[cid]
    assert row["total_billed"] == 0.0
    assert row["total_paid"] == 0.0


async def test_revenue_is_workspace_isolated(client, client_b):
    cid = await make_client(client, name="Secret Inc", email="shh@secret.test")
    await make_invoice(client, cid, status="sent", invoice_number="INV-ISO-001")

    others = await client_b.get("/api/v1/clients")
    assert others.status_code == 200
    assert all(c["id"] != cid for c in others.json())
