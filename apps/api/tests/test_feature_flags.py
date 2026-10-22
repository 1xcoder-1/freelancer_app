"""Feature flags — global dashboard feature visibility.

Covers the owner bypass, the upsert round-trip (visibility + sidebar label
overrides), key validation, and the 403 wall that keeps non-owner accounts
from flipping what everyone else sees.
"""

import pytest

from app.core.config import settings
from app.api.v1.endpoints import feature_flags


@pytest.fixture
def non_owner(monkeypatch):
    """Simulate a real deployment: a mock token is still a plain account when
    it was not issued by the dev-auth path, and real sessions are never owners
    just because ALLOW_DEV_AUTH is on."""
    monkeypatch.setattr(feature_flags, "_is_dev_session", lambda _user: False)
    monkeypatch.setattr(settings, "OWNER_EMAILS", "tsjoker14311211@gmail.com")


async def test_dev_auth_session_is_owner_and_starts_empty(client):
    res = await client.get("/api/v1/feature-flags")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["is_owner"] is True
    assert body["flags"] == []


async def test_toggle_and_label_roundtrip(client):
    res = await client.put("/api/v1/feature-flags", json={"key": "planner", "visible": False})
    assert res.status_code == 200, res.text
    assert res.json()["visible"] is False

    # Sidebar entries beyond the top-level groups rename via composite keys.
    res = await client.put(
        "/api/v1/feature-flags", json={"key": "clients.leads", "label_override": "Leads"}
    )
    assert res.status_code == 200, res.text
    assert res.json()["label_override"] == "Leads"

    listing = (await client.get("/api/v1/feature-flags")).json()
    by_key = {f["key"]: f for f in listing["flags"]}
    assert by_key["planner"]["visible"] is False
    assert by_key["clients.leads"]["label_override"] == "Leads"


async def test_empty_label_override_resets_to_default(client):
    res = await client.put(
        "/api/v1/feature-flags", json={"key": "money", "label_override": "  "}
    )
    assert res.status_code == 200, res.text
    assert res.json()["label_override"] is None


async def test_explicit_null_label_override_resets_to_default(client):
    res = await client.put(
        "/api/v1/feature-flags", json={"key": "money", "label_override": "Cash"}
    )
    assert res.json()["label_override"] == "Cash"

    res = await client.put(
        "/api/v1/feature-flags", json={"key": "money", "label_override": None}
    )
    assert res.status_code == 200, res.text
    assert res.json()["label_override"] is None


async def test_unknown_keys_rejected(client):
    for key in ("not-a-feature", "nope.leads", "Money", ""):
        res = await client.put("/api/v1/feature-flags", json={"key": key, "visible": False})
        assert res.status_code == 422, f"{key!r} should be rejected"


async def test_non_owner_cannot_write(client_b, non_owner):
    res = await client_b.put("/api/v1/feature-flags", json={"key": "planner", "visible": False})
    assert res.status_code == 403, res.text


async def test_client_supplied_owner_email_is_not_trusted(client_b, non_owner):
    # A query param alone must never unlock owner controls.
    res = await client_b.put(
        "/api/v1/feature-flags?email=TSJOKER14311211@gmail.com",
        json={"key": "planner", "visible": False},
    )
    assert res.status_code == 403, res.text

    listing = await client_b.get("/api/v1/feature-flags?email=tsjoker14311211@gmail.com")
    assert listing.json()["is_owner"] is False


async def test_verified_clerk_email_unlocks_write(client_b, non_owner, monkeypatch):
    # When the session token omits the email claim, the param is only honored
    # after Clerk resolves the authenticated user's real address.
    async def fake_clerk_email(user_id: str) -> str:
        assert user_id == "mock_token_tester_b"
        return "tsjoker14311211@gmail.com"

    monkeypatch.setattr(feature_flags, "_clerk_email", fake_clerk_email)
    res = await client_b.put(
        "/api/v1/feature-flags?email=tsjoker14311211@gmail.com",
        json={"key": "planner", "visible": False},
    )
    assert res.status_code == 200, res.text


async def test_verified_session_email_is_owner(non_owner):
    assert await feature_flags._is_owner(
        {"user_id": "user_real", "email": "TSJOKER14311211@gmail.com"}, None
    ) is True
