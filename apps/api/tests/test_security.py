"""Auth + transport-security invariants."""

from httpx import ASGITransport, AsyncClient

from app.main import app as fastapi_app


async def test_unauthenticated_request_is_rejected(client):
    # client fixture carries a token; drop it to hit the guard directly
    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as anon:
        res = await anon.get("/api/v1/projects")
    assert res.status_code == 401


async def test_forged_jwt_is_rejected(client):
    async with AsyncClient(
        transport=ASGITransport(app=fastapi_app),
        base_url="http://test",
        headers={"Authorization": "Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyX2Zha2UifQ."},
    ) as bad:
        res = await bad.get("/api/v1/projects")
    assert res.status_code == 401


async def test_security_headers_present_on_every_response(client):
    res = await client.get("/api/v1/health")
    assert res.headers["X-Content-Type-Options"] == "nosniff"
    assert res.headers["X-Frame-Options"] == "DENY"
    assert "strict-origin-when-cross-origin" in res.headers["Referrer-Policy"]
    assert res.headers["Strict-Transport-Security"]


async def test_500_body_is_sanitized(client):
    # An unexpected server error must never leak internals to the caller. Add a
    # throwaway route that raises, hit it, then remove it — the middleware's
    # sanitisation is what's under test, not any real endpoint.
    def _boom():
        raise RuntimeError("kaboom secret token=LEAK")

    route_path = "/api/v1/_test_boom"
    fastapi_app.add_route(route_path, _boom, methods=["GET"])
    try:
        res = await client.get(route_path)
        assert res.status_code == 500
        assert "kaboom" not in res.text
        assert "LEAK" not in res.text
    finally:
        fastapi_app.router.routes = [
            r for r in fastapi_app.router.routes
            if getattr(r, "path", None) != route_path
        ]
