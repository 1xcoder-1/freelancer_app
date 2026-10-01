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

if db_url.startswith("postgresql"):
    engine_kwargs["connect_args"] = {
        "statement_cache_size": 0,
        "timeout": 30,
        "command_timeout": 60,
    }
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 15
if not db_url.startswith("sqlite"):
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 60

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
            # S6: DDL fragments go through the dialect's identifier preparer so
            # table/column names are always quoted, and the introspection query
            # uses a bound parameter — no string-built SQL, even from metadata.
            quote = engine.dialect.identifier_preparer.quote
            # Retired columns (features removed from the models) are dropped here
            # once; DROP COLUMN IF EXISTS keeps it a no-op on fresh databases.
            for _table, _column in (("projects", "budgeted_hours"), ("clients", "health_score")):
                await conn.execute(text(
                    f"ALTER TABLE {quote(_table)} DROP COLUMN IF EXISTS {quote(_column)};"
                ))
            for table_name, table in Base.metadata.tables.items():
                res = await conn.execute(
                    text("SELECT column_name FROM information_schema.columns WHERE table_name = :t"),
                    {"t": table_name},
                )
                existing_cols = {row[0] for row in res.fetchall()}
                if not existing_cols:
                    continue

                for col in table.columns:
                    if col.name not in existing_cols:
                        col_type = col.type.compile(dialect=engine.dialect)
                        await conn.execute(text(
                            f"ALTER TABLE {quote(table_name)} "
                            f"ADD COLUMN IF NOT EXISTS {quote(col.name)} {col_type};"
                        ))

async def get_db():
    """
    FastAPI dependency yielding async SQLAlchemy database sessions.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
