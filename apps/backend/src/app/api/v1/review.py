from __future__ import annotations

import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import UserClaims, get_current_user
from app.core.db import get_session
from app.models.artifact import Artifact
from app.models.capture import Capture
from app.models.review_event import ReviewEvent

router = APIRouter()

CurrentUser = Annotated[UserClaims, Depends(get_current_user)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


class ArtifactItem(BaseModel):
    id: str
    artifact_type: str
    content: dict[str, Any]
    tags: list[str]
    source_text: str


class QueueResponse(BaseModel):
    artifacts: list[ArtifactItem]
    new_count: int
    reviewed_count: int


class RecordEventRequest(BaseModel):
    artifact_id: str
    outcome: Literal["passed", "failed"]


class RecordEventResponse(BaseModel):
    id: str


@router.get("/queue", response_model=QueueResponse)
async def get_queue(
    tags: str,
    mode: Literal["structured", "random"],
    user: CurrentUser,
    session: SessionDep,
) -> QueueResponse:
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]

    artifact_stmt = (
        select(Artifact, Capture)
        .join(Capture, Artifact.capture_id == Capture.id)
        .where(Capture.user_id == user.user_id)
    )
    rows = await session.execute(artifact_stmt)
    all_pairs = rows.all()

    matching = [
        (a, c)
        for a, c in all_pairs
        if isinstance(a.tags, list) and any(t in a.tags for t in tag_list)
    ]

    reviewed_ids_stmt = select(ReviewEvent.artifact_id).where(
        ReviewEvent.user_id == user.user_id
    )
    reviewed_rows = await session.execute(reviewed_ids_stmt)
    reviewed_ids = {row[0] for row in reviewed_rows.all()}

    new_count = sum(1 for a, _ in matching if a.id not in reviewed_ids)
    reviewed_count = sum(1 for a, _ in matching if a.id in reviewed_ids)

    if mode == "structured":
        unreviewed = [(a, c) for a, c in matching if a.id not in reviewed_ids]
        reviewed = [(a, c) for a, c in matching if a.id in reviewed_ids]
        ordered = unreviewed + reviewed
    else:
        import random
        ordered = list(matching)
        random.shuffle(ordered)

    artifacts = [
        ArtifactItem(
            id=a.id,
            artifact_type=a.artifact_type,
            content=a.content,
            tags=a.tags if isinstance(a.tags, list) else [],
            source_text=c.raw_content or "",
        )
        for a, c in ordered
    ]

    return QueueResponse(artifacts=artifacts, new_count=new_count, reviewed_count=reviewed_count)


@router.post("/events", response_model=RecordEventResponse, status_code=201)
async def record_event(
    payload: RecordEventRequest,
    user: CurrentUser,
    session: SessionDep,
) -> RecordEventResponse:
    event_id = str(uuid.uuid4())
    event = ReviewEvent(
        id=event_id,
        user_id=user.user_id,
        artifact_id=payload.artifact_id,
        outcome=payload.outcome,
    )
    session.add(event)
    await session.commit()
    return RecordEventResponse(id=event_id)
