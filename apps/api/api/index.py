from app.main import app as _fastapi_app

async def app(scope, receive, send):
    """
    ASGI middleware for Vercel Serverless Python.
    Vercel rewrites route all requests to /api/index.py, but passes the actual
    client request path in the 'x-matched-path' header. We extract and set
    scope['path'] so FastAPI matches the correct route.
    """
    if scope.get("type") == "http":
        headers = dict(scope.get("headers", []))
        matched_path = headers.get(b"x-matched-path")
        if matched_path:
            raw = matched_path.decode("latin1").split("?")[0]
            if len(raw) > 1 and raw.endswith("/"):
                raw = raw[:-1]
            scope["path"] = raw
            scope["raw_path"] = raw.encode("latin1")
    await _fastapi_app(scope, receive, send)
