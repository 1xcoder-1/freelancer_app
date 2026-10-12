"""Report-card profile themes: theme rides in the existing settings JSON.

No new column — CardSettings gained a whitelisted `theme` key, so old payloads
(without it) and old stored rows (without it) keep working via the default.
"""


async def _put_settings(client, settings):
    res = await client.put("/api/v1/report-card/me/settings", json={"settings": settings})
    return res


async def test_theme_persists_and_roundtrips(client):
    res = await _put_settings(client, {"font": "inter", "accent": "#0ea5e9", "theme": "midnight"})
    assert res.status_code == 200, res.text
    assert res.json()["settings"]["theme"] == "midnight"

    # Persisted: the owner GET and the public share read the same stored blob.
    mine = (await client.get("/api/v1/report-card/me")).json()
    assert mine["settings"]["theme"] == "midnight"
    assert mine["settings"]["font"] == "inter"

    res = await _put_settings(client, {"font": "inter", "accent": "#0ea5e9", "theme": "warm"})
    assert res.json()["settings"]["theme"] == "warm"


async def test_theme_defaults_and_whitelist(client):
    # Pre-theme payloads keep working and simply get the default theme.
    res = await _put_settings(client, {"font": "geist", "accent": "#f5f5f4"})
    assert res.status_code == 200, res.text
    assert res.json()["settings"]["theme"] == "default"

    for bad in ("neon", "DEFAULT", ""):
        res = await _put_settings(client, {"font": "geist", "accent": "#f5f5f4", "theme": bad})
        assert res.status_code == 422, f"{bad!r} accepted"

    # A rejected write must not corrupt the last good settings.
    mine = (await client.get("/api/v1/report-card/me")).json()
    assert mine["settings"]["theme"] == "default"
