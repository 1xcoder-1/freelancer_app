"""Phase 9 — security & integrity regression pass over the new surface.

These are the cross-cutting guards the plan calls out (SE5/SE6/SE9/SE10 plus the
rate-limit and tenant-isolation invariants every new public/protected route must
hold). They deliberately overlap the per-feature suites: a feature test proving
a route *works* is not the same as a security test proving it *refuses* the
wrong thing, so both are kept.
"""

from types import SimpleNamespace

from app.core.rate_limit import _client_ip, _principal


# ---------------------------------------------------------------------------
# SE9 — client IP is read in proxy-trust order, never blindly from XFF
# ---------------------------------------------------------------------------
def _req(headers, host="10.0.0.9"):
    return SimpleNamespace(headers=headers, client=SimpleNamespace(host=host))


def test_client_ip_prefers_verified_proxy_headers():
    # Cloudflare's cf-connecting-ip wins over everything spoofable.
    assert _client_ip(_req({"cf-connecting-ip": "1.2.3.4", "x-real-ip": "9.9.9.9", "x-forwarded-for": "5.5.5.5"})) == "1.2.3.4"
    # Then x-real-ip, then the left-most XFF entry, then the raw peer.
    assert _client_ip(_req({"x-real-ip": "9.9.9.9", "x-forwarded-for": "5.5.5.5, 4.4.4.4"})) == "9.9.9.9"
    assert _client_ip(_req({"x-forwarded-for": "5.5.5.5, 4.4.4.4"})) == "5.5.5.5"
    assert _client_ip(_req({})) == "10.0.0.9"


def test_principal_is_nonreversible_and_absent_when_anonymous():
    assert _principal(_req({})) is None
    p = _principal(_req({"authorization": "Bearer mock_token_tester_a"}))
    assert p and "mock_token" not in p and len(p) == 16
    # A different credential maps to a different bucket.
    assert p != _principal(_req({"authorization": "Bearer mock_token_tester_b"}))


# ---------------------------------------------------------------------------
# Public token routes are rate-limited (brute-force ceiling)
# ---------------------------------------------------------------------------
async def test_public_planner_share_route_is_rate_limited():
    from httpx import ASGITransport, AsyncClient
    from app.core import rate_limit
    from app.main import app as fastapi_app

    rate_limit._BUCKETS.clear()
    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as anon:
        statuses = []
        for _ in range(40):
            res = await anon.get("/api/v1/planner/public/nonexistent-token")
            statuses.append(res.status_code)
    # The (30,60) rule must trip a 429 and then stay tripped for the rest.
    assert 429 in statuses
    first_limited = statuses.index(429)
    assert first_limited < 40 and all(s == 429 for s in statuses[first_limited:])


# ---------------------------------------------------------------------------
# New protected routes reject anonymous access (401), never serve data
# ---------------------------------------------------------------------------
async def test_new_protected_routes_require_auth():
    from httpx import ASGITransport, AsyncClient
    from app.main import app as fastapi_app

    targets = [
        ("get", "/api/v1/planner/boards"),
        ("get", "/api/v1/booking/agenda"),
        ("get", "/api/v1/projects/at-risk"),
        ("get", "/api/v1/contracts/at-stake"),
        ("post", "/api/v1/planner/boards/anything/rotate-share-token"),
        ("post", "/api/v1/projects/anything/rotate-share-token"),
        ("post", "/api/v1/contracts/anything/rotate-token"),
    ]
    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as anon:
        for method, path in targets:
            res = await getattr(anon, method)(path)
            assert res.status_code == 401, f"{method.upper()} {path} -> {res.status_code}"


# ---------------------------------------------------------------------------
# SE6 — SVG upload type is no longer accepted
# ---------------------------------------------------------------------------
async def test_svg_upload_type_rejected(client):
    res = await client.post(
        "/api/v1/storage/upload-signature",
        json={"file_key": "logo.svg", "content_type": "image/svg+xml", "category": "clients"},
    )
    assert res.status_code == 422, res.text
    # A safe raster still signs fine.
    ok = await client.post(
        "/api/v1/storage/upload-signature",
        json={"file_key": "logo.png", "content_type": "image/png", "category": "clients"},
    )
    assert ok.status_code == 200, ok.text


# ---------------------------------------------------------------------------
# SE5 — unauthenticated signature body is bounded + scheme-checked (422)
# ---------------------------------------------------------------------------
async def test_dangerous_signature_bodies_rejected():
    from httpx import ASGITransport, AsyncClient
    from app.main import app as fastapi_app

    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as anon:
        # javascript: smuggling is refused at the schema edge, before the token
        # is ever looked up — so any token value still yields a 422.
        js = await anon.post(
            "/api/v1/contracts/public/any-token/sign",
            json={"client_signature": "javascript:alert(1)"},
        )
        assert js.status_code == 422, js.text
        # An inline SVG data URL (the SE6 vector) is likewise rejected.
        svg = await anon.post(
            "/api/v1/contracts/public/any-token/sign",
            json={"client_signature": "data:image/svg+xml;base64,AAAA"},
        )
        assert svg.status_code == 422, svg.text
        # Oversized blob past the 256 KB cap.
        big = "data:image/png;base64," + ("A" * (300 * 1024))
        oversized = await anon.post(
            "/api/v1/contracts/public/any-token/sign",
            json={"client_signature": big},
        )
        assert oversized.status_code == 422, oversized.text


# ---------------------------------------------------------------------------
# SE10 — rotation is tenant-scoped (a foreign id is a 404, never a revoke)
# ---------------------------------------------------------------------------
async def test_rotation_is_workspace_scoped(client, client_b):
    # A planner board + a project owned by tenant A.
    board = (await client.post("/api/v1/planner/boards", json={"name": "A board"})).json()["id"]
    project = (await client.post("/api/v1/projects", json={"title": "A project", "budget": 100, "hourly_rate": 50})).json()["id"]

    # Tenant B cannot rotate A's tokens.
    assert (await client_b.post(f"/api/v1/planner/boards/{board}/rotate-share-token")).status_code == 404
    assert (await client_b.post(f"/api/v1/projects/{project}/rotate-share-token")).status_code == 404

    # Tenant A CAN, and the share token actually changes.
    await client.post(f"/api/v1/planner/boards/{board}/share", json={})
    rotated = await client.post(f"/api/v1/planner/boards/{board}/rotate-share-token")
    assert rotated.status_code == 200, rotated.text
    assert rotated.json()["share_token"]

    proj_rot = await client.post(f"/api/v1/projects/{project}/rotate-share-token")
    assert proj_rot.status_code == 200, proj_rot.text
    assert proj_rot.json()["share_token"]


async def test_project_share_token_actually_rotates(client):
    created = (await client.post("/api/v1/projects", json={"title": "Rotator", "budget": 0, "hourly_rate": 0})).json()
    old_token = created["share_token"]
    rotated = (await client.post(f"/api/v1/projects/{created['id']}/rotate-share-token")).json()
    assert rotated["share_token"] != old_token
