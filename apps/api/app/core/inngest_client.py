"""Central Inngest client + guarded event emission.

Single seam for everything Inngest on the backend: the serve endpoint
registered in app/main.py, the function definitions in
app/inngest_functions/, and the emit calls from API endpoints all import from
here. When INNGEST_ENABLED is false, emit() is a no-op and the serve routes
are never registered, so the API behaves exactly as it did without Inngest.
"""

import sentry_sdk
from inngest import Event, Inngest, Middleware, TransformOutputResult

from app.core.config import settings

# app_id prefixes every event name (SDK convention); keep it in one place so
# triggers and emitters can never drift apart.
APP_ID = "freelance-book"

# Same dev-env values main.py uses for its startup guards.
_DEV_ENVS = ("development", "dev", "local")


def event_name(short: str) -> str:
    """'invoice.sent' -> 'freelance-book/invoice.sent' (create_function triggers
    use the bare short name; the SDK adds the app_id prefix automatically)."""
    return f"{APP_ID}/{short}"


class _SentryErrorMiddleware(Middleware):
    """Report failed steps/functions to Sentry, mirroring the request-path
    capture in app/main.py. Metadata only — event payloads contain client
    PII (emails, amounts) and are never attached to the scope."""

    async def transform_output(self, result: TransformOutputResult) -> None:
        if result.error is None:
            return
        with sentry_sdk.configure_scope() as scope:
            scope.set_tag("inngest.error", True)
        sentry_sdk.capture_exception(result.error)


inngest_client = Inngest(
    app_id=APP_ID,
    event_key=settings.INNGEST_EVENT_KEY or None,
    signing_key=settings.INNGEST_SIGNING_KEY or None,
    api_base_url=settings.INNGEST_BASE_URL or None,
    event_api_base_url=settings.INNGEST_BASE_URL or None,
    # Dev mode: talk to the local Inngest Dev Server without a signing key.
    # Production: signing key required (enforced by a startup guard too).
    is_production=settings.APP_ENV.strip().lower() not in _DEV_ENVS,
    middleware=[_SentryErrorMiddleware],  # class, not instance: the SDK
    # instantiates middleware per execution with (client, raw_request)
)


async def emit(short: str, data: dict) -> None:
    """Send an Inngest event without ever breaking the request path.

    Background-job infrastructure must not turn a successful invoice/booking
    request into a 500: send failures are logged and reported to Sentry,
    then swallowed. No-op while INNGEST_ENABLED is false.
    """
    if not settings.INNGEST_ENABLED:
        return
    try:
        await inngest_client.send(Event(name=event_name(short), data=data))
    except Exception as e:
        print(f"Inngest emit failed (event={event_name(short)}): {e}")
        if settings.SENTRY_DSN:
            with sentry_sdk.configure_scope() as scope:
                scope.set_tag("inngest.emit", True)
                scope.set_transaction_name(f"inngest.emit/{short}")
            sentry_sdk.capture_exception(e)
