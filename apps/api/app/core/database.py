from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings
from app.models.base import Base
import app.models 

import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

# apps/api directory — used to anchor relative SQLite paths so the DB file
# location never depends on the cwd uvicorn was launched from (split-brain fix)
_APP_API_DIR = Path(__file__).resolve().parents[2]

db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Resolve relative SQLite paths (e.g. sqlite+aiosqlite:///./freelance_book.db)
# to an absolute path inside apps/api/, regardless of the working directory.
_sqlite_rel_prefixes = ("sqlite+aiosqlite:///./", "sqlite+aiosqlite://./")
for _prefix in _sqlite_rel_prefixes:
    if db_url.startswith(_prefix):
        _rel = db_url[len("sqlite+aiosqlite:///"):].lstrip("./")
        db_url = f"sqlite+aiosqlite:///{_APP_API_DIR / _rel}"
        break

if "postgresql+asyncpg://" in db_url and "?" in db_url:
    parsed = urlparse(db_url)
    query_params = parse_qs(parsed.query)
    query_params.pop("channel_binding", None)
    if "sslmode" in query_params:
        ssl_val = query_params.pop("sslmode")
        if "ssl" not in query_params:
            query_params["ssl"] = ssl_val
    new_query = urlencode(query_params, doseq=True)
    db_url = urlunparse(parsed._replace(query=new_query))

engine_kwargs = {
    "echo": settings.SQL_ECHO,
    "future": True,
}

# Neon's pooler multiplexes many client sessions onto a few server connections.
# asyncpg caches prepared statement plans per connection, and any schema change
# (create_all adding a column/table, a migration, or the pooler recycling a
# server connection) invalidates those plans server-side, surfacing as
# InvalidCachedStatementError on the next query. Disabling the statement cache
# for Postgres URLs is Neon's documented fix and costs only a trivial re-parse.
if db_url.startswith("postgresql"):
    engine_kwargs["connect_args"] = {"statement_cache_size": 0}
    # /dashboard/overview now runs several sections concurrently (one extra
    # session each), so a single page load checks out a handful of connections
    # at once. Give the pool headroom above the default 5 to avoid checkout
    # waits under parallel dashboard loads. Keep modest so a DIRECT (non-pooler)
    # Neon host is never over-connected — see .env.example note.
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 10

# Serverless Postgres (Neon) and other cloud DBs kill idle connections,
# which leaves dead connections sitting in SQLAlchemy's pool and causes
# asyncpg "connection is closed" InterfaceErrors on the next request that
# reuses one. Pre-ping verifies a connection before handing it out and
# transparently recycles it if it's stale; recycle gives a hard age cap.
# SQLite (aiosqlite, used for local dev) has no pool, so skip these.
if not db_url.startswith("sqlite"):
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300

engine = create_async_engine(db_url, **engine_kwargs)

# Async Session Factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

from sqlalchemy import text

async def init_db():
    """
    Initializes database tables automatically on startup and adds any missing columns.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # In development, auto-sync any newly added columns in models to the database
        if engine.dialect.name == "postgresql" and settings.APP_ENV.strip().lower() in ("development", "dev", "local"):
            for table_name, table in Base.metadata.tables.items():
                res = await conn.execute(text(f"""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = '{table_name}';
                """))
                existing_cols = {row[0] for row in res.fetchall()}
                if not existing_cols:
                    continue

                for col in table.columns:
                    if col.name not in existing_cols:
                        col_type = col.type.compile(dialect=engine.dialect)
                        await conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col.name} {col_type};"))

async def get_db():
    """
    FastAPI dependency yielding async SQLAlchemy database sessions.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
