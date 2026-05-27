from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .env import load_environment_files

load_environment_files()


class Base(DeclarativeBase):
    pass


DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is required for marketplace-integration-service. "
        "SQLite fallback has been removed; point this service to Supabase/Postgres."
    )

if DATABASE_URL.startswith("sqlite"):
    raise RuntimeError(
        "SQLite fallback is no longer supported for marketplace-integration-service. "
        "Use a Supabase/Postgres DATABASE_URL."
    )

SQL_ECHO = os.getenv("SQL_ECHO", "0") == "1"

engine: AsyncEngine = create_async_engine(DATABASE_URL, echo=SQL_ECHO, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    # Schema management belongs to Supabase migrations.
    return None


@asynccontextmanager
async def lifespan_context(_app) -> AsyncIterator[None]:
    await init_db()
    try:
        yield
    finally:
        await engine.dispose()
