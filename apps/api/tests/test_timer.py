"""Live timer-session tests — server-clock-owned, resumable, no fake data."""

import asyncio

from helpers import make_project


async def test_timer_start_then_active(client):
    pid = await make_project(client)
    start = await client.post("/api/v1/timer/start", json={"project_id": pid, "description": "Coding"})
    assert start.status_code == 201, start.text
    session = start.json()
    assert session["is_running"] is True
    assert session["elapsed_seconds"] >= 0

    active = await client.get("/api/v1/timer/active")
    assert active.status_code == 200
    assert active.json()["id"] == session["id"]


async def test_timer_active_is_null_when_nothing_runs(client):
    res = await client.get("/api/v1/timer/active")
    assert res.status_code == 200
    assert res.json() is None


async def test_timer_pause_and_resume(client):
    pid = await make_project(client)
    session = (await client.post("/api/v1/timer/start", json={"project_id": pid})).json()
    sid = session["id"]

    paused = await client.post(f"/api/v1/timer/{sid}/pause")
    assert paused.status_code == 200, paused.text
    assert paused.json()["is_running"] is False

    resumed = await client.post(f"/api/v1/timer/{sid}/resume")
    assert resumed.status_code == 200, resumed.text
    assert resumed.json()["is_running"] is True


async def test_timer_stop_writes_a_real_time_entry(client):
    pid = await make_project(client)
    session = (await client.post("/api/v1/timer/start", json={"project_id": pid})).json()
    sid = session["id"]

    # Let the server clock advance past a full second so a billable entry lands.
    await asyncio.sleep(1.1)
    stopped = await client.post(f"/api/v1/timer/{sid}/stop")
    assert stopped.status_code == 200, stopped.text
    entry = stopped.json()
    assert entry is not None and entry["duration_seconds"] >= 1

    # The stopped run is no longer the active session
    active = await client.get("/api/v1/timer/active")
    assert active.json() is None

    # And the entry shows up in the list the rest of the app bills from
    listing = await client.get("/api/v1/time-entries")
    assert any(e["id"] == entry["id"] for e in listing.json())


async def test_timer_start_flushes_previous_open_run(client):
    p1 = await make_project(client, title="Alpha")
    p2 = await make_project(client, title="Beta")
    await asyncio.sleep(1.05)
    first = (await client.post("/api/v1/timer/start", json={"project_id": p1})).json()

    await asyncio.sleep(1.05)
    # Starting a new project auto-closes the prior run into a TimeEntry
    second = await client.post("/api/v1/timer/start", json={"project_id": p2})
    assert second.status_code == 201, second.text

    listing = await client.get("/api/v1/time-entries")
    assert any(e["project_id"] == p1 and e["duration_seconds"] >= 1 for e in listing.json())
