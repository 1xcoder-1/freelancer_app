"""Phase 5 — Projects productivity (P1 unbilled hours, P3 change requests,
P4 task dates, P5 actual-vs-estimated, P6 deliverable sign-off, SE4 portal).

Hermetic by convention: HTTP-driven against the throwaway SQLite schema, and the
P4 daily-briefing cron is exercised through its module-level helper exactly like
the other job tests.
"""

from datetime import date, datetime, timedelta

from helpers import make_client, make_project

from app.inngest_functions.project_jobs import today_tasks


async def _make_time_entry(client, project_id, seconds=3600, rate=100.0, task_id=None):
    payload = {
        "project_id": project_id,
        "duration_seconds": seconds,
        "hourly_rate": rate,
        "is_billable": True,
    }
    if task_id:
        payload["task_id"] = task_id
    res = await client.post("/api/v1/time-entries", json=payload)
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _make_task(client, project_id, title="Build page", due_date=None, estimated_hours=3.0):
    payload = {"title": title, "estimated_hours": estimated_hours}
    if due_date:
        payload["due_date"] = due_date
    res = await client.post(f"/api/v1/projects/{project_id}/tasks", json=payload)
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _portal_token(client, project_id):
    body = (await client.get(f"/api/v1/projects/{project_id}")).json()
    return body["share_token"], body["milestones"][0]["id"]


# ------------------------------------------------------------------------------
# P1 — recover unbilled hours on the project that earned them
# ------------------------------------------------------------------------------
async def test_project_unbilled_hours_derivation(client):
    cid = await make_client(client, name="Billable Co", email="b@bill.test")
    pid = await make_project(client, client_id=cid, budget=1000.0)
    await _make_time_entry(client, pid, seconds=7200, rate=50.0)  # 2h * 50 = 100

    detail = (await client.get(f"/api/v1/projects/{pid}")).json()
    assert detail["unbilled_hours"] == 2.0
    assert detail["unbilled_value"] == 100.0

    unb = (await client.get(f"/api/v1/projects/{pid}/unbilled-time")).json()
    assert unb["project_id"] == pid
    assert unb["hours"] == 2.0
    assert unb["value"] == 100.0
    assert len(unb["entries"]) == 1

    # Billing the hours clears the unbilled backlog (via time_entry_ids).
    entry_id = unb["entries"][0]["id"]
    res = await client.post("/api/v1/invoices", json={
        "client_id": cid,
        "invoice_number": "INV-P1-1",
        "status": "sent",
        "items": [{"description": "Work", "quantity": 1, "unit_price": 100.0}],
        "time_entry_ids": [entry_id],
    })
    assert res.status_code == 201, res.text

    after = (await client.get(f"/api/v1/projects/{pid}/unbilled-time")).json()
    assert after["hours"] == 0.0 and after["entries"] == []


# ------------------------------------------------------------------------------
# P1 bug check — project invoice list filters by project_id, not client_id
# ------------------------------------------------------------------------------
async def test_invoice_list_filters_by_project_id(client, client_b):
    cid = await make_client(client, name="Two Projects", email="two@proj.test")
    pid_a = await make_project(client, client_id=cid, title="Project A")
    pid_b = await make_project(client, client_id=cid, title="Project B")

    entry_a = await _make_time_entry(client, pid_a, seconds=3600, rate=80.0)
    inv = await client.post("/api/v1/invoices", json={
        "client_id": cid,
        "invoice_number": "INV-A-ONLY",
        "status": "sent",
        "items": [{"description": "A work", "quantity": 1, "unit_price": 80.0}],
        "time_entry_ids": [entry_a],
    })
    assert inv.status_code == 201, inv.text
    assert inv.json()["project_id"] == pid_a

    # ?project_id=A returns only A's invoice; ?project_id=B returns none — the
    # old client_id filter would have leaked A into B's page.
    a_rows = (await client.get(f"/api/v1/invoices?project_id={pid_a}")).json()
    assert [r["id"] for r in a_rows] == [inv.json()["id"]]
    b_rows = (await client.get(f"/api/v1/invoices?project_id={pid_b}")).json()
    assert b_rows == []

    # A foreign workspace's project id is a 404, never a silent empty list.
    assert (await client_b.get(f"/api/v1/invoices?project_id={pid_a}")).status_code == 404


# ------------------------------------------------------------------------------
# P4 — real task due dates + the daily briefing buckets
# ------------------------------------------------------------------------------
async def test_task_due_date_roundtrip_and_briefing(client):
    cid = await make_client(client, name="Tasks Co", email="t@tasks.test")
    pid = await make_project(client, client_id=cid)
    await _make_task(client, pid, title="late thing", due_date="2020-01-01")
    today = date.today()
    await _make_task(client, pid, title="today thing", due_date=today.isoformat())

    tasks = (await client.get(f"/api/v1/projects/{pid}")).json()["tasks"]
    by_title = {t["title"]: t for t in tasks}
    assert by_title["late thing"]["due_date"] == "2020-01-01"
    assert by_title["today thing"]["due_date"] == today.isoformat()

    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        brief = await today_tasks(session, on_date=today)
    assert brief["overdue_count"] >= 1
    assert brief["due_today_count"] >= 1
    assert any(i["title"] == "late thing" for i in brief["overdue"])


