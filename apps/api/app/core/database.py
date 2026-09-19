from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings
from app.models.base import Base
import app.models  # noqa: F401 - Register all models in Base.metadata

import re
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Ensure query parameters are compatible with asyncpg driver
if "postgresql+asyncpg://" in db_url and "?" in db_url:
    parsed = urlparse(db_url)
    query_params = parse_qs(parsed.query)
    # Remove unsupported channel_binding parameter for asyncpg
    query_params.pop("channel_binding", None)
    # Ensure ssl=require is used
    if "sslmode" in query_params:
        ssl_val = query_params.pop("sslmode")
        if "ssl" not in query_params:
            query_params["ssl"] = ssl_val
    new_query = urlencode(query_params, doseq=True)
    db_url = urlunparse(parsed._replace(query=new_query))

# SQLAlchemy 2 Async Engine
engine = create_async_engine(
    db_url,
    echo=settings.DEBUG,
    future=True
)

# Async Session Factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def init_db():
    """
    Initializes database tables automatically on startup if using SQLite/D1.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db():
    """
    FastAPI dependency yielding async SQLAlchemy database sessions.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
