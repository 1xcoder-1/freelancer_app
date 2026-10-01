from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import init_db, engine
from app.core.rate_limit import enforce_rate_limit
from app.core.startup import validate_settings
from app.api.v1.router import api_router
from app.core.auth import warm_jwks
import sentry_sdk
from app.core.sentry import setup_sentry

# Sentry Error & Performance Observability (config: app/core/sentry.py)
setup_sentry()

# Run the startup guards BEFORE the FastAPI app is built, so the SE11 DEBUG
# decision actually governs docs_url/openapi_url below (they are read at
# construction time). validate_settings() is idempotent and runs again in the
# lifespan, so a new entry point that forgets it is still protected.
validate_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Centralised guards (dev-auth bypass, Inngest signing, DEBUG) — see
    # app/core/startup.py. Raises for the two hard errors, self-corrects DEBUG.
    validate_settings()

    is_dev_env = settings.APP_ENV.strip().lower() in ("development", "dev", "local")
    is_local_sqlite = settings.DATABASE_URL.startswith("sqlite")

    # Auto-create tables only for local development databases. Shared/prod
    # databases (e.g. Neon) must never be mutated implicitly at startup —
    # schema changes there belong to migrations.
    if is_dev_env or is_local_sqlite:
        try:
            await init_db()
        except Exception as e:
            if not is_local_sqlite:
                # Remote DB unreachable/misconfigured — fail fast instead of
                # booting an app that would 500 on every request
                raise
            print(f"Database initialization notice: {e}")

    # Warm the two cold paths that would otherwise hit the FIRST page load:
    # a sleeping Neon serverless branch (SELECT 1 wakes it) and Clerk's JWKS
    # fetch. Both are non-fatal here — per-request fallbacks remain.
    import asyncio
    from sqlalchemy import text

    async def _wake_database():
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        except Exception as e:
            print(f"DB warm-up notice (queries will retry per request): {e}")

    await asyncio.gather(_wake_database(), warm_jwks())
    yield

app = FastAPI(
    title=settings.APP_NAME,
    openapi_url="/openapi.json" if settings.DEBUG else None,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url=None,
    lifespan=lifespan
)

# Gzip Payload Compression (Checklist: Performance)
app.add_middleware(GZipMiddleware, minimum_size=500)

# Security Headers + Rate Limiting + Exception Sanitization Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    # 1. Rate limiting first (429 short-circuits before any DB work)
    rate_limited = False
    try:
        await enforce_rate_limit(request)
    except HTTPException as exc:
        rate_limited = True
        response: Response = JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=exc.headers,
        )

    # 2. Normal request flow
    if not rate_limited:
        try:
            response = await call_next(request)
        except Exception as exc:
            import traceback
            print(f"Unhandled Exception in request {request.url}: {exc}")
            traceback.print_exc()
            if settings.SENTRY_DSN:
                # Attach request context so 500s in Sentry show which route
                # failed; the client-facing body stays sanitized below.
                # Use the parameterized route template (e.g. /intake/{token})
                # rather than the raw path so live share-link tokens are never
                # shipped to Sentry; fall back to the raw path if routing info
                # is unavailable (path is already free of tokens in that case).
                route = request.scope.get("route")
                path_tag = getattr(route, "path_format", None) or request.url.path
                with sentry_sdk.configure_scope() as scope:
                    scope.set_tag("api.path", path_tag)
                    scope.set_tag("api.method", request.method)
                sentry_sdk.capture_exception(exc)
            response = JSONResponse(
                status_code=500,
                content={"detail": "A secure internal server error occurred. Request has been logged."}
            )

    # 3. Security headers on EVERY response (200, 401, 429, 500, ...)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response

# Set up CORS middleware (Strict origin filtering)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

# Background Jobs: Inngest serve endpoint (GET/PUT/POST /api/inngest, added
# by the SDK). Deliberately outside /api/v1: Inngest Cloud / the local Dev
# Server authenticates with the signing key (verified by the SDK itself)
# instead of a Clerk bearer token. Imports stay inside the gate so a disabled
# deployment never touches the SDK; the security-header middleware above
# still covers these routes.
if settings.INNGEST_ENABLED:
    # The signing-key requirement is enforced centrally by validate_settings()
    # (called above at import time and again in the lifespan), so this block
    # only needs to register the serve routes; imports stay inside the gate so a
    # disabled deployment never touches the SDK.
    import inngest.fast_api

    from app.core.inngest_client import inngest_client
    from app.inngest_functions import functions

    inngest.fast_api.serve(app, inngest_client, functions)

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": settings.APP_NAME,
        "health": "/api/v1/health"
    }

# Browser auto-requests these when opening /docs or / — answer 204
# instead of spamming the Uvicorn logs with 404s
@app.head("/favicon.ico", include_in_schema=False)
@app.get("/favicon.ico", include_in_schema=False)
@app.get("/favicon.png", include_in_schema=False)
async def favicon():
    return Response(status_code=204)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
