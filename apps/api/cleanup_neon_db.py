"""
Database Cleanup Script: Drops deprecated/removed Biolink tables from Neon PostgreSQL or SQLite.
"""
import asyncio
from sqlalchemy import text
from app.core.database import engine

TABLES_TO_DROP = [
    "biolink_analytics",
    "biolink_items",
    "biolinks",
]

async def cleanup_database():
    print("Connecting to database...")
    async with engine.begin() as conn:
        for table in TABLES_TO_DROP:
            try:
                await conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE;"))
                print(f"[OK] Dropped table (if existed): {table}")
            except Exception as e:
                try:
                    await conn.execute(text(f"DROP TABLE IF EXISTS {table};"))
                    print(f"[OK] Dropped table (if existed): {table}")
                except Exception as inner_e:
                    print(f"[ERROR] Failed to drop {table}: {inner_e}")

    async with engine.connect() as conn:
        # Check current tables in database
        try:
            res = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"))
            tables = [r[0] for r in res.fetchall()]
            print("\nCurrent Active Tables in Database:")
            for t in tables:
                print(f" - {t}")
        except Exception as e:
            print("Could not query information_schema:", e)

if __name__ == "__main__":
    asyncio.run(cleanup_database())
