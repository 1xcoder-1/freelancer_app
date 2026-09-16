from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()

@router.get("/status")
async def system_status():
    return {
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "database": "configured",
        "auth": "clerk",
        "modules": [
            "dashboard",
            "client_management",
            "projects",
            "time_tracking",
            "finance",
            "contracts",
            "crm",
            "ai_assistant"
        ]
    }
