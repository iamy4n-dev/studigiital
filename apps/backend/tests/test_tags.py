from __future__ import annotations

from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import UserClaims, get_current_user
from app.core.db import get_session
from app.main import app


def _make_session(tags_per_artifact: list[list[str]]) -> AsyncSession:
    session = MagicMock(spec=AsyncSession)
    result = MagicMock()
    result.all.return_value = [(tags,) for tags in tags_per_artifact]
    session.execute = AsyncMock(return_value=result)
    return session


def _override(session: AsyncSession) -> None:
    async def _session_gen() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_current_user] = lambda: UserClaims(
        user_id="test-user", tier="free"
    )
    app.dependency_overrides[get_session] = _session_gen


@pytest.fixture(autouse=True)
def cleanup() -> None:
    yield  # type: ignore[misc]
    app.dependency_overrides.clear()


async def test_list_tags_returns_distinct_names() -> None:
    _override(_make_session([["biology", "photosynthesis"], ["biology", "chemistry"]]))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/tags/")

    assert response.status_code == 200
    body = response.json()
    names = [t["name"] for t in body]
    assert sorted(names) == ["biology", "chemistry", "photosynthesis"]


async def test_list_tags_includes_bg_and_text_colors() -> None:
    _override(_make_session([["biology"]]))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/tags/")

    tag = response.json()[0]
    assert tag["bg"].startswith("#")
    assert tag["text"].startswith("#")


async def test_list_tags_returns_empty_when_no_tags() -> None:
    _override(_make_session([[], []]))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/tags/")

    assert response.json() == []
