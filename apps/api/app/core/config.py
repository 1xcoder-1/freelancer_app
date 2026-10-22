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

    # Feature-gate owner accounts (comma-separated). These emails always see
    # every dashboard feature and are the only ones allowed to toggle what
    # everyone else can see (Settings → Features). They also get the top plan
    # without a subscription — see app/core/plans.py resolve_tier().
    OWNER_EMAILS: str = "tsjoker14311211@gmail.com"

    # Same accounts matched on Clerk user id, because the email claim only
    # appears in a token if the session JWT template asks for it. Either list
    # recognising the caller grants the top plan.
    OWNER_CLERK_IDS: str = "user_2jxnO5ZxLMxcO8Kp4Aikqw95N5z"

    # Shared secret between the Next.js server (which can read Clerk's
    # subscription) and this API (which enforces the tier). Requests to
    # PUT /billing/sync and POST /billing/webhook without it are refused, so a
    # browser can never claim a paid tier by calling the API directly.
    BILLING_SYNC_SECRET: str = ""

    # Explicit opt-in for mock/dev auth bypass. Only takes effect when
    # APP_ENV is a development value; rejected at startup otherwise.
    ALLOW_DEV_AUTH: bool = False

    # The plan a mock/dev-authenticated session resolves to. Local runs and the
    # test suite have no Clerk subscription, so this is the knob that walks the
    # paywall: set it to "free" to see the locked state, "pro" to demo the top
    # tier. Ignored entirely unless ALLOW_DEV_AUTH is on, and owner emails
    # always win (app/core/plans.py resolve_tier).
    DEV_TIER: str = "pro"

    # Signing secret for short-lived link-page preview tokens (live preview
    # WebSocket). Empty = derived from CLERK_SECRET_KEY/DATABASE_URL so tokens
    # survive a dev --reload restart; set this explicitly in production.
    LINKPAGE_PREVIEW_SECRET: str = ""

    # Object & Media Storage (Cloudinary - primary media/receipt/invoice store)
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUDINARY_URL: Optional[str] = None

    # Stock photo search (Unsplash). Server-side only — the browser talks to
    # /stock/images, never to Unsplash directly. Empty = picker returns 501
    # and the UI falls back to uploads only.
    UNSPLASH_ACCESS_KEY: str = ""
    
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

    # Google Calendar integration (optional per-user OAuth connection + sync).
    # Create OAuth 2.0 Client ID (Desktop/Web) at console.cloud.google.com →
    # APIs & Services → Credentials, and add the redirect URI below to the
    # "Authorized redirect URIs" list. Empty client id = feature disabled and
    # /calendar/google/connect answers a clear 400 instead of a broken URL.
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:3000/dashboard/calendar/callback"
    # Sync window (days back / days forward) for Google Calendar mirroring
    GOOGLE_SYNC_LOOKBACK_DAYS: int = 30
    GOOGLE_SYNC_LOOKAHEAD_DAYS: int = 90

    
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
