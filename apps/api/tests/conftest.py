"""Hermetic test fixtures.

Environment is pinned BEFORE any app module imports: `app.core.config.settings`
and the SQLAlchemy engine are built at import time, and pydantic-settings lets
real environment variables win over apps/api/.env — so we point the whole suite
at a throwaway SQLite file, disable Sentry/Inngest (no network), and keep the
dev-auth mock token path on. Every test then runs against a freshly created
schema and a cleared global cache, so ordering never matters.
"""

import os
import tempfile
from pathlib import Path

# ---- pin the environment before importing anything under app.* ---------------
_TMP_DIR = tempfile.mkdtemp(prefix="freelancebook-tests-")
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{Path(_TMP_DIR) / 'test.db'}"
os.environ["APP_ENV"] = "development"
os.environ["ALLOW_DEV_AUTH"] = "true"
os.environ["SENTRY_DSN"] = ""
os.environ["INNGEST_ENABLED"] = "false"
os.environ["CLERK_SECRET_KEY"] = ""
os.environ["CLERK_PUBLISHABLE_KEY"] = ""
os.environ["CLERK_ISSUER"] = ""

import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.core import rate_limit  # noqa: E402
from app.core.database import engine  # noqa: E402
from app.core.workspace import _ws_cache_clear  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402
from app.models.base import Base  # noqa: E402
import app.models  # noqa: E402,F401  (registers every mapper for create_all)

# The dev-auth path (auth.py) accepts any `mock_token_*` when ALLOW_DEV_AUTH is
# on; a distinct token per identity gives each test its own isolated workspace.
AUTH_A = {"Authorization": "Bearer mock_token_tester_a"}
AUTH_B = {"Authorization": "Bearer mock_token_tester_b"}


@pytest_asyncio.fixture(autouse=True)
async def _fresh_schema():
    """Create the full schema for the test and drop it afterwards, and reset the
    two module-global caches (workspace identity + rate-limit buckets) so no
    state leaks between tests."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    _ws_cache_clear()
    rate_limit._BUCKETS.clear()
    yield
    _ws_cache_clear()
    rate_limit._BUCKETS.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.headers.update(AUTH_A)
        yield ac


@pytest_asyncio.fixture
async def client_b():
    """A second, fully separate workspace (different Clerk identity/token)."""
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.headers.update(AUTH_B)
        yield ac
