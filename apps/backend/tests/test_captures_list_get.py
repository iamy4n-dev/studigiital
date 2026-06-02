from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import UserClaims, get_current_user
from app.core.db import get_session
from app.main import app

_NOW = datetime(2025, 1, 1, 12, 0, 0, tzinfo=UTC)


def _make_capture(capture_id: str = "cap-1") -> MagicMock:
    c = MagicMock()
    c.id = capture_id
    c.user_id = "test-user"
    c.mode = "quick_text"
    c.status = "pending"
    c.created_at = _NOW
    return c


def _scalar_result(rows: list) -> MagicMock:
    result = MagicMock()
    result.scalars.return_value.all.return_value = rows
    return result


def _scalar_one_or_none_result(row) -> MagicMock:
    result = MagicMock()
    result.scalar_one_or_none.return_value = row
    return result


@pytest.fixture
def mock_session_with_captures() -> AsyncSession:
    capture = _make_capture()
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock(side_effect=[
        _scalar_result([capture]),
    ])
    return session


@pytest.fixture
def mock_session_empty() -> AsyncSession:
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=_scalar_result([]))
    return session


@pytest.fixture
def mock_session_one(request) -> AsyncSession:
    row = request.param
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=_scalar_one_or_none_result(row))
    return session


def _override(session: AsyncSession) -> None:
    async def _session_gen() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_current_user] = lambda: UserClaims(
        user_id="test-user", tier="free"
    )
    app.dependency_overrides[get_session] = _session_gen


@pytest.mark.asyncio
async def test_list_captures_returns_200_with_captures(mock_session_with_captures: AsyncSession) -> None:
    _override(mock_session_with_captures)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            res = await c.get("/api/v1/captures/")
        assert res.status_code == 200
        body = res.json()
        assert len(body) == 1
        assert body[0]["id"] == "cap-1"
        assert body[0]["mode"] == "quick_text"
        assert body[0]["status"] == "pending"
        assert body[0]["user_id"] == "test-user"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_list_captures_returns_empty_list(mock_session_empty: AsyncSession) -> None:
    _override(mock_session_empty)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            res = await c.get("/api/v1/captures/")
        assert res.status_code == 200
        assert res.json() == []
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_list_captures_requires_auth() -> None:
    app.dependency_overrides.clear()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.get("/api/v1/captures/")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_get_capture_returns_200() -> None:
    capture = _make_capture("cap-42")
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=_scalar_one_or_none_result(capture))
    _override(session)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            res = await c.get("/api/v1/captures/cap-42")
        assert res.status_code == 200
        body = res.json()
        assert body["id"] == "cap-42"
        assert body["mode"] == "quick_text"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_capture_returns_404_when_not_found() -> None:
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=_scalar_one_or_none_result(None))
    _override(session)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            res = await c.get("/api/v1/captures/nonexistent")
        assert res.status_code == 404
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_capture_requires_auth() -> None:
    app.dependency_overrides.clear()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.get("/api/v1/captures/cap-1")
    assert res.status_code == 401
