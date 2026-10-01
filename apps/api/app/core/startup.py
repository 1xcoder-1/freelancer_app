"""Centralised startup guards (SE11/SE12).

The API exposes three things that must never be active in a production
deployment by accident: the dev-auth bypass, an unsigned public Inngest serve
endpoint, and the interactive docs / OpenAPI schema. Previously the first two
were checked inline in two different places in main.py (once in the lifespan,
once at import time before the serve routes are registered), and DEBUG was never
guarded at all — so a forgotten `DEBUG` left `/docs` + `/openapi.json` published.

`validate_settings()` is the single source of truth for all three, called once
at import time (before the FastAPI app is built, so the DEBUG decision actually
governs `docs_url`) and again in the lifespan (so any new entry point inherits
the same protection). It is idempotent and raises only for the two hard errors;
the DEBUG case self-corrects and logs once.
"""

from app.core.config import settings

# Same dev-env values the rest of the app uses to distinguish local from remote.
_DEV_ENVS = ("development", "dev", "local")


def _is_dev_env() -> bool:
    return settings.APP_ENV.strip().lower() in _DEV_ENVS


def validate_settings() -> None:
    """Run every startup guard. Safe to call more than once."""
    # SE: the dev auth bypass is forbidden anywhere but local development.
    if settings.ALLOW_DEV_AUTH and not _is_dev_env():
        raise RuntimeError(
            "ALLOW_DEV_AUTH=true is forbidden outside development. "
            "Remove it from the environment before deploying."
        )

    # SE: the Inngest serve endpoint (/api/inngest) is public — in production
    # its requests MUST be signature-verified via the signing key.
    if settings.INNGEST_ENABLED and not _is_dev_env() and not settings.INNGEST_SIGNING_KEY:
        raise RuntimeError(
            "INNGEST_ENABLED=true requires INNGEST_SIGNING_KEY outside "
            "development. Set it in the environment or disable background jobs."
        )

    # SE11: a production/remote deployment that forgot to set DEBUG must not
    # publish /docs + /openapi.json. Force it off (and record that we did).
    if not _is_dev_env() and settings.DEBUG:
        settings.DEBUG = False
        print(
            "Startup guard: DEBUG forced to False outside development "
            "(/docs and /openapi.json disabled)."
        )
