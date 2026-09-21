from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

# Anchor .env to apps/api/ so settings load identically whether uvicorn is
# started from the repo root (pnpm dev:api) or from apps/api manually
_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"

class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "Freelance Book API"
    APP_ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8000

    # Print every SQL statement in the terminal (set SQL_ECHO=true in .env
    # only when debugging database queries — keeps normal logs clean)
    SQL_ECHO: bool = False
    
    # CORS Origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]
    
    # Primary Database (Neon PostgreSQL via asyncpg; SQLite fallback in dev)
    DATABASE_URL: str = "sqlite+aiosqlite:///./freelance_book.db"
    
    # Clerk Authentication
    CLERK_SECRET_KEY: str = ""
    CLERK_PUBLISHABLE_KEY: str = ""
    CLERK_ISSUER: Optional[str] = None

    # Explicit opt-in for mock/dev auth bypass. Only takes effect when
    # APP_ENV is a development value; rejected at startup otherwise.
    ALLOW_DEV_AUTH: bool = False
    
    # Object & Media Storage (Cloudinary - primary media/receipt/invoice store)
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUDINARY_URL: Optional[str] = None
    
    # Error Monitoring
    SENTRY_DSN: str = ""

    # Background Jobs (Inngest). Disabled by default so the API behaves
    # exactly as before without a Dev Server / cloud connection: emit() is a
    # no-op and the /api/inngest serve routes are never registered.
    INNGEST_ENABLED: bool = False
    INNGEST_EVENT_KEY: str = ""
    # REQUIRED in production: the serve endpoint is public and must have its
    # requests signature-verified (enforced by a startup guard in main.py).
    INNGEST_SIGNING_KEY: str = ""
    # Dev Server / cloud base URL override; empty = SDK default
    # (http://localhost:8282 event API when running the local Dev Server).
    INNGEST_BASE_URL: str = ""

    # Transactional email (used by Inngest reminder jobs). Empty = console
    # provider: emails are logged, never sent — safe for local dev.
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "Freelance Book <notifications@freelancebook.local>"

    # Public web app origin — builds payment/portal links inside reminders
    WEB_APP_URL: str = "http://localhost:3000"

    
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
