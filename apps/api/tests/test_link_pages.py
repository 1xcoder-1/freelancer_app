"""Link pages: owner lifecycle, public render + beacon, stats, isolation.

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


async def test_my_page_null_until_created_and_upserts(client):
    res = await client.get("/api/v1/link-pages/my")
    assert res.status_code == 200 and res.json() is None

    page = await _create_page(client)
    assert page["slug"] == "ada-dev" and page["published"] is False
    assert page["views_count"] == 0 and page["items"] == []

    # POST is an upsert: updating keeps the same row.
    updated = await _create_page(client, published=True, display_name="Ada")
    assert updated["id"] == page["id"] and updated["published"] is True
    assert updated["display_name"] == "Ada"


async def test_slug_validation_and_conflict(client, client_b):
    for bad_slug in ("Bad Slug", "a", "x" * 65, "_underscore", "-lead", "trail-"):
        res = await client.post("/api/v1/link-pages/my", json={**PAGE, "slug": bad_slug})
        assert res.status_code == 422, f"{bad_slug!r} accepted: {res.text}"

    await _create_page(client)
    res = await client_b.post("/api/v1/link-pages/my", json={**PAGE})
    assert res.status_code == 409

    # Dots and inner hyphens are legal.
    ok = await client_b.post("/api/v1/link-pages/my", json={**PAGE, "slug": "ada.dev-x2"})
    assert ok.status_code == 200, ok.text


async def test_items_replace_validates_and_orders(client):
    await _create_page(client)

    res = await client.post("/api/v1/link-pages/my/items", json=ITEMS)
    assert res.status_code == 405  # PUT only — full replace is the contract
    res = await client.put("/api/v1/link-pages/my/items", json=ITEMS)
    assert res.status_code == 200, res.text
    items = res.json()["items"]
    assert [i["label"] for i in items] == ["Portfolio", "Book a call", "Newsletter"]
    assert [i["sort_order"] for i in items] == [0, 1, 2]
    assert items[1]["active"] is False

    # Full replace: the list shrinks to exactly what was sent.
    res = await client.put("/api/v1/link-pages/my/items", json={"items": ITEMS["items"][:1]})
    assert len(res.json()["items"]) == 1

    for bad in (
        {"label": "x", "url": "javascript:alert(1)"},
        {"label": "", "url": "https://a.test"},
        {"label": "x", "url": "https://a.test", "description": "d" * 301},
    ):
        res = await client.put("/api/v1/link-pages/my/items", json={"items": [bad]})
        assert res.status_code == 422, res.text


async def test_public_page_visibility_and_shape(client):
    await _create_page(client)  # unpublished
    res = await client.get("/api/v1/link-pages/public/ada-dev")
    assert res.status_code == 404  # unpublished is invisible, like missing

    await client.put("/api/v1/link-pages/my/items", json=ITEMS)
    await _create_page(client, published=True, display_name="Ada")

    # Public routes must work fully unauthenticated.
    del client.headers["Authorization"]
    res = await client.get("/api/v1/link-pages/public/ADA-DEV")
    assert res.status_code == 200, res.text  # slug matching is case-insensitive
    page = res.json()
    assert page["slug"] == "ada-dev" and page["display_name"] == "Ada"
    # Only active items, ordered; no internal counters leak publicly.
    assert [i["label"] for i in page["items"]] == ["Portfolio", "Newsletter"]
    assert "workspace_id" not in page and "views_count" not in page
    assert "clicks_count" not in page["items"][0]

    res = await client.get("/api/v1/link-pages/public/not-a-slug!")
    assert res.status_code == 422


async def test_event_beacon_counters_and_stats(client):
    page = await _create_page(client, published=True)
    items = (await client.put("/api/v1/link-pages/my/items", json=ITEMS)).json()["items"]
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
    assert mine["views_count"] == 3
    assert mine["items"][0]["clicks_count"] == 1

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

    # Days is bounded.
    assert (await client.get("/api/v1/link-pages/my/stats", params={"days": 999})).status_code == 422
    assert (await client.get("/api/v1/link-pages/my/stats")).status_code == 200


async def test_stats_requires_a_page(client):
    res = await client.get("/api/v1/link-pages/my/stats")
    assert res.status_code == 404


async def test_link_pages_are_workspace_scoped(client, client_b):
    mine = await _create_page(client, published=True)
    await _create_page(client_b, slug="sam-work", published=True)

    theirs = (await client_b.get("/api/v1/link-pages/my")).json()
    assert theirs["slug"] == "sam-work"

    await client_b.post(f"/api/v1/link-pages/public/{mine['slug']}/event", json={"event_type": "view"})
    # The beacon hit the public page, not the other workspace's stats.
    assert (await client.get("/api/v1/link-pages/my/stats")).json()["totals"]["views"] == 1
    assert (await client_b.get("/api/v1/link-pages/my/stats")).json()["totals"]["views"] == 0
