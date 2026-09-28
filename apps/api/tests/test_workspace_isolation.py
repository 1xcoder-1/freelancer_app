"""Cross-workspace isolation tests (IDOR / tenant-leak protection).

Two distinct dev tokens map to two distinct workspaces, so we can prove one
tenant can neither reference nor read another tenant's rows by id.
"""

from helpers import make_client, make_project


async def test_project_create_rejects_foreign_client(client, client_b):
    foreign_client_id = await make_client(client, name="Victim Ltd", email="victim@x.test")

    # Workspace B tries to attach A's client to its own project
    res = await client_b.post(
        "/api/v1/projects",
        json={"title": "Sneaky", "client_id": foreign_client_id, "budget": 100.0},
    )
    assert res.status_code == 400, res.text


async def test_project_update_rejects_foreign_client(client, client_b):
    foreign_client_id = await make_client(client)
    pid = await make_project(client_b, title="B Project")

    res = await client_b.patch(
        f"/api/v1/projects/{pid}", json={"client_id": foreign_client_id}
    )
    assert res.status_code == 400, res.text


async def test_foreign_project_is_not_visible_or_editable(client, client_b):
    pid = await make_project(client, title="A Secret Project")

    # B editing A's project must 404 (never found in B's scope)
    res = await client_b.patch(f"/api/v1/projects/{pid}", json={"status": "completed"})
    assert res.status_code == 404, res.text

    # And A's client name must not leak into B's project listing
    lst = await client_b.get("/api/v1/projects")
    assert lst.status_code == 200
    assert all(p["id"] != pid for p in lst.json())


async def test_invoice_rejects_foreign_client(client, client_b):
    foreign_client_id = await make_client(client)
    res = await client_b.post(
        "/api/v1/invoices",
        json={
            "client_id": foreign_client_id,
            "invoice_number": "INV-STOLEN",
            "status": "draft",
            "items": [{"description": "x", "quantity": 1, "unit_price": 5}],
        },
    )
    assert res.status_code == 400, res.text


async def test_time_entry_rejects_foreign_project(client, client_b):
    pid = await make_project(client)
    res = await client_b.post(
        "/api/v1/time-entries",
        json={"project_id": pid, "duration_seconds": 60},
    )
    assert res.status_code == 404, res.text


async def test_timer_cannot_start_on_foreign_project(client, client_b):
    pid = await make_project(client)
    res = await client_b.post("/api/v1/timer/start", json={"project_id": pid})
    assert res.status_code == 404, res.text
