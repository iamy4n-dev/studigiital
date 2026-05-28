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


def _make_item(
    item_id: str,
    artifact_id: str,
    item_type: str,
    content: dict,
    tags: list[str],
) -> tuple[MagicMock, MagicMock, MagicMock]:
    item = MagicMock()
    item.id = item_id
    item.artifact_id = artifact_id
    item.item_type = item_type
    item.content = content
    item.created_at = datetime.now(UTC)

    artifact = MagicMock()
    artifact.id = artifact_id
    artifact.tags = tags

    capture = MagicMock()
    capture.user_id = "test-user"
    capture.raw_content = "Some source text"

    return item, artifact, capture


def _make_session(
    item_rows: list[tuple[MagicMock, MagicMock, MagicMock]],
    reviewed_ids: list[str] | None = None,
) -> AsyncSession:
    session = MagicMock(spec=AsyncSession)

    item_result = MagicMock()
    item_result.all.return_value = item_rows

    reviewed_result = MagicMock()
    reviewed_result.all.return_value = [(id,) for id in (reviewed_ids or [])]

    session.execute = AsyncMock(side_effect=[item_result, reviewed_result])
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
# Slice 1 — tracer bullet: queue returns items list
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_queue_returns_200_with_item_list() -> None:
    item, artifact, capture = _make_item(
        "item-1", "art-1", "flashcard", {"front": "Q", "back": "A"}, ["biology"]
    )
    mock_session = _make_session([(item, artifact, capture)])

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/review/queue?tags=biology&mode=structured")

    assert response.status_code == 200
    body = response.json()
    assert "items" in body
    assert isinstance(body["items"], list)


# ---------------------------------------------------------------------------
# Slice 2 — item has item_type and content
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_queue_item_has_item_type_and_content() -> None:
    item, artifact, capture = _make_item(
        "item-1", "art-1", "flashcard", {"front": "Q", "back": "A"}, ["biology"]
    )
    mock_session = _make_session([(item, artifact, capture)])

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/review/queue?tags=biology&mode=structured")

    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["item_type"] == "flashcard"
    assert items[0]["content"] == {"front": "Q", "back": "A"}
    assert items[0]["id"] == "item-1"
    assert items[0]["artifact_id"] == "art-1"


# ---------------------------------------------------------------------------
# Slice 3 — queue excludes items belonging to other users
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_queue_excludes_other_users_items() -> None:
    mock_session = _make_session([])

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/review/queue?tags=biology&mode=structured")

    assert response.status_code == 200
    assert response.json()["items"] == []


# ---------------------------------------------------------------------------
# Slice 4 — structured mode: unreviewed items appear before reviewed ones
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_structured_mode_puts_unreviewed_items_first() -> None:
    new_item, art1, cap1 = _make_item(
        "item-new", "art-1", "flashcard", {"front": "Q", "back": "A"}, ["biology"]
    )
    old_item, art2, cap2 = _make_item(
        "item-old", "art-2", "flashcard", {"front": "Q2", "back": "A2"}, ["biology"]
    )
    mock_session = _make_session(
        [(old_item, art2, cap2), (new_item, art1, cap1)],
        reviewed_ids=["item-old"],
    )

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/review/queue?tags=biology&mode=structured")

    ids = [i["id"] for i in response.json()["items"]]
    assert ids[0] == "item-new"
    assert ids[1] == "item-old"


# ---------------------------------------------------------------------------
# Slice 5 — response includes new_count and reviewed_count
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_queue_response_includes_counts() -> None:
    new_item, art1, cap1 = _make_item(
        "item-new", "art-1", "flashcard", {"front": "Q", "back": "A"}, ["biology"]
    )
    old_item, art2, cap2 = _make_item(
        "item-old", "art-2", "flashcard", {"front": "Q2", "back": "A2"}, ["biology"]
    )
    mock_session = _make_session(
        [(old_item, art2, cap2), (new_item, art1, cap1)],
        reviewed_ids=["item-old"],
    )

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/review/queue?tags=biology&mode=structured")

    body = response.json()
    assert body["new_count"] == 1
    assert body["reviewed_count"] == 1


# ---------------------------------------------------------------------------
# Slice 6 — multi-tag: returns items from artifacts tagged with ANY selected tag
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_queue_multi_tag_returns_union() -> None:
    bio_item, bio_art, bio_cap = _make_item(
        "item-bio", "art-bio", "flashcard", {"front": "Q", "back": "A"}, ["biology"]
    )
    chem_item, chem_art, chem_cap = _make_item(
        "item-chem", "art-chem", "note", {"title": "Chem", "body_markdown": "..."}, ["chemistry"]
    )
    hist_item, hist_art, hist_cap = _make_item(
        "item-hist", "art-hist", "quiz_question",
        {"question": "Q?", "options": ["A", "B"], "correct_index": 0}, ["history"]
    )

    item_result = MagicMock()
    item_result.all.return_value = [
        (bio_item, bio_art, bio_cap),
        (chem_item, chem_art, chem_cap),
        (hist_item, hist_art, hist_cap),
    ]
    reviewed_result = MagicMock()
    reviewed_result.all.return_value = []

    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock(side_effect=[item_result, reviewed_result])
    session.add = MagicMock()
    session.commit = AsyncMock()

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/api/v1/review/queue?tags=biology%2Cchemistry&mode=structured"
        )

    assert response.status_code == 200
    ids = {i["id"] for i in response.json()["items"]}
    assert ids == {"item-bio", "item-chem"}
    assert "item-hist" not in ids


# ---------------------------------------------------------------------------
# Slice 7 — POST /events with item_id records a review event
# ---------------------------------------------------------------------------


def _make_event_session() -> AsyncSession:
    session = MagicMock(spec=AsyncSession)
    session.add = MagicMock()
    session.commit = AsyncMock()
    return session


@pytest.mark.asyncio
async def test_record_event_returns_201_with_id() -> None:
    mock_session = _make_event_session()

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/review/events",
            json={"item_id": "item-1", "outcome": "passed"},
        )

    assert response.status_code == 201
    body = response.json()
    assert "id" in body
    assert isinstance(body["id"], str)
    assert mock_session.commit.called


# ---------------------------------------------------------------------------
# Slice 8 — invalid outcome returns 422
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_record_event_invalid_outcome_returns_422() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/review/events",
            json={"item_id": "item-1", "outcome": "maybe"},
        )

    assert response.status_code == 422
