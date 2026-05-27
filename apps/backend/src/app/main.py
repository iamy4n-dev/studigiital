from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import artifacts, captures, tags, users
from app.core.config import settings
from app.core.db import engine


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
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


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
