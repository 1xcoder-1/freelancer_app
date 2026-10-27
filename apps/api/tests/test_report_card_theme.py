"""Report-card portfolio templates: theme rides in the existing settings JSON.

The original four designs collapsed into two — "classic" (the app-theme card)
and "folio" (the ink-and-paper editorial). Legacy ids saved before the rework
map to "classic" so old payloads and old stored rows keep working.
"""


async def _put_settings(client, settings):
    res = await client.put("/api/v1/report-card/me/settings", json={"settings": settings})
    return res


async def test_theme_persists_and_roundtrips(client):
    res = await _put_settings(client, {"font": "inter", "accent": "#0ea5e9", "theme": "folio"})
    assert res.status_code == 200, res.text
    assert res.json()["settings"]["theme"] == "folio"

    # Persisted: the owner GET and the public share read the same stored blob.
    mine = (await client.get("/api/v1/report-card/me")).json()
    assert mine["settings"]["theme"] == "folio"
    assert mine["settings"]["font"] == "inter"

    res = await _put_settings(client, {"font": "inter", "accent": "#0ea5e9", "theme": "classic"})
    assert res.json()["settings"]["theme"] == "classic"


async def test_theme_defaults_and_legacy_mapping(client):
    # Pre-theme payloads keep working and simply get the classic template.
    res = await _put_settings(client, {"font": "geist", "accent": "#f5f5f4"})
    assert res.status_code == 200, res.text
    assert res.json()["settings"]["theme"] == "classic"

    # Ids saved before the classic/folio collapse silently map to classic.
    for legacy in ("midnight", "warm", "editorial"):
        res = await _put_settings(client, {"font": "geist", "accent": "#f5f5f4", "theme": legacy})
        assert res.status_code == 200, f"{legacy!r} rejected"
        assert res.json()["settings"]["theme"] == "classic"

    for bad in ("neon", "portfolio", ""):
        res = await _put_settings(client, {"font": "geist", "accent": "#f5f5f4", "theme": bad})
        assert res.status_code == 422, f"{bad!r} accepted"

    # A rejected write must not corrupt the last good settings.
    mine = (await client.get("/api/v1/report-card/me")).json()
    assert mine["settings"]["theme"] == "classic"
