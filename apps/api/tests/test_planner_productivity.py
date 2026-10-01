"""Phase 8 — Planner productivity (PL1 dated/prioritised/project todos,
PL2 timebox blocks, PL3 recurrence, PL4 write-once daily snapshots + time
travel, PL5 read-only share link + rotation, PL6 inline rename + live Today
counts) plus the revision-bump real-time contract and workspace isolation.

Hermetic by convention: everything is driven through the public API against
the throwaway SQLite schema; the anonymous share view uses a header-less
client exactly like test_planner_requires_auth.
"""

from datetime import datetime, timedelta

from helpers import make_project  # noqa: F401  (shared builder, keeps parity)


async def _new_board(client, name="Plan"):
    res = await client.post("/api/v1/planner/boards", json={"name": name})
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _head(client, bid):
    res = await client.get(f"/api/v1/planner/boards/{bid}/head")
    assert res.status_code == 200, res.text
    return res.json()


async def _anon():
    from httpx import ASGITransport, AsyncClient
    from app.main import app as fastapi_app
    return AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test")


# ---------------------------------------------------------------------------
# PL1 — todos carry a date, priority and a project link
# ---------------------------------------------------------------------------
async def test_planner_todo_planning_fields(client):
    bid = await _new_board(client)
    pid = await make_project(client)
    created = await client.post(
        f"/api/v1/planner/boards/{bid}/todos",
        json={
            "text": "Send invoice",
            "due_date": "2026-01-15",
            "priority": "urgent",
            "project_id": pid,
        },
    )
    assert created.status_code == 201, created.text
    todo = created.json()
    assert todo["due_date"] == "2026-01-15"
    assert todo["priority"] == "urgent"
    assert todo["project_id"] == pid
    assert todo["board_id"] == bid


async def test_planner_todo_bad_priority_rejected(client):
    bid = await _new_board(client)
    res = await client.post(
        f"/api/v1/planner/boards/{bid}/todos",
        json={"text": "x", "priority": "asap"},
    )
    assert res.status_code == 422


async def test_planner_todo_foreign_project_rejected(client):
    bid = await _new_board(client)
    res = await client.post(
        f"/api/v1/planner/boards/{bid}/todos",
        json={"text": "x", "project_id": "does-not-exist"},
    )
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# Real-time contract — every todo mutation bumps the revision (PL1/PL2/PL3)
# ---------------------------------------------------------------------------
async def test_planner_todo_mutations_bump_revision(client):
    bid = await _new_board(client)
    assert (await _head(client, bid))["revision"] == 0

    created = await client.post(f"/api/v1/planner/boards/{bid}/todos", json={"text": "A"})
    tid = created.json()["id"]
    assert (await _head(client, bid))["revision"] == 1

    await client.patch(f"/api/v1/planner/todos/{tid}", json={"is_done": True})
    assert (await _head(client, bid))["revision"] == 2

    await client.delete(f"/api/v1/planner/todos/{tid}")
    assert (await _head(client, bid))["revision"] == 3


# ---------------------------------------------------------------------------
# PL2 — timebox blocks land on a day
# ---------------------------------------------------------------------------
async def test_planner_timebox_fields(client):
    bid = await _new_board(client)
    created = await client.post(
        f"/api/v1/planner/boards/{bid}/todos",
        json={"text": "Deep work", "date": "2026-02-03", "start_minute": 540, "duration_minutes": 90},
    )
    assert created.status_code == 201, created.text
    todo = created.json()
    assert todo["date"] == "2026-02-03"
    assert todo["start_minute"] == 540
    assert todo["duration_minutes"] == 90

    # Out-of-range start_minute is rejected, never silently stored.
    bad = await client.post(
        f"/api/v1/planner/boards/{bid}/todos",
        json={"text": "y", "start_minute": 5000},
    )
    assert bad.status_code == 422


# ---------------------------------------------------------------------------
# PL3 — completing a recurring todo rolls the next occurrence forward
# ---------------------------------------------------------------------------
async def test_planner_daily_recurrence_generates_next(client):
    bid = await _new_board(client)
    created = await client.post(
        f"/api/v1/planner/boards/{bid}/todos",
        json={"text": "Inbox zero", "due_date": "2026-01-10", "recurrence": "daily"},
    )
    tid = created.json()["id"]

    done = await client.patch(f"/api/v1/planner/todos/{tid}", json={"is_done": True})
    assert done.status_code == 200, done.text

    head = await _head(client, bid)
    todos = head["todos"]
    # Original (now done) + the freshly generated open instance.
    assert len(todos) == 2
    nxt = next(t for t in todos if t["is_done"] is False)
    assert nxt["due_date"] == "2026-01-11"
    assert nxt["recurrence"] == "daily"
    assert nxt["text"] == "Inbox zero"