# ------------------------------------------------------------------------------
# P5 — actual vs estimated via TimeEntry.task_id (validated, never mis-linked)
# ------------------------------------------------------------------------------
async def test_task_actual_hours_and_task_id_validation(client):
    cid = await make_client(client, name="Actual Co", email="a@actual.test")
    pid = await make_project(client, client_id=cid)
    tid = await _make_task(client, pid, title="est 3h", estimated_hours=3.0)
    await _make_time_entry(client, pid, seconds=5400, rate=60.0, task_id=tid)  # 1.5h

    detail = (await client.get(f"/api/v1/projects/{pid}")).json()
    task = next(t for t in detail["tasks"] if t["id"] == tid)
    assert task["actual_hours"] == 1.5

    # A task_id that does not belong to the target project is rejected (400),
    # so hours can never be mis-attributed across projects.
    other_pid = await make_project(client, client_id=cid, title="Other")
    bad = await client.post("/api/v1/time-entries", json={
        "project_id": other_pid, "task_id": tid, "duration_seconds": 60, "hourly_rate": 1.0,
    })
    assert bad.status_code == 400


# ------------------------------------------------------------------------------
# P3 + SE4 — change request status machine, recipient-guarded portal decisions
# ------------------------------------------------------------------------------
async def test_change_request_requires_recipient_verification(client):
    cid = await make_client(client, name="Scope Co", email="s@scope.test")
    pid = await make_project(client, client_id=cid)
    cr = await client.post(f"/api/v1/projects/{pid}/change-requests", json={
        "title": "Add i18n", "detail": "Full translation", "price": 1200.0, "impact_days": 5,
    })
    assert cr.status_code == 201, cr.text
    cr_id = cr.json()["id"]
    assert cr.json()["status"] == "requested"

    token, _ = await _portal_token(client, pid)

    # An unverified token cannot decide anything (SE4) — no recipient captured.
    early = await client.post(
        f"/api/v1/projects/portal/{token}/change-requests/{cr_id}/decide",
        json={"decision": "approved", "email": "someone@else.test"},
    )
    assert early.status_code == 403

    # Capture the recipient email once.
    ver = await client.post(f"/api/v1/projects/portal/{token}/verify", json={"email": "client@scope.test"})
    assert ver.status_code == 200, ver.text
    assert ver.json()["recipient_verified"] is True

    # A mismatched email is still refused after verification.
    mismatch = await client.post(
        f"/api/v1/projects/portal/{token}/change-requests/{cr_id}/decide",
        json={"decision": "approved", "email": "attacker@other.test"},
    )
    assert mismatch.status_code == 403

    # The verified recipient approves -> status machine advances + audit stamp.
    ok = await client.post(
        f"/api/v1/projects/portal/{token}/change-requests/{cr_id}/decide",
        json={"decision": "approved", "email": "client@scope.test", "note": "go ahead"},
    )
    assert ok.status_code == 200, ok.text
    decided = next(c for c in ok.json()["change_requests"] if c["id"] == cr_id)
    assert decided["status"] == "approved"
    assert decided["decided_at"] is not None

    # Once decided it cannot be re-decided (409).
    again = await client.post(
        f"/api/v1/projects/portal/{token}/change-requests/{cr_id}/decide",
        json={"decision": "rejected", "email": "client@scope.test"},
    )
    assert again.status_code == 409


# ------------------------------------------------------------------------------
# P6 — deliverable sign-off (submit clock + recipient-guarded approval)
# ------------------------------------------------------------------------------
async def test_milestone_submit_and_portal_signoff(client):
    cid = await make_client(client, name="Deliver Co", email="d@deliver.test")
    pid = await make_project(client, client_id=cid)
    token, milestone_id = await _portal_token(client, pid)

    sub = await client.post(
        f"/api/v1/projects/{pid}/milestones/{milestone_id}/submit",
        json={"note": "staged for review"},
    )
    assert sub.status_code == 200, sub.text
    assert sub.json()["submitted_at"] is not None
    assert sub.json()["is_completed"] is False

    # Approval without a verified recipient is refused (SE4).
    unverified = await client.post(
        f"/api/v1/projects/portal/{token}/milestones/{milestone_id}/approve",
        json={"email": "d@deliver.test"},
    )
    assert unverified.status_code == 403

    await client.post(f"/api/v1/projects/portal/{token}/verify", json={"email": "d@deliver.test"})
    approved = await client.post(
        f"/api/v1/projects/portal/{token}/milestones/{milestone_id}/approve",
        json={"email": "d@deliver.test"},
    )
    assert approved.status_code == 200, approved.text
    ms = next(m for m in approved.json()["milestones"] if m["id"] == milestone_id)
    assert ms["is_completed"] is True
    assert ms["approved_at"] is not None


# ------------------------------------------------------------------------------
# P2 — deadline verdict derives from the real due_date column
# ------------------------------------------------------------------------------
async def test_deadline_verdict_from_due_date(client):
    cid = await make_client(client, name="Deadline Co", email="dl@deadline.test")
    past = (datetime.utcnow() - timedelta(days=4)).date().isoformat()
    res = await client.post("/api/v1/projects", json={
        "title": "Overdue site", "client_id": cid, "budget": 1000.0,
        "start_date": (datetime.utcnow() - timedelta(days=30)).date().isoformat(),
        "due_date": past,
    })
    assert res.status_code == 201, res.text
    detail = (await client.get(f"/api/v1/projects/{res.json()['id']}")).json()
    assert detail["deadline"]["verdict"] == "overdue"
    assert detail["deadline"]["days_left"] < 0
    assert detail["due_date"] == past
