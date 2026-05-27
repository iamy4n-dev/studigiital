from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import UserClaims, get_current_user
from app.core.db import get_session
from app.main import app


def _make_artifact(
    artifact_id: str,
    tags: list[str],
    content: dict[str, Any] | None = None,
    artifact_type: str = "generate_flashcard",
) -> tuple[MagicMock, MagicMock]:
    artifact = MagicMock()
    artifact.id = artifact_id
    artifact.capture_id = "cap-1"
    artifact.artifact_type = artifact_type
    artifact.tags = tags
    artifact.content = content or {"cards": [{"front": "Q", "back": "A"}]}
    artifact.created_at = datetime.now(UTC)

    capture = MagicMock()
    capture.id = "cap-1"
    capture.user_id = "test-user"
    capture.raw_content = "Some source text"

    return artifact, capture


def _make_session(artifact_rows: list[tuple[MagicMock, MagicMock]]) -> AsyncSession:
    session = MagicMock(spec=AsyncSession)

    artifact_result = MagicMock()
    artifact_result.all.return_value = artifact_rows

    event_result = MagicMock()
    event_result.all.return_value = []

    session.execute = AsyncMock(side_effect=[artifact_result, event_result])
    session.add = MagicMock()
    session.commit = AsyncMock()
    return session


@pytest.fixture(autouse=True)
def override_auth() -> None:
    app.dependency_overrides[get_current_user] = lambda: UserClaims(
        user_id="test-user", tier="free"
    )
    yield  # type: ignore[misc]
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Slice 1 — tracer bullet: queue endpoint returns 200 with artifact list
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_queue_returns_200_with_artifact_list() -> None:
    artifact, capture = _make_artifact("art-1", ["biology"])
    mock_session = _make_session([(artifact, capture)])

    async def _session_override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _session_override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/review/queue?tags=biology&mode=structured")

    assert response.status_code == 200
    body = response.json()
    assert "artifacts" in body
    assert isinstance(body["artifacts"], list)


# ---------------------------------------------------------------------------
# Slice 2 — queue excludes artifacts belonging to other users
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_queue_excludes_other_users_artifacts() -> None:
    other_artifact = MagicMock()
    other_artifact.id = "art-other"
    other_artifact.tags = ["biology"]

    other_capture = MagicMock()
    other_capture.id = "cap-other"
    other_capture.user_id = "other-user"
    other_capture.raw_content = "other"

    mock_session = _make_session([])  # no artifacts for test-user

    async def _session_override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _session_override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/review/queue?tags=biology&mode=structured")

    assert response.status_code == 200
    assert response.json()["artifacts"] == []


# ---------------------------------------------------------------------------
# Slice 3 — structured mode: unreviewed artifacts appear before reviewed ones
# ---------------------------------------------------------------------------


def _make_reviewed_session(
    unreviewed_id: str, reviewed_id: str
) -> AsyncSession:
    unreviewed, cap1 = _make_artifact(unreviewed_id, ["biology"])
    reviewed, cap2 = _make_artifact(reviewed_id, ["biology"])

    artifact_result = MagicMock()
    artifact_result.all.return_value = [(reviewed, cap2), (unreviewed, cap1)]

    event_result = MagicMock()
    event_result.all.return_value = [(reviewed_id,)]

    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock(side_effect=[artifact_result, event_result])
    session.add = MagicMock()
    session.commit = AsyncMock()
    return session


@pytest.mark.asyncio
async def test_structured_mode_puts_unreviewed_first() -> None:
    mock_session = _make_reviewed_session("art-new", "art-old")

    async def _session_override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _session_override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/review/queue?tags=biology&mode=structured")

    assert response.status_code == 200
    artifact_ids = [a["id"] for a in response.json()["artifacts"]]
    assert artifact_ids[0] == "art-new"
    assert artifact_ids[1] == "art-old"


# ---------------------------------------------------------------------------
# Slice 4 — response includes new_count and reviewed_count
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_queue_response_includes_counts() -> None:
    mock_session = _make_reviewed_session("art-new", "art-old")

    async def _session_override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _session_override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/review/queue?tags=biology&mode=structured")

    body = response.json()
    assert body["new_count"] == 1
    assert body["reviewed_count"] == 1


# ---------------------------------------------------------------------------
# Slice 5 — multi-tag: returns artifacts tagged with ANY selected tag
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_queue_multi_tag_returns_union() -> None:
    bio_art, bio_cap = _make_artifact("art-bio", ["biology"])
    chem_art, chem_cap = _make_artifact("art-chem", ["chemistry"])
    unrelated, unrel_cap = _make_artifact("art-other", ["history"])

    artifact_result = MagicMock()
    artifact_result.all.return_value = [
        (bio_art, bio_cap), (chem_art, chem_cap), (unrelated, unrel_cap)
    ]

    event_result = MagicMock()
    event_result.all.return_value = []

    mock_session = MagicMock(spec=AsyncSession)
    mock_session.execute = AsyncMock(side_effect=[artifact_result, event_result])
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()

    async def _session_override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _session_override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/api/v1/review/queue?tags=biology%2Cchemistry&mode=structured"
        )

    assert response.status_code == 200
    ids = {a["id"] for a in response.json()["artifacts"]}
    assert ids == {"art-bio", "art-chem"}
    assert "art-other" not in ids


# ---------------------------------------------------------------------------
# Slice 6 — POST /events records a review event (tracer bullet)
# ---------------------------------------------------------------------------


def _make_event_session() -> AsyncSession:
    session = MagicMock(spec=AsyncSession)
    session.add = MagicMock()
    session.commit = AsyncMock()
    return session


@pytest.mark.asyncio
async def test_record_event_returns_201_with_id() -> None:
    mock_session = _make_event_session()

    async def _session_override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _session_override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/review/events",
            json={"artifact_id": "art-1", "outcome": "passed"},
        )

    assert response.status_code == 201
    body = response.json()
    assert "id" in body
    assert isinstance(body["id"], str)
    assert mock_session.commit.called


# ---------------------------------------------------------------------------
# Slice 7 — invalid outcome returns 422
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_record_event_invalid_outcome_returns_422() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/review/events",
            json={"artifact_id": "art-1", "outcome": "maybe"},
        )

    assert response.status_code == 422
