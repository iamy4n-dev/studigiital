from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import UserClaims, get_current_user
from app.core.db import get_session
from app.main import app


def _make_mock_session() -> AsyncSession:
    session = MagicMock(spec=AsyncSession)
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    return session


@pytest.fixture(autouse=True)
def override_deps() -> None:
    mock_session = _make_mock_session()

    async def _session_override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_current_user] = lambda: UserClaims(
        user_id="test-user", tier="free"
    )
    app.dependency_overrides[get_session] = _session_override
    yield
    app.dependency_overrides.clear()


async def test_create_photo_capture_returns_201():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        res = await client.post(
            "/api/v1/captures/",
            json={"mode": "photo", "media_key": "captures/test-user/abc/photo.jpg"},
        )

    assert res.status_code == 201
    data = res.json()
    assert data["mode"] == "photo"
    assert data["status"] == "pending"
    assert data["user_id"] == "test-user"
    assert "id" in data


async def test_create_text_capture_returns_201():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        res = await client.post(
            "/api/v1/captures/",
            json={"mode": "quick_text", "raw_content": "My learning note"},
        )

    assert res.status_code == 201
    data = res.json()
    assert data["mode"] == "quick_text"
    assert data["status"] == "pending"


async def test_create_capture_requires_auth():
    app.dependency_overrides.clear()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        res = await client.post(
            "/api/v1/captures/",
            json={"mode": "photo", "media_key": "some/key.jpg"},
        )
    assert res.status_code in (401, 403)