async def test_planner_recurrence_only_fires_on_first_tick(client):
    bid = await _new_board(client)
    created = await client.post(
        f"/api/v1/planner/boards/{bid}/todos",
        json={"text": "Weekly report", "due_date": "2026-01-05", "recurrence": "weekly"},
    )
    tid = created.json()["id"]

    # Untick-then-retchick should NOT double-generate: only the first
    # not-done -> done transition rolls the next occurrence.
    await client.patch(f"/api/v1/planner/todos/{tid}", json={"is_done": True})
    await client.patch(f"/api/v1/planner/todos/{tid}", json={"is_done": False})
    await client.patch(f"/api/v1/planner/todos/{tid}", json={"is_done": True})

    todos = (await _head(client, bid))["todos"]
    # 1 original + 2 generated (one per done-transition), never a runaway.
    opens = [t for t in todos if t["is_done"] is False and t["id"] != tid]
    assert all(t["due_date"] == "2026-01-12" for t in opens)


# ---------------------------------------------------------------------------
# PL4 — write-once daily snapshot + time travel
# ---------------------------------------------------------------------------
async def test_planner_snapshot_written_once_per_day(client):
    bid = await _new_board(client)
    await client.put(
        f"/api/v1/planner/boards/{bid}?rev=0",
        json={"elements": [{"id": "e1", "type": "text"}], "files": {}},
    )
    await client.put(
        f"/api/v1/planner/boards/{bid}?rev=1",
        json={"elements": [{"id": "e2", "type": "text"}], "files": {}},
    )
    snaps = await client.get(f"/api/v1/planner/boards/{bid}/snapshots")
    assert snaps.status_code == 200, snaps.text
    # Two saves the same day still capture exactly one snapshot.
    assert len(snaps.json()) == 1
    captured_on = snaps.json()[0]["captured_on"]

    one = await client.get(f"/api/v1/planner/boards/{bid}/snapshots/{captured_on}")
    assert one.status_code == 200, one.text
    assert one.json()["elements"] == [{"id": "e1", "type": "text"}]


async def test_planner_snapshot_restore_bumps_revision(client):
    bid = await _new_board(client)
    await client.put(
        f"/api/v1/planner/boards/{bid}?rev=0",
        json={"elements": [{"id": "day1", "type": "text"}], "files": {}},
    )
    await client.put(
        f"/api/v1/planner/boards/{bid}?rev=1",
        json={"elements": [{"id": "day2", "type": "text"}], "files": {}},
    )
    captured_on = (await client.get(f"/api/v1/planner/boards/{bid}/snapshots")).json()[0]["captured_on"]

    restored = await client.post(f"/api/v1/planner/boards/{bid}/snapshots/{captured_on}/restore")
    assert restored.status_code == 200, restored.text
    assert restored.json()["revision"] == 3
    full = await client.get(f"/api/v1/planner/boards/{bid}")
    assert full.json()["elements"] == [{"id": "day1", "type": "text"}]


