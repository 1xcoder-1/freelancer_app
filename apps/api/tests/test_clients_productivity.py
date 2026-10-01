"""Phase 3 — Clients productivity (C1 earnings, C5 files, C6 relationship strip).

Hermetic by convention: HTTP-driven against the throwaway SQLite schema.
"""

from datetime import datetime, timedelta

from helpers import make_client, make_project
from tests.helpers import make_invoice  # noqa: F401  (kept for parity)

from app.core.database import AsyncSessionLocal


async def _make_time_entry(client, project_id, seconds=3600, rate=100.0):
    res = await client.post("/api/v1/time-entries", json={
        "project_id": project_id, "duration_seconds": seconds, "hourly_rate": rate, "is_billable": True,
    })
    assert res.status_code == 201, res.text


async def _make_contract(client, project_id, title="MSA", content="Engagement terms and conditions."):
    res = await client.post("/api/v1/contracts", json={
        "project_id": project_id, "title": title, "content": content,
    })
    assert res.status_code == 201, res.text
    return res.json()


async def _post_invoice(client, cid, number, status, unit_price):
    res = await client.post("/api/v1/invoices", json={
        "client_id": cid, "invoice_number": number, "status": status,
        "items": [{"description": "Work", "quantity": 1, "unit_price": float(unit_price)}],
    })
    assert res.status_code == 201, res.text
    return res.json()


# ------------------------------------------------------------------------------
# C1 — earnings
# ------------------------------------------------------------------------------
async def test_client_earnings(client):
    cid = await make_client(client, name="Earnings Co", email="e@earnings.test")
    paid_inv = await _post_invoice(client, cid, "INV-E-1", "sent", 1000)
    # Move to paid through the status flow so paid_at (days-to-pay) is stamped.
    await client.patch(f"/api/v1/invoices/{paid_inv['id']}/status", json={"status": "paid"})
    await _post_invoice(client, cid, "INV-E-2", "overdue", 500)

    body = (await client.get(f"/api/v1/clients/{cid}/earnings")).json()
    assert body["total_invoiced"] == 1500.0
    assert body["total_paid"] == 1000.0
    assert body["lifetime_revenue"] == 1000.0
    assert body["outstanding"] == 500.0
    assert body["invoice_count"] == 2
    assert body["avg_deal_size"] == 750.0
    assert body["days_to_payment"] is not None
    assert "health" not in body


async def test_top_income_sources_ranking(client):
    big = await make_client(client, name="Big Payer", email="big@pay.test")
    small = await make_client(client, name="Small Payer", email="small@pay.test")
    inv1 = await _post_invoice(client, big, "INV-B-1", "sent", 9000)
    inv2 = await _post_invoice(client, small, "INV-S-1", "sent", 100)
    for inv in (inv1, inv2):
        await client.patch(f"/api/v1/invoices/{inv['id']}/status", json={"status": "paid"})

    top = (await client.get("/api/v1/clients/earnings/top")).json()
    assert top[0]["client_id"] == big and top[0]["total_paid"] == 9000.0
    assert top[1]["client_id"] == small


async def test_client_list_response(client):
    await make_client(client, name="Healthy Co", email="h@healthy.test")
    rows = (await client.get("/api/v1/clients")).json()
    assert rows and "name" in rows[0]
    assert "health" not in rows[0] and "health_score" not in rows[0]




# ------------------------------------------------------------------------------
# Project Documents & Files (sandboxed key registration)
# ------------------------------------------------------------------------------
async def test_register_project_file_and_reject_traversal(client, client_b):
    cid = await make_client(client, name="Files Co", email="f@files.test")
    pid = await make_project(client, client_id=cid, budget=3000.0)
    res = await client.post(f"/api/v1/projects/{pid}/files", json={
        "file_key": "brief_v1.pdf", "file_name": "brief.pdf", "content_type": "application/pdf",
        "size_bytes": 1234, "category": "brief",
    })
    assert res.status_code == 201, res.text
    files = (await client.get(f"/api/v1/projects/{pid}/files")).json()
    assert len(files) == 1 and files[0]["file_key"] == "brief_v1.pdf"

    # Path traversal in the key is rejected outright.
    bad = await client.post(f"/api/v1/projects/{pid}/files", json={
        "file_key": "../../secrets.txt", "file_name": "x.txt",
    })
    assert bad.status_code == 422

    # A foreign workspace cannot attach files to (or read) this project.
    assert (await client_b.post(f"/api/v1/projects/{pid}/files", json={
        "file_key": "sneaky.txt", "file_name": "s",
    })).status_code == 404
    assert (await client_b.get(f"/api/v1/projects/{pid}/files")).status_code == 404


# ------------------------------------------------------------------------------
# C6 — relationship strip (Projects, Financials, Contracts, Invoices)
# ------------------------------------------------------------------------------
async def test_relationship_strip_aggregates_cross_page_state(client):
    cid = await make_client(client, name="Relation Co", email="r@relation.test")
    pid = await make_project(client, client_id=cid, budget=2000.0)
    await _make_time_entry(client, pid, seconds=3600, rate=100.0)  # 1h * 100
    await _make_contract(client, pid)                              # unsigned -> 2000
    await _post_invoice(client, cid, "INV-REL-1", "overdue", 350)

    body = (await client.get(f"/api/v1/clients/{cid}/relationship")).json()
    assert body["total_projects"] == 1
    assert body["open_projects"] == 1
    assert body["completed_projects"] == 0
    assert body["total_contracts"] == 1
    assert body["pending_contracts"] == 1
    assert body["total_invoices"] == 1
    assert body["overdue_invoices"] == 1
    assert body["total_revenue"] == 350.0
    assert body["pending_amount"] == 350.0
    assert body["unbilled_hours"] == 1.0
    assert body["unbilled_value"] == 100.0
    assert body["unsigned_contracts"] == 1
    assert body["unsigned_contract_value"] == 2000.0
    assert body["overdue_value"] == 350.0
