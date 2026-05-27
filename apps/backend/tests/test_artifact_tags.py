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


def _make_artifact(artifact_id: str = "art-1") -> tuple[MagicMock, MagicMock]:
    artifact = MagicMock()
    artifact.id = artifact_id
    artifact.capture_id = "cap-1"
    artifact.artifact_type = "generate_flashcard"
    artifact.content = {"cards": [{"front": "Q", "back": "A"}]}
    artifact.created_at = datetime.now(UTC)

    capture = MagicMock()
    capture.id = "cap-1"
    capture.user_id = "test-user"
    capture.raw_content = "Some source text"

    return artifact, capture


@pytest.fixture
def mock_session() -> AsyncSession:
    session = MagicMock(spec=AsyncSession)
    artifact, capture = _make_artifact()

    result_row = MagicMock()
    result_row.one_or_none.return_value = (artifact, capture)
    result_row.all.return_value = [(artifact, capture)]

    session.execute = AsyncMock(return_value=result_row)
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    return session


@pytest.fixture(autouse=True)
def override_deps(mock_session: AsyncSession) -> None:
    async def _session_override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_current_user] = lambda: UserClaims(
        user_id="test-user", tier="free"
    )
    app.dependency_overrides[get_session] = _session_override
    yield  # type: ignore[misc]
    app.dependency_overrides.clear()


async def test_set_artifact_tags_returns_200(mock_session: AsyncSession) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.put(
            "/api/v1/artifacts/art-1/tags",
            json=["biology", "photosynthesis"],
        )

    assert response.status_code == 200


async def test_set_artifact_tags_persists_tags(mock_session: AsyncSession) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.put(
            "/api/v1/artifacts/art-1/tags",
            json=["biology", "photosynthesis"],
        )

    assert mock_session.commit.called


async def test_set_artifact_tags_returns_404_for_unknown_artifact(
    mock_session: AsyncSession,
) -> None:
    result_row = MagicMock()
    result_row.one_or_none.return_value = None
    mock_session.execute = AsyncMock(return_value=result_row)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.put(
            "/api/v1/artifacts/nonexistent/tags",
            json=["biology"],
        )

    assert response.status_code == 404


async def test_set_artifact_tags_rejects_empty_list() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.put("/api/v1/artifacts/art-1/tags", json=[])

    assert response.status_code == 422


async def test_artifact_response_includes_tags_after_set(mock_session: AsyncSession) -> None:
    artifact, capture = _make_artifact()
    artifact.tags = ["biology", "photosynthesis"]

    result_with_tags = MagicMock()
    result_with_tags.all.return_value = [(artifact, capture)]
    mock_session.execute = AsyncMock(return_value=result_with_tags)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/artifacts/")

    assert response.status_code == 200
    body = response.json()
    assert body[0]["tags"] == ["biology", "photosynthesis"]
