from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import UserClaims, get_current_user
from app.core.db import get_session
from app.models.artifact import Artifact
from app.models.artifact_item import ArtifactItem
from app.models.capture import Capture
from app.models.review_event import ReviewEvent

CurrentUser = Annotated[UserClaims, Depends(get_current_user)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]

router = APIRouter()


class TagMastery(BaseModel):
    tag: str
    item_count: int
    passed_count: int
    mastery_pct: float
    above_threshold: bool


class ActivitySummary(BaseModel):
    mistakes_resolved_this_week: int
    tags_improved_this_week: int


class MasteryResponse(BaseModel):
    tags: list[TagMastery]
    activity: ActivitySummary
    streak_days: int
    xp: int


@router.get("/mastery", response_model=MasteryResponse)
async def get_mastery(user: CurrentUser, session: SessionDep) -> MasteryResponse:
    # 1. All artifact items with their artifact's tag list (tagged artifacts only)
    items_stmt = (
        select(ArtifactItem.id, Artifact.tags)
        .join(Artifact, ArtifactItem.artifact_id == Artifact.id)
        .join(Capture, Artifact.capture_id == Capture.id)
        .where(Capture.user_id == user.user_id, Artifact.status == "tagged")
    )
    items_rows = (await session.execute(items_stmt)).all()

    # 2. Items whose most recent ReviewEvent is 'passed' (last outcome wins)
    last_event_subq = (
        select(ReviewEvent.item_id, ReviewEvent.outcome)
        .where(ReviewEvent.user_id == user.user_id)
        .distinct(ReviewEvent.item_id)
        .order_by(ReviewEvent.item_id, ReviewEvent.reviewed_at.desc())
        .subquery("last_event")
    )
    passed_stmt = select(last_event_subq.c.item_id).where(last_event_subq.c.outcome == "passed")
    passed_rows = (await session.execute(passed_stmt)).all()
    passed_ids: set[str] = {row[0] for row in passed_rows}

    # Compute per-tag mastery
    tag_totals: dict[str, int] = {}
    tag_passed: dict[str, int] = {}
    for item_id, tags in items_rows:
        for tag in (tags or []):
            tag_totals[tag] = tag_totals.get(tag, 0) + 1
            if item_id in passed_ids:
                tag_passed[tag] = tag_passed.get(tag, 0) + 1

    tag_masteries = []
    for tag, total in sorted(tag_totals.items()):
        passed_count = tag_passed.get(tag, 0)
        pct = round(passed_count / total * 100, 1) if total else 0.0
        tag_masteries.append(TagMastery(
            tag=tag,
            item_count=total,
            passed_count=passed_count,
            mastery_pct=pct,
            above_threshold=pct >= 80.0,
        ))

    # 3. Items that passed this week AND have at least one prior failure (mistakes resolved)
    week_start = datetime.now(UTC) - timedelta(days=7)
    prior_failed_subq = (
        select(ReviewEvent.item_id)
        .where(ReviewEvent.user_id == user.user_id, ReviewEvent.outcome == "failed")
        .distinct()
        .subquery("prior_failed")
    )
    week_stmt = (
        select(ReviewEvent.item_id, ReviewEvent.reviewed_at)
        .where(
            ReviewEvent.user_id == user.user_id,
            ReviewEvent.outcome == "passed",
            ReviewEvent.reviewed_at >= week_start,
            ReviewEvent.item_id.in_(select(prior_failed_subq.c.item_id)),
        )
    )
    week_rows = (await session.execute(week_stmt)).all()

    # SQL already restricts to items with prior failures — count all distinct items
    resolved_this_week: set[str] = {row[0] for row in week_rows}
    mistakes_resolved = len(resolved_this_week)

    # tags improved = distinct tags that had at least one item resolved this week
    item_to_tags: dict[str, list[str]] = {}
    for item_id, tags in items_rows:
        item_to_tags[item_id] = tags or []

    improved_tags: set[str] = set()
    for item_id in resolved_this_week:
        improved_tags.update(item_to_tags.get(item_id, []))
    tags_improved = len(improved_tags)

    # 4. XP = SUM(1 + lifetime_failed_count) for items whose last event is 'passed'
    failed_per_item = (
        select(
            ReviewEvent.item_id.label("item_id"),
            func.count().label("failed_count"),
        )
        .where(ReviewEvent.user_id == user.user_id, ReviewEvent.outcome == "failed")
        .group_by(ReviewEvent.item_id)
        .subquery("failed_per_item")
    )
    xp_stmt = (
        select(
            func.coalesce(
                func.sum(1 + func.coalesce(failed_per_item.c.failed_count, 0)),
                0,
            )
        )
        .select_from(last_event_subq)
        .outerjoin(failed_per_item, last_event_subq.c.item_id == failed_per_item.c.item_id)
        .where(last_event_subq.c.outcome == "passed")
    )
    xp: int = (await session.execute(xp_stmt)).scalar() or 0

    # 5. Streak = consecutive days ending today with ≥1 review event
    streak_stmt = (
        select(func.date_trunc("day", ReviewEvent.reviewed_at).label("day"))
        .where(ReviewEvent.user_id == user.user_id)
        .distinct()
        .order_by(literal_column("day").desc())
    )
    streak_rows = (await session.execute(streak_stmt)).all()
    streak_days = _compute_streak([row[0] for row in streak_rows])

    return MasteryResponse(
        tags=tag_masteries,
        activity=ActivitySummary(
            mistakes_resolved_this_week=mistakes_resolved,
            tags_improved_this_week=tags_improved,
        ),
        streak_days=streak_days,
        xp=xp,
    )


def _compute_streak(sorted_days: list[datetime]) -> int:
    if not sorted_days:
        return 0
    today = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    streak = 0
    expected = today
    for day in sorted_days:
        day_normalized = day.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=UTC)
        if day_normalized == expected:
            streak += 1
            expected = expected - timedelta(days=1)
        elif day_normalized < expected:
            break
    return streak
