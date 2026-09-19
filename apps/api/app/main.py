from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import init_db
from app.api.v1.router import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables on application startup
    try:
        await init_db()
    except Exception as e:
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

# Security Headers & Exception Sanitization Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    try:
        response: Response = await call_next(request)
    except Exception as exc:
        import traceback
        print(f"Unhandled Exception in request {request.url}: {exc}")
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": "A secure internal server error occurred. Request has been logged."}
        )

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
