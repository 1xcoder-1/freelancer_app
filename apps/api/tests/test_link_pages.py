"""Link pages: owner lifecycle (up to 3 per workspace), public render +
beacon, stats, isolation.

Hermetic: public API only against the throwaway SQLite schema from conftest.
"""

PAGE = {
    "slug": "ada-dev",
    "display_name": "Ada the Freelancer",
    "headline": "APIs & React",
    "bio": "I ship things.",
    "theme": "default",
    "template": "classic",
    "published": False,
}

ITEMS = {
    "items": [
        {"label": "Portfolio", "url": "https://ada.example.com", "icon": "globe"},
        {"label": "Book a call", "url": "https://cal.example.com", "active": False},
        {"label": "Newsletter", "url": "https://ada.example.com/news", "description": "Weekly"},
    ]
}


async def _create_page(client, **overrides):
    res = await client.post("/api/v1/link-pages/my", json={**PAGE, **overrides})
    assert res.status_code == 200, res.text
    return res.json()


async def _update_page(client, page_id, **fields):
    res = await client.put(f"/api/v1/link-pages/my/{page_id}", json=fields)
    assert res.status_code == 200, res.text
    return res.json()


async def test_list_empty_then_create_and_update(client):
    res = await client.get("/api/v1/link-pages/my")
    assert res.status_code == 200 and res.json() == []

    page = await _create_page(client)
    assert page["slug"] == "ada-dev" and page["published"] is False
    assert page["views_count"] == 0 and page["items"] == []
    # Card title falls back to the public display name.
    assert page["name"] == "Ada the Freelancer"

    named = await _create_page(client, slug="ada-links", name="Work")
    assert named["name"] == "Work"

    listing = (await client.get("/api/v1/link-pages/my")).json()
    assert [p["slug"] for p in listing] == ["ada-dev", "ada-links"]

    # Updates are page-scoped PUTs now — POST always creates a new page.
    updated = await _update_page(client, page["id"], published=True, display_name="Ada")
    assert updated["id"] == page["id"] and updated["published"] is True
    assert updated["display_name"] == "Ada"
    # Omitted fields stay.
    assert updated["headline"] == "APIs & React"


async def test_three_page_limit_and_delete_frees_a_slot(client):
    for i in range(3):
        await _create_page(client, slug=f"page-{i}")
    full = await client.post("/api/v1/link-pages/my", json={**PAGE, "slug": "page-4"})
    assert full.status_code == 409 and "up to 3" in full.json()["detail"]

    victim = (await client.get("/api/v1/link-pages/my")).json()[0]
    res = await client.delete(f"/api/v1/link-pages/my/{victim['id']}")
    assert res.status_code == 200 and res.json() == {"deleted": True}

    again = await client.post("/api/v1/link-pages/my", json={**PAGE, "slug": "page-4"})
    assert again.status_code == 200, again.text


async def test_slug_validation_and_conflict(client, client_b):
    for bad_slug in ("Bad Slug", "a", "x" * 65, "_underscore", "-lead", "trail-"):
        res = await client.post("/api/v1/link-pages/my", json={**PAGE, "slug": bad_slug})
        assert res.status_code == 422, f"{bad_slug!r} accepted: {res.text}"

    await _create_page(client)
    res = await client_b.post("/api/v1/link-pages/my", json={**PAGE})
    assert res.status_code == 409

    # A foreign page id is a plain 404 with no workspace hint.
    mine = (await client.get("/api/v1/link-pages/my")).json()[0]
    res = await client_b.put(f"/api/v1/link-pages/my/{mine['id']}", json={"slug": "other"})
    assert res.status_code == 404

    # Dots and inner hyphens are legal.
    ok = await client_b.post("/api/v1/link-pages/my", json={**PAGE, "slug": "ada.dev-x2"})
    assert ok.status_code == 200, ok.text

    dup = await client_b.post("/api/v1/link-pages/my", json={**PAGE, "slug": "ada-dev"})
    assert dup.status_code == 409


async def test_items_replace_validates_and_orders(client):
    page = await _create_page(client)
    items_url = f"/api/v1/link-pages/my/{page['id']}/items"

    res = await client.post(items_url, json=ITEMS)
    assert res.status_code == 405  # PUT only — full replace is the contract
    res = await client.put(items_url, json=ITEMS)
    assert res.status_code == 200, res.text
    items = res.json()["items"]
    assert [i["label"] for i in items] == ["Portfolio", "Book a call", "Newsletter"]
    assert [i["sort_order"] for i in items] == [0, 1, 2]
    assert items[1]["active"] is False

    # Full replace: the list shrinks to exactly what was sent.
    res = await client.put(items_url, json={"items": ITEMS["items"][:1]})
    assert len(res.json()["items"]) == 1

    for bad in (
        {"label": "x", "url": "javascript:alert(1)"},
        {"label": "", "url": "https://a.test"},
        {"label": "x", "url": "https://a.test", "description": "d" * 301},
    ):
        res = await client.put(items_url, json={"items": [bad]})
        assert res.status_code == 422, res.text


