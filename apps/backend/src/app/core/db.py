from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

_connect_args: dict[str, object] = {"ssl": True} if settings.db_ssl else {}
engine = create_async_engine(settings.database_url, connect_args=_connect_args, pool_pre_ping=True)
_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with _session_factory() as session:
        yield session
