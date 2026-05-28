from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import UserClaims, get_current_user
from app.core.db import get_session
from app.main import app


@pytest.fixture(autouse=True)
def override_auth() -> None:
    app.dependency_overrides[get_current_user] = lambda: UserClaims(
        user_id="test-user", tier="free"
    )
    yield  # type: ignore[misc]
    app.dependency_overrides.clear()


def _make_session(
    item_rows: list[tuple],  # (item_id, tags)
    passed_ids: list[str] | None = None,
    events_this_week: list[tuple] | None = None,  # (item_id, reviewed_at)
    xp: int = 0,
    streak_dates: list[datetime] | None = None,
) -> AsyncSession:
    """Build a mock session for profile mastery tests.

    execute is called in order:
      1. items query → (item_id, tags[]) rows
      2. passed ids query → (item_id,) rows
      3. this-week passed events → (item_id, reviewed_at) rows
      4. xp query → scalar result
      5. streak dates query → (date,) rows
    """
    session = MagicMock(spec=AsyncSession)

    items_result = MagicMock()
    items_result.all.return_value = item_rows

    passed_result = MagicMock()
    passed_result.all.return_value = [(pid,) for pid in (passed_ids or [])]

    week_result = MagicMock()
    week_result.all.return_value = events_this_week or []

    xp_result = MagicMock()
    xp_result.scalar.return_value = xp

    streak_result = MagicMock()
    streak_result.all.return_value = [(d,) for d in (streak_dates or [])]

    session.execute = AsyncMock(
        side_effect=[items_result, passed_result, week_result, xp_result, streak_result]
    )
    return session


# ---------------------------------------------------------------------------
# Slice 1 — endpoint returns 200 with expected shape
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mastery_returns_200_with_schema() -> None:
    mock_session = _make_session([])

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/profile/mastery")

    assert response.status_code == 200
    body = response.json()
    assert "tags" in body
    assert "activity" in body
    assert "mistakes_resolved_this_week" in body["activity"]
    assert "tags_improved_this_week" in body["activity"]
    assert "streak_days" in body
    assert "xp" in body


# ---------------------------------------------------------------------------
# Slice 2 — tag where all items are passed → mastery_pct 100
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mastery_all_items_passed_is_100_pct() -> None:
    mock_session = _make_session(
        item_rows=[("item-1", ["biology"]), ("item-2", ["biology"])],
        passed_ids=["item-1", "item-2"],
    )

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/profile/mastery")

    tags = response.json()["tags"]
    assert len(tags) == 1
    bio = tags[0]
    assert bio["tag"] == "biology"
    assert bio["mastery_pct"] == 100.0
    assert bio["item_count"] == 2
    assert bio["passed_count"] == 2


# ---------------------------------------------------------------------------
# Slice 3 — partial pass → correct percentage
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mastery_partial_pass_is_correct_pct() -> None:
    mock_session = _make_session(
        item_rows=[
            ("item-1", ["chemistry"]),
            ("item-2", ["chemistry"]),
            ("item-3", ["chemistry"]),
            ("item-4", ["chemistry"]),
        ],
        passed_ids=["item-1", "item-2"],
    )

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/profile/mastery")

    tags = response.json()["tags"]
    chem = next(t for t in tags if t["tag"] == "chemistry")
    assert chem["mastery_pct"] == 50.0
    assert chem["passed_count"] == 2
    assert chem["item_count"] == 4


# ---------------------------------------------------------------------------
# Slice 4 — above_threshold: true when mastery_pct >= 80
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mastery_above_threshold_flag() -> None:
    mock_session = _make_session(
        item_rows=[
            ("item-1", ["physics"]),
            ("item-2", ["physics"]),
            ("item-3", ["physics"]),
            ("item-4", ["physics"]),
            ("item-5", ["physics"]),
        ],
        passed_ids=["item-1", "item-2", "item-3", "item-4"],
    )

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/profile/mastery")

    tags = response.json()["tags"]
    phys = tags[0]
    assert phys["mastery_pct"] == 80.0
    assert phys["above_threshold"] is True


@pytest.mark.asyncio
async def test_mastery_below_threshold_flag() -> None:
    mock_session = _make_session(
        item_rows=[("item-1", ["math"]), ("item-2", ["math"])],
        passed_ids=["item-1"],
    )

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/profile/mastery")

    tags = response.json()["tags"]
    assert tags[0]["above_threshold"] is False


# ---------------------------------------------------------------------------
# Slice 5 — xp = total passed events count
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mastery_xp_equals_total_passed_events() -> None:
    mock_session = _make_session(item_rows=[], xp=42)

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/profile/mastery")

    assert response.json()["xp"] == 42


# ---------------------------------------------------------------------------
# Slice 6 — mistakes_resolved_this_week
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mastery_mistakes_resolved_this_week() -> None:
    now = datetime.now(UTC)
    mock_session = _make_session(
        item_rows=[("item-1", ["biology"]), ("item-2", ["biology"])],
        passed_ids=["item-1", "item-2"],
        events_this_week=[("item-1", now), ("item-2", now)],
    )

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/profile/mastery")

    assert response.json()["activity"]["mistakes_resolved_this_week"] == 2


# ---------------------------------------------------------------------------
# Slice 7 — tags_improved_this_week
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mastery_tags_improved_this_week() -> None:
    now = datetime.now(UTC)
    mock_session = _make_session(
        item_rows=[
            ("item-bio", ["biology"]),
            ("item-chem", ["chemistry"]),
        ],
        passed_ids=["item-bio", "item-chem"],
        events_this_week=[("item-bio", now), ("item-chem", now)],
    )

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/profile/mastery")

    assert response.json()["activity"]["tags_improved_this_week"] == 2


# ---------------------------------------------------------------------------
# Slice 8 — streak_days
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mastery_streak_days() -> None:
    today = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday = today - timedelta(days=1)
    two_days_ago = today - timedelta(days=2)
    mock_session = _make_session(
        item_rows=[],
        streak_dates=[today, yesterday, two_days_ago],
    )

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/profile/mastery")

    assert response.json()["streak_days"] == 3


@pytest.mark.asyncio
async def test_mastery_streak_breaks_on_gap() -> None:
    today = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday = today - timedelta(days=1)
    three_days_ago = today - timedelta(days=3)
    mock_session = _make_session(
        item_rows=[],
        streak_dates=[today, yesterday, three_days_ago],
    )

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield mock_session

    app.dependency_overrides[get_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/profile/mastery")

    assert response.json()["streak_days"] == 2
