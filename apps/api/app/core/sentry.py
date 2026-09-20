import sentry_sdk
from app.core.config import settings


def _tag_sentry_event(event, hint):
    event["tags"] = {**(event.get("tags") or {}), "service": "api", "platform": "python-fastapi"}
    return event


def setup_sentry() -> bool:
    """
    Initialize Sentry Error & Performance Observability for the FastAPI backend.

    Uses SENTRY_DSN from apps/api/.env — point this at its OWN Sentry project
    (e.g. "freelance-book-api") to keep backend errors separate from the web
    app's "javascript-nextjs" project.

    Returns True if Sentry was initialized, False if disabled (no DSN set).
    """
    if not settings.SENTRY_DSN:
        return False

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=1.0,
        send_default_pii=False,
        environment=settings.APP_ENV,
        enable_logs=True,
        profile_session_sample_rate=1.0,
        profile_lifecycle="trace",
        before_send=_tag_sentry_event,
        before_send_transaction=_tag_sentry_event,
    )
    return True
