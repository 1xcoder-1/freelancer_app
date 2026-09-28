"""Small shared builders for tests (each just drives the public API)."""


async def make_client(client, name="Acme Corp", email="ops@acme.test"):
    res = await client.post("/api/v1/clients", json={"name": name, "email": email})
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def make_project(client, client_id=None, title="Website Rebuild", budget=5000.0):
    payload = {"title": title, "budget": budget, "hourly_rate": 75.0}
    if client_id:
        payload["client_id"] = client_id
    res = await client.post("/api/v1/projects", json=payload)
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def make_invoice(client, client_id, status="draft", invoice_number="INV-001"):
    payload = {
        "client_id": client_id,
        "invoice_number": invoice_number,
        "status": status,
        "items": [{"description": "Build", "quantity": 1, "unit_price": 1200.0}],
    }
    res = await client.post("/api/v1/invoices", json=payload)
    assert res.status_code == 201, res.text
    return res.json()["id"]
