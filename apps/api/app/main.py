from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import init_db
from app.core.rate_limit import enforce_rate_limit
from app.api.v1.router import api_router
import sentry_sdk
from app.core.sentry import setup_sentry

# Sentry Error & Performance Observability (config: app/core/sentry.py)
setup_sentry()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # SECURITY GUARD: never allow the dev auth bypass outside development
    if settings.ALLOW_DEV_AUTH and settings.APP_ENV.strip().lower() not in ("development", "dev", "local"):
        raise RuntimeError(
            "ALLOW_DEV_AUTH=true is forbidden outside development. "
            "Remove it from the environment before deploying."
        )

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