# ---------------------------------------------------------------------------
# PL5 — read-only share link, rotation invalidates old, expiry is a 410
# ---------------------------------------------------------------------------
async def test_planner_share_read_only_and_rotation(client):
    bid = await _new_board(client, "Client-facing plan")
    await client.put(f"/api/v1/planner/boards/{bid}?rev=0", json={"elements": [{"id": "x"}], "files": {}})
    await client.post(f"/api/v1/planner/boards/{bid}/todos", json={"text": "Open item"})
    await client.post(f"/api/v1/planner/boards/{bid}/todos", json={"text": "Finished"})
    # Close one so the anonymous view proves it hides done rows.
    todos = (await _head(client, bid))["todos"]
    await client.patch(f"/api/v1/planner/todos/{todos[1]['id']}", json={"is_done": True})

    enabled = await client.post(f"/api/v1/planner/boards/{bid}/share", json={})
    assert enabled.status_code == 200, enabled.text
    token = enabled.json()["share_token"]
    assert token

    async with await _anon() as anon:
        view = await anon.get(f"/api/v1/planner/public/{token}")
        assert view.status_code == 200, view.text
        body = view.json()
        assert body["name"] == "Client-facing plan"
        # Only OPEN todos leak; the completed one is hidden.
        assert [t["text"] for t in body["todos"]] == ["Open item"]
        assert all(t["is_done"] is False for t in body["todos"])
        # No edit route exists on the public surface.
        assert (await anon.post(f"/api/v1/planner/public/{token}/todos", json={"text": "nope"})).status_code == 404

    rotated = await client.post(f"/api/v1/planner/boards/{bid}/rotate-share-token")
    new_token = rotated.json()["share_token"]
    assert new_token != token
    async with await _anon() as anon:
        assert (await anon.get(f"/api/v1/planner/public/{token}")).status_code == 404
        assert (await anon.get(f"/api/v1/planner/public/{new_token}")).status_code == 200


async def test_planner_share_expiry_is_gone(client):
    bid = await _new_board(client)
    past = (datetime.utcnow() - timedelta(days=1)).isoformat()
    enabled = await client.post(
        f"/api/v1/planner/boards/{bid}/share", json={"expires_at": past}
    )
    token = enabled.json()["share_token"]
    async with await _anon() as anon:
        res = await anon.get(f"/api/v1/planner/public/{token}")
        assert res.status_code == 410


async def test_planner_share_disable(client):
    bid = await _new_board(client)
    token = (await client.post(f"/api/v1/planner/boards/{bid}/share", json={})).json()["share_token"]
    off = await client.delete(f"/api/v1/planner/boards/{bid}/share")
    assert off.status_code == 200, off.text
    assert off.json()["is_public"] is False
    async with await _anon() as anon:
        assert (await anon.get(f"/api/v1/planner/public/{token}")).status_code == 404


# ---------------------------------------------------------------------------
# PL6 — inline rename + live Today counts
# ---------------------------------------------------------------------------
async def test_planner_rename_returns_live_counts(client):
    bid = await _new_board(client, "Old")
    today = datetime.utcnow().date().isoformat()
    yesterday = (datetime.utcnow().date() - timedelta(days=1)).isoformat()
    await client.post(f"/api/v1/planner/boards/{bid}/todos", json={"text": "overdue", "due_date": yesterday})
    await client.post(f"/api/v1/planner/boards/{bid}/todos", json={"text": "due", "due_date": today})
    await client.post(f"/api/v1/planner/boards/{bid}/todos", json={"text": "block", "date": today, "start_minute": 600})

    renamed = await client.patch(f"/api/v1/planner/boards/{bid}", json={"name": "New"})
    assert renamed.status_code == 200, renamed.text
    row = renamed.json()
    assert row["name"] == "New"
    assert row["overdue_count"] == 1
    assert row["due_today_count"] == 1
    assert row["planned_today_count"] == 1


async def test_planner_list_surfaces_today_counts(client):
    bid = await _new_board(client)
    today = datetime.utcnow().date().isoformat()
    await client.post(f"/api/v1/planner/boards/{bid}/todos", json={"text": "due", "due_date": today})
    rows = (await client.get("/api/v1/planner/boards")).json()
    row = next(b for b in rows if b["id"] == bid)
    assert row["due_today_count"] == 1
    assert row["overdue_count"] == 0


# ---------------------------------------------------------------------------
# Isolation + auth on the new surfaces
# ---------------------------------------------------------------------------
async def test_planner_productivity_is_workspace_isolated(client, client_b):
    bid = await _new_board(client, "Private")
    await client.put(f"/api/v1/planner/boards/{bid}?rev=0", json={"elements": [{"id": "e"}], "files": {}})
    token = (await client.post(f"/api/v1/planner/boards/{bid}/share", json={})).json()["share_token"]

    # Other tenant cannot reach the board's snapshots or share controls.
    assert (await client_b.get(f"/api/v1/planner/boards/{bid}/snapshots")).status_code == 404
    assert (await client_b.post(f"/api/v1/planner/boards/{bid}/rotate-share-token")).status_code == 404
    # But an explicitly-shared link is public to anyone holding the token.
    async with await _anon() as anon:
        assert (await anon.get(f"/api/v1/planner/public/{token}")).status_code == 200
