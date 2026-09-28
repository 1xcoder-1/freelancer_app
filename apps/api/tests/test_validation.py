"""Input-validation / abuse-resistance tests for the hardened schemas.

Each test proves a value that used to reach the database (or a 500) is now
rejected at the edge with 422, while the legitimate path still succeeds.
"""

from helpers import make_client, make_invoice


async def test_expense_rejects_negative_amount(client):
    res = await client.post(
        "/api/v1/expenses", json={"category": "Software", "amount": -9999.0}
    )
    assert res.status_code == 422


async def test_expense_accepts_positive_amount(client):
    res = await client.post(
        "/api/v1/expenses", json={"category": "Software", "amount": 49.99}
    )
    assert res.status_code == 201, res.text


async def test_invoice_status_is_whitelisted_on_create(client):
    cid = await make_client(client)
    res = await client.post(
        "/api/v1/invoices",
        json={
            "client_id": cid,
            "invoice_number": "INV-9",
            "status": "totally-made-up",
            "items": [{"description": "x", "quantity": 1, "unit_price": 10}],
        },
    )
    assert res.status_code == 422


async def test_invoice_status_patch_accepts_valid_and_rejects_invalid(client):
    cid = await make_client(client)
    inv_id = await make_invoice(client, cid, status="draft")

    ok = await client.patch(f"/api/v1/invoices/{inv_id}/status", json={"status": "paid"})
    assert ok.status_code == 200, ok.text
    assert ok.json()["status"] == "paid"

    bad = await client.patch(f"/api/v1/invoices/{inv_id}/status", json={"status": "refunded-ish"})
    assert bad.status_code == 422


async def test_time_entry_rejects_absurd_duration(client):
    from helpers import make_project
    pid = await make_project(client)
    res = await client.post(
        "/api/v1/time-entries",
        json={"project_id": pid, "duration_seconds": 999_999_999},
    )
    assert res.status_code == 422


async def test_client_status_is_whitelisted(client):
    res = await client.post(
        "/api/v1/clients", json={"name": "Nope", "email": "a@b.co", "status": "zombie"}
    )
    assert res.status_code == 422


async def test_money_field_rejects_negative_budget(client):
    res = await client.post(
        "/api/v1/projects", json={"title": "Bad Budget", "budget": -100.0}
    )
    assert res.status_code == 422
