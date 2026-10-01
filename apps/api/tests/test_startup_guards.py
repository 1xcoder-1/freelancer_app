"""SE11/SE12 — centralised startup guards (app/core/startup.py).

validate_settings() must: refuse the dev-auth bypass outside development,
refuse an unsigned public Inngest serve endpoint outside development, and
self-correct DEBUG so /docs is never published in production. Each test drives
the real function against a temporarily patched settings object.
"""

import pytest

from app.core import startup
from app.core.config import settings


def _patch(monkeypatch, **values):
    for k, v in values.items():
        monkeypatch.setattr(settings, k, v)


def test_prod_forces_debug_off(monkeypatch):
    _patch(monkeypatch, APP_ENV="production", DEBUG=True, ALLOW_DEV_AUTH=False,
           INNGEST_ENABLED=False, INNGEST_SIGNING_KEY="")
    startup.validate_settings()
    assert settings.DEBUG is False


def test_dev_leaves_debug_alone(monkeypatch):
    _patch(monkeypatch, APP_ENV="development", DEBUG=True, ALLOW_DEV_AUTH=True,
           INNGEST_ENABLED=False, INNGEST_SIGNING_KEY="")
    startup.validate_settings()
    assert settings.DEBUG is True


def test_dev_auth_rejected_outside_development(monkeypatch):
    _patch(monkeypatch, APP_ENV="production", DEBUG=False, ALLOW_DEV_AUTH=True,
           INNGEST_ENABLED=False, INNGEST_SIGNING_KEY="")
    with pytest.raises(RuntimeError):
        startup.validate_settings()


def test_inngest_requires_signing_key_in_prod(monkeypatch):
    _patch(monkeypatch, APP_ENV="production", DEBUG=False, ALLOW_DEV_AUTH=False,
           INNGEST_ENABLED=True, INNGEST_SIGNING_KEY="")
    with pytest.raises(RuntimeError):
        startup.validate_settings()
