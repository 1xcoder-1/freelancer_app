"""Planner — todo list + sketch board merged into one workspace surface.

Boards behave like "files": create one, open it, draw + tick todos, real-time
revision protocol (save / 409 stale write), payload validation caps on the
opaque Excalidraw scene, and strict workspace isolation. All through the
public API only.
"""


async def _new_board(client, name="My board"):
    res = await client.post("/api/v1/planner/boards", json={"name": name})
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _full(client, bid):
    res = await client.get(f"/api/v1/planner/boards/{bid}")
    assert res.status_code == 200, res.text
    return res.json()


async def _save(client, bid, rev, elements=None, files=None):
    return await client.put(
        f"/api/v1/planner/boards/{bid}?rev={rev}",
        json={"elements": elements or [], "files": files or {}},
    )


async def test_planner_requires_auth(client):
    from httpx import ASGITransport, AsyncClient
    from app.main import app as fastapi_app

    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as anon:
        res = await anon.get("/api/v1/planner/boards")
        assert res.status_code == 401


async def test_planner_list_starts_empty(client):
    res = await client.get("/api/v1/planner/boards")
    assert res.status_code == 200, res.text
    assert res.json() == []


async def test_planner_create_then_open(client):
    bid = await _new_board(client, "Q1 launch plan")
    boards = (await client.get("/api/v1/planner/boards")).json()
    assert any(b["id"] == bid and b["name"] == "Q1 launch plan" for b in boards)

    full = await _full(client, bid)
    assert full["revision"] == 0
    assert full["elements"] == []
    assert full["files"] == {}
    assert full["todos"] == []


async def test_planner_save_bumps_revision(client):
    bid = await _new_board(client)
    scene = [{"id": "e1", "type": "rectangle", "x": 0, "y": 0}]
    res = await _save(client, bid, 0, elements=scene)
    assert res.status_code == 200, res.text
    assert res.json()["revision"] == 1

    head = await client.get(f"/api/v1/planner/boards/{bid}/head")
    assert head.status_code == 200, head.text
    assert head.json()["revision"] == 1
    # The cheap head poll never carries the scene bytes
    assert "elements" not in head.json()

    full = await _full(client, bid)
    assert full["elements"] == scene


async def test_planner_stale_revision_rejected(client):
    bid = await _new_board(client)
    await _save(client, bid, 0, elements=[{"id": "e1", "type": "text"}])
    # A tab still holding rev 0 must not clobber rev 1
    stale = await _save(client, bid, 0, elements=[{"id": "hacked", "type": "text"}])
    assert stale.status_code == 409
    assert stale.json()["detail"]["revision"] == 1
    assert (await _full(client, bid))["elements"][0]["id"] == "e1"


async def test_planner_todo_crud_and_counts(client):
    bid = await _new_board(client)
    created = await client.post(f"/api/v1/planner/boards/{bid}/todos", json={"text": "Draft proposal"})
    assert created.status_code == 201, created.text
    todo = created.json()
    assert todo["is_done"] is False

    done = await client.patch(f"/api/v1/planner/todos/{todo['id']}", json={"is_done": True})
    assert done.status_code == 200, done.text
    assert done.json()["is_done"] is True

    # The head poll (what tabs watch) reflects the tick immediately
    head = (await client.get(f"/api/v1/planner/boards/{bid}/head")).json()
    assert head["todos"][0]["is_done"] is True

    # List metadata aggregates the counts
    row = next(b for b in (await client.get("/api/v1/planner/boards")).json() if b["id"] == bid)
    assert row["todos_count"] == 1 and row["done_count"] == 1

    deleted = await client.delete(f"/api/v1/planner/todos/{todo['id']}")
    assert deleted.status_code == 204
    assert (await _full(client, bid))["todos"] == []


async def test_planner_todo_validation(client):
    bid = await _new_board(client)
    blank = await client.post(f"/api/v1/planner/boards/{bid}/todos", json={"text": "   "})
    assert blank.status_code == 422
    long = await client.post(f"/api/v1/planner/boards/{bid}/todos", json={"text": "x" * 501})
    assert long.status_code == 422


async def test_planner_scene_validation_caps(client):
    bid = await _new_board(client)
    too_many = await _save(client, bid, 0, elements=[{"id": str(i)} for i in range(2001)])
    assert too_many.status_code == 422

    huge_file = {"f1": {"mimeType": "image/png", "dataURL": "A" * 1_000_001}}
    res = await _save(client, bid, 0, files=huge_file)
    assert res.status_code == 422

    ok = await _save(client, bid, 0, elements=[{"id": "e1", "type": "freedraw"}])
    assert ok.status_code == 200, ok.text


async def test_planner_rename_and_delete(client):
    bid = await _new_board(client, "Old name")
    renamed = await client.patch(f"/api/v1/planner/boards/{bid}", json={"name": "New name"})
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["name"] == "New name"

    await client.post(f"/api/v1/planner/boards/{bid}/todos", json={"text": "cascade me"})
    gone = await client.delete(f"/api/v1/planner/boards/{bid}")
    assert gone.status_code == 204
    # Board and its todos vanish together
    assert (await client.get(f"/api/v1/planner/boards/{bid}")).status_code == 404
    assert (await client.get("/api/v1/planner/boards")).json() == []


async def test_planner_is_workspace_isolated(client, client_b):
    bid = await _new_board(client, "Secret plan")
    todo = await client.post(f"/api/v1/planner/boards/{bid}/todos", json={"text": "Secret scheme"})
    todo_id = todo.json()["id"]
    await _save(client, bid, 0, elements=[{"id": "mine", "type": "text"}])

    # Other tenant can't see the board at all
    assert (await client_b.get("/api/v1/planner/boards")).json() == []
    assert (await client_b.get(f"/api/v1/planner/boards/{bid}")).status_code == 404

    # Cross-tenant id mutation/deletion is a 404, never an edit
    assert (await client_b.patch(f"/api/v1/planner/todos/{todo_id}", json={"is_done": True})).status_code == 404
    assert (await client_b.delete(f"/api/v1/planner/todos/{todo_id}")).status_code == 404
