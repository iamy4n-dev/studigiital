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
    status: str = "tagged",
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
    artifact.status = status

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


def _make_event_session(
    prev_outcome: str | None = None,
    prior_failed_count: int = 0,
) -> AsyncSession:
    session = MagicMock(spec=AsyncSession)

    prev_result = MagicMock()
    prev_result.first.return_value = (prev_outcome,) if prev_outcome is not None else None

    failed_count_result = MagicMock()
    failed_count_result.scalar.return_value = prior_failed_count

    session.execute = AsyncMock(side_effect=[prev_result, failed_count_result])
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


# ---------------------------------------------------------------------------
# Slice 9 — draft artifacts are excluded from the drill queue
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_queue_excludes_draft_artifacts() -> None:
    tagged_item, tagged_art, tagged_cap = _make_item(
        "item-tagged", "art-tagged", "flashcard",
        {"front": "Q", "back": "A"}, ["biology"], status="tagged",
    )
    draft_item, draft_art, draft_cap = _make_item(
        "item-draft", "art-draft", "flashcard",
        {"front": "Q2", "back": "A2"}, ["biology"], status="draft",
    )
    mock_session = _make_session(
        [(tagged_item, tagged_art, tagged_cap), (draft_item, draft_art, draft_cap)]
    )

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/review/queue?tags=biology&mode=structured")

    assert response.status_code == 200
    ids = [i["id"] for i in response.json()["items"]]
    assert "item-tagged" in ids
    assert "item-draft" not in ids


# ---------------------------------------------------------------------------
# Slice 10 — xp_gained: first-time pass earns 1 XP
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_record_event_first_pass_earns_one_xp() -> None:
    mock_session = _make_event_session(prev_outcome=None, prior_failed_count=0)

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/review/events",
            json={"item_id": "item-1", "outcome": "passed"},
        )

    assert response.status_code == 201
    assert response.json()["xp_gained"] == 1


# ---------------------------------------------------------------------------
# Slice 11 — xp_gained: pass after 2 failures earns 3 XP (difficulty-weighted)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_record_event_pass_after_failures_earns_difficulty_weighted_xp() -> None:
    mock_session = _make_event_session(prev_outcome="failed", prior_failed_count=2)

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/review/events",
            json={"item_id": "item-1", "outcome": "passed"},
        )

    assert response.status_code == 201
    assert response.json()["xp_gained"] == 3


# ---------------------------------------------------------------------------
# Slice 12 — xp_gained: re-pass (already passing) earns 0 XP
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_record_event_re_pass_earns_zero_xp() -> None:
    mock_session = _make_event_session(prev_outcome="passed", prior_failed_count=0)

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/review/events",
            json={"item_id": "item-1", "outcome": "passed"},
        )

    assert response.status_code == 201
    assert response.json()["xp_gained"] == 0


# ---------------------------------------------------------------------------
# Slice 13 — xp_gained: failure always earns 0 XP
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_record_event_failure_earns_zero_xp() -> None:
    mock_session = _make_event_session()

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/review/events",
            json={"item_id": "item-1", "outcome": "failed"},
        )

    assert response.status_code == 201
    assert response.json()["xp_gained"] == 0
