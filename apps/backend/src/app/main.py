from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from alembic.config import Config as AlembicConfig
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from alembic import command as alembic_command
from app.api.v1 import artifacts, captures, profile, review, tags, users
from app.core.config import settings
from app.core.db import engine

logger = logging.getLogger(__name__)

_BACKEND_DIR = Path(__file__).parent.parent.parent


def _run_migrations() -> None:
    cfg = AlembicConfig(_BACKEND_DIR / "alembic.ini")
    alembic_command.upgrade(cfg, "head")


async def _check_db() -> bool:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM captures LIMIT 1"))
        return True
    except Exception:
        return False


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    await asyncio.to_thread(_run_migrations)
    if not await _check_db():
        raise RuntimeError(
            "DB tables missing after migration. "
            "If you dropped tables but kept alembic_version, run: "
            "DELETE FROM alembic_version; -- then restart the server."
        )
    yield
    await engine.dispose()


app = FastAPI(
    title="Studigital API",
    version="0.1.0",
    docs_url="/docs" if settings.debug else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(captures.router, prefix="/api/v1/captures", tags=["captures"])
app.include_router(artifacts.router, prefix="/api/v1/artifacts", tags=["artifacts"])
app.include_router(tags.router, prefix="/api/v1/tags", tags=["tags"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(review.router, prefix="/api/v1/review", tags=["review"])
app.include_router(profile.router, prefix="/api/v1/profile", tags=["profile"])


@app.get("/health")
async def health() -> dict[str, str]:
    db_ok = await _check_db()
    return {"status": "ok", "db": "ok" if db_ok else "error"}
