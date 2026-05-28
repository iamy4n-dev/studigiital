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


def _make_mock_artifact_row(raw_content: str) -> tuple[MagicMock, MagicMock]:
    artifact = MagicMock()
    artifact.id = "art-1"
    artifact.capture_id = "cap-1"
    artifact.artifact_type = "generate_flashcard"
    artifact.content = {"cards": [{"front": "Q", "back": "A"}]}
    artifact.created_at = datetime.now(UTC)
    artifact.status = "draft"

    capture = MagicMock()
    capture.id = "cap-1"
    capture.raw_content = raw_content

    return artifact, capture


@pytest.fixture(autouse=True)
def override_deps() -> None:
    artifact, capture = _make_mock_artifact_row("Photosynthesis converts sunlight to energy")

    mock_result = MagicMock()
    mock_result.all.return_value = [(artifact, capture)]

    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=mock_result)

    async def _session_override() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_current_user] = lambda: UserClaims(
        user_id="test-user", tier="free"
    )
    app.dependency_overrides[get_session] = _session_override
    yield  # type: ignore[misc]
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_list_artifacts_includes_source_text() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/artifacts/")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["source_text"] == "Photosynthesis converts sunlight to energy"


@pytest.mark.asyncio
async def test_list_artifacts_includes_tags() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/artifacts/")

    assert response.status_code == 200
    body = response.json()
    assert "tags" in body[0]
    assert isinstance(body[0]["tags"], list)


@pytest.mark.asyncio
async def test_list_artifacts_includes_status() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/artifacts/")

    assert response.status_code == 200
    body = response.json()
    assert body[0]["status"] == "draft"
