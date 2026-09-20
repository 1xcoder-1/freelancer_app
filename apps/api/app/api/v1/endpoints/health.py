from fastapi import APIRouter
from datetime import datetime
from app.core.config import settings

router = APIRouter()

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Freelance Book API",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "0.1.0"
    }

@router.get("/sentry-debug")
async def trigger_error():
    """Sentry verification route (dev only).

    Opening http://localhost:8000/api/v1/sentry-debug raises an error that
    appears in the Sentry FastAPI project (error + connected performance trace).
    """
    if not settings.DEBUG:
        return {"detail": "Disabled outside development"}
    division_by_zero = 1 / 0
