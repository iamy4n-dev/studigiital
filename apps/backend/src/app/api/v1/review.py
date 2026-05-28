from __future__ import annotations

import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import UserClaims, get_current_user
from app.core.db import get_session
from app.models.artifact import Artifact
from app.models.artifact_item import ArtifactItem
from app.models.capture import Capture
from app.models.review_event import ReviewEvent

router = APIRouter()

CurrentUser = Annotated[UserClaims, Depends(get_current_user)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


class DrillItemOut(BaseModel):
    id: str
    artifact_id: str
    item_type: str
    content: dict[str, Any]
    tags: list[str]
    source_text: str


class QueueResponse(BaseModel):
    items: list[DrillItemOut]
    new_count: int
    reviewed_count: int


class RecordEventRequest(BaseModel):
    item_id: str
    outcome: Literal["passed", "failed"]


class RecordEventResponse(BaseModel):
    id: str
    xp_gained: int


@router.get("/queue", response_model=QueueResponse)
async def get_queue(
    tags: str,
    mode: Literal["structured", "random"],
    user: CurrentUser,
    session: SessionDep,
) -> QueueResponse:
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]

    item_stmt = (
        select(ArtifactItem, Artifact, Capture)
        .join(Artifact, ArtifactItem.artifact_id == Artifact.id)
        .join(Capture, Artifact.capture_id == Capture.id)
        .where(Capture.user_id == user.user_id)
    )
    rows = await session.execute(item_stmt)
    all_triples = rows.all()

    matching = [
        (item, a, c)
        for item, a, c in all_triples
        if a.status == "tagged" and isinstance(a.tags, list) and any(t in a.tags for t in tag_list)
    ]

    reviewed_ids_stmt = select(ReviewEvent.item_id).where(
        ReviewEvent.user_id == user.user_id
    )
    reviewed_rows = await session.execute(reviewed_ids_stmt)
    reviewed_ids = {row[0] for row in reviewed_rows.all()}

    new_count = sum(1 for item, _, _ in matching if item.id not in reviewed_ids)
    reviewed_count = sum(1 for item, _, _ in matching if item.id in reviewed_ids)

    if mode == "structured":
        unreviewed = [(item, a, c) for item, a, c in matching if item.id not in reviewed_ids]
        reviewed = [(item, a, c) for item, a, c in matching if item.id in reviewed_ids]
        ordered = unreviewed + reviewed
    else:
        import random
        ordered = list(matching)
        random.shuffle(ordered)

    items = [
        DrillItemOut(
            id=item.id,
            artifact_id=item.artifact_id,
            item_type=item.item_type,
            content=item.content,
            tags=a.tags if isinstance(a.tags, list) else [],
            source_text=c.raw_content or "",
        )
        for item, a, c in ordered
    ]

    return QueueResponse(items=items, new_count=new_count, reviewed_count=reviewed_count)


@router.post("/events", response_model=RecordEventResponse, status_code=201)
async def record_event(
    payload: RecordEventRequest,
    user: CurrentUser,
    session: SessionDep,
) -> RecordEventResponse:
    xp_gained = 0

    if payload.outcome == "passed":
        # Check the item's last outcome before this review
        prev_stmt = (
            select(ReviewEvent.outcome)
            .where(ReviewEvent.user_id == user.user_id, ReviewEvent.item_id == payload.item_id)
            .order_by(ReviewEvent.reviewed_at.desc())
            .limit(1)
        )
        prev_row = (await session.execute(prev_stmt)).first()
        prev_outcome = prev_row[0] if prev_row else None

        if prev_outcome != "passed":
            failed_count_stmt = (
                select(func.count())
                .select_from(ReviewEvent)
                .where(
                    ReviewEvent.user_id == user.user_id,
                    ReviewEvent.item_id == payload.item_id,
                    ReviewEvent.outcome == "failed",
                )
            )
            failed_count = (await session.execute(failed_count_stmt)).scalar() or 0
            xp_gained = 1 + failed_count

    event_id = str(uuid.uuid4())
    event = ReviewEvent(
        id=event_id,
        user_id=user.user_id,
        item_id=payload.item_id,
        outcome=payload.outcome,
    )
    session.add(event)
    await session.commit()
    return RecordEventResponse(id=event_id, xp_gained=xp_gained)