async def test_public_page_visibility_and_shape(client):
    page = await _create_page(client)  # unpublished
    res = await client.get("/api/v1/link-pages/public/ada-dev")
    assert res.status_code == 404  # unpublished is invisible, like missing

    await client.put(f"/api/v1/link-pages/my/{page['id']}/items", json=ITEMS)
    await _update_page(client, page["id"], published=True, display_name="Ada")

    # Public routes must work fully unauthenticated.
    del client.headers["Authorization"]
    res = await client.get("/api/v1/link-pages/public/ADA-DEV")
    assert res.status_code == 200, res.text  # slug matching is case-insensitive
    public = res.json()
    assert public["slug"] == "ada-dev" and public["display_name"] == "Ada"
    # Only active items, ordered; no internal counters leak publicly.
    assert [i["label"] for i in public["items"]] == ["Portfolio", "Newsletter"]
    assert "workspace_id" not in public and "views_count" not in public
    assert "clicks_count" not in public["items"][0]

    res = await client.get("/api/v1/link-pages/public/not-a-slug!")
    assert res.status_code == 422


async def test_event_beacon_counters_and_stats(client):
    page = await _create_page(client, published=True)
    items = (
        await client.put(f"/api/v1/link-pages/my/{page['id']}/items", json=ITEMS)
    ).json()["items"]
    portfolio = items[0]["id"]
    event_url = f"/api/v1/link-pages/public/{page['slug']}/event"

    # Bogus payloads are 422; foreign item ids 404.
    assert (await client.post(event_url, json={"event_type": "submit"})).status_code == 422
    assert (await client.post(event_url, json={"event_type": "click"})).status_code == 422
    assert (await client.post(event_url, json={"event_type": "click", "item_id": "nope"})).status_code == 404

    for ref in ("https://news.ycombinator.com/f/123?x=1#top", "https://news.ycombinator.com/f/123?y=2"):
        res = await client.post(event_url, json={"event_type": "view", "referrer": ref})
        assert res.status_code == 200 and res.json() == {"recorded": True, "event_type": "view"}
    await client.post(event_url, json={"event_type": "view"})  # no referrer -> direct
    await client.post(event_url, json={"event_type": "click", "item_id": portfolio})

    mine = (await client.get("/api/v1/link-pages/my")).json()
    assert mine[0]["views_count"] == 3
    assert mine[0]["items"][0]["clicks_count"] == 1

    res = await client.get("/api/v1/link-pages/my/stats", params={"days": 7})
    assert res.status_code == 200, res.text
    stats = res.json()
    assert stats["range_days"] == 7
    assert stats["totals"] == {"views": 3, "clicks": 1, "ctr": 33.3}
    assert len(stats["daily"]) == 7  # zero-filled window
    assert stats["daily"][-1]["views"] == 3 and stats["daily"][-1]["clicks"] == 1
    assert sum(d["views"] for d in stats["daily"]) == 3
    assert stats["items"] == [
        {"id": portfolio, "label": "Portfolio", "url": "https://ada.example.com", "clicks": 1}
    ]
    refs = {r["referrer"]: r["views"] for r in stats["top_referrers"]}
    # Query + fragment stripped, both HN hits bucket together.
    assert refs == {"news.ycombinator.com/f/123": 2, "direct": 1}

    # The per-page window matches the aggregate for a single page.
    per_page = (await client.get(f"/api/v1/link-pages/my/{page['id']}/stats", params={"days": 7})).json()
    assert per_page["totals"] == stats["totals"]

    # Days is bounded.
    assert (await client.get("/api/v1/link-pages/my/stats", params={"days": 999})).status_code == 422
    assert (await client.get("/api/v1/link-pages/my/stats")).status_code == 200


async def test_stats_requires_a_page(client):
    res = await client.get("/api/v1/link-pages/my/stats")
    assert res.status_code == 404


async def test_link_pages_are_workspace_scoped(client, client_b):
    mine = await _create_page(client, published=True)
    theirs = await _create_page(client_b, slug="sam-work", published=True)

    listing = (await client_b.get("/api/v1/link-pages/my")).json()
    assert [p["slug"] for p in listing] == ["sam-work"]

    await client_b.post(f"/api/v1/link-pages/public/{mine['slug']}/event", json={"event_type": "view"})
    # The beacon hit the public page, not the other workspace's stats.
    assert (await client.get("/api/v1/link-pages/my/stats")).json()["totals"]["views"] == 1
    assert (await client_b.get("/api/v1/link-pages/my/stats")).json()["totals"]["views"] == 0

    # Foreign page ids are 404 on every owner route.
    for method, url in (
        ("put", f"/api/v1/link-pages/my/{theirs['id']}"),
        ("delete", f"/api/v1/link-pages/my/{theirs['id']}"),
        ("put", f"/api/v1/link-pages/my/{theirs['id']}/items"),
        ("get", f"/api/v1/link-pages/my/{theirs['id']}/stats"),
    ):
        body = {} if method == "put" and url.endswith(theirs["id"]) else (
            {"items": []} if (method == "put" and url.endswith("/items")) else None
        )
        res = await client.request(method, url, json=body)
        assert res.status_code == 404, f"{method} {url} -> {res.status_code}"
