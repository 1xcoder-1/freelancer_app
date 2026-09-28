"""Projects hub lifecycle: the task/milestone/project PATCH endpoints that
make progress and the 'completed' state actually reachable."""

from helpers import make_client, make_project


async def _add_task(client, pid, title="Write tests"):
    res = await client.post(f"/api/v1/projects/{pid}/tasks", json={"title": title, "priority": "high"})
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def test_task_status_can_be_completed(client):
    pid = await make_project(client)
    tid = await _add_task(client, pid)

    res = await client.patch(f"/api/v1/projects/{pid}/tasks/{tid}", json={"status": "done"})
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "done"


async def test_task_status_is_whitelisted(client):
    pid = await make_project(client)
    tid = await _add_task(client, pid)
    res = await client.patch(f"/api/v1/projects/{pid}/tasks/{tid}", json={"status": "shipped"})
    assert res.status_code == 422


async def test_task_rejected_when_project_id_mismatches(client):
    pid = await make_project(client, title="Owner")
    other = await make_project(client, title="Other")
    tid = await _add_task(client, pid)
    # Addressing the task under the wrong project id must 404
    res = await client.patch(f"/api/v1/projects/{other}/tasks/{tid}", json={"status": "done"})
    assert res.status_code == 404


async def test_milestone_completion_drives_progress(client):
    pid = await make_project(client)
    # project auto-seeds 3 milestones; complete them all via PATCH
    proj = (await client.get("/api/v1/projects")).json()
    me = next(p for p in proj if p["id"] == pid)
    assert me["progress_pct"] == 0
    for m in me["milestones"]:
        r = await client.patch(
            f"/api/v1/projects/{pid}/milestones/{m['id']}", json={"is_completed": True}
        )
        assert r.status_code == 200, r.text

    after = next(p for p in (await client.get("/api/v1/projects")).json() if p["id"] == pid)
    assert after["progress_pct"] == 100


async def test_project_completed_status_forces_full_progress(client):
    pid = await make_project(client)
    res = await client.patch(f"/api/v1/projects/{pid}", json={"status": "completed"})
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "completed"
    assert res.json()["progress_pct"] == 100


async def test_project_edit_persists_fields(client):
    cid = await make_client(client)
    pid = await make_project(client)
    res = await client.patch(
        f"/api/v1/projects/{pid}", json={"title": "Renamed", "client_id": cid, "budget": 8000.0}
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["title"] == "Renamed"
    assert body["client_id"] == cid
    assert body["budget"] == 8000.0


async def test_proposal_status_lifecycle(client):
    res = await client.post(
        "/api/v1/proposals",
        json={"title": "Pitch", "client_scope": "Redo marketing site", "pitch_content": "Hello", "budget": 2000},
    )
    assert res.status_code == 201, res.text
    prop_id = res.json()["id"]

    ok = await client.patch(f"/api/v1/proposals/{prop_id}/status", json={"status": "accepted"})
    assert ok.status_code == 200, ok.text
    assert ok.json()["status"] == "accepted"

    bad = await client.patch(f"/api/v1/proposals/{prop_id}/status", json={"status": "ghosted"})
    assert bad.status_code == 422
