"""Regression + coverage tests for the timezone-aware calendar crash.

The live bug: GET/POST /calendar/events 500'd on any timezone-aware ISO input
(`...Z` / `+05:00`) because the range landed on naive `timestamp` columns as an
aware parameter. These lock the fix in and prove aware/naive are now equivalent.
"""


async def test_get_events_accepts_tz_aware_range(client):
    start = "2026-01-01T00:00:00Z"
    end = "2026-12-01T00:00:00+05:00"
    res = await client.get("/api/v1/calendar/events", params={"start": start, "end": end})
    assert res.status_code == 200, res.text
    assert isinstance(res.json(), list)


async def test_get_events_rejects_garbage_range(client):
    res = await client.get("/api/v1/calendar/events", params={"start": "not-a-date", "end": "also-bad"})
    assert res.status_code == 400


async def test_get_events_rejects_too_large_window(client):
    res = await client.get(
        "/api/v1/calendar/events",
        params={"start": "2000-01-01T00:00:00Z", "end": "2030-01-01T00:00:00Z"},
    )
    assert res.status_code == 400


async def test_create_event_with_tz_aware_times_stores_naive_utc(client):
    payload = {
        "title": "Standup",
        "event_type": "meeting",
        # 10:00 in a +05:00 offset == 05:00 UTC — the stored value must be naive UTC
        "start_time": "2026-09-01T10:00:00+05:00",
        "end_time": "2026-09-01T10:30:00+05:00",
    }
    res = await client.post("/api/v1/calendar/events", json=payload)
    assert res.status_code == 201, res.text
    body = res.json()
    # No 'Z' and no offset in the echoed value → persisted on the naive-UTC axis
    assert "+" not in body["start_time"] and not body["start_time"].endswith("Z")
    assert body["start_time"].startswith("2026-09-01T05:00:00")

    # And it is now retrievable through an aware range (the original 500 path)
    feed = await client.get(
        "/api/v1/calendar/events",
        params={"start": "2026-08-01T00:00:00Z", "end": "2026-10-01T00:00:00Z"},
    )
    assert feed.status_code == 200
    assert any(item["title"] == "Standup" for item in feed.json())


async def test_create_event_rejects_reversed_range(client):
    payload = {
        "title": "Bad",
        "start_time": "2026-09-02T00:00:00Z",
        "end_time": "2026-09-01T00:00:00Z",
    }
    res = await client.post("/api/v1/calendar/events", json=payload)
    assert res.status_code == 422


async def test_event_type_is_whitelisted(client):
    payload = {
        "title": "Weird",
        "event_type": "not_a_real_type",
        "start_time": "2026-09-01T09:00:00",
        "end_time": "2026-09-01T10:00:00",
    }
    res = await client.post("/api/v1/calendar/events", json=payload)
    assert res.status_code == 422
