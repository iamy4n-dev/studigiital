from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import UserClaims, get_current_user
from app.core.db import get_session
from app.models.artifact import Artifact
from app.models.capture import Capture

router = APIRouter()

CurrentUser = Annotated[UserClaims, Depends(get_current_user)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


class ArtifactOut(BaseModel):
    id: str
    capture_id: str
    artifact_type: str
    content: dict[str, Any]
    created_at: str


@router.get("/", response_model=list[ArtifactOut])
async def list_artifacts(user: CurrentUser, session: SessionDep) -> list[ArtifactOut]:
    stmt = (
        select(Artifact)
        .join(Capture, Artifact.capture_id == Capture.id)
        .where(Capture.user_id == user.user_id)
        .order_by(Artifact.created_at.desc())
    )
    rows = await session.execute(stmt)
    return [
        ArtifactOut(
            id=a.id,
            capture_id=a.capture_id,
            artifact_type=a.artifact_type,
            content=a.content,
            created_at=a.created_at.isoformat(),
        )
        for a in rows.scalars().all()
    ]


@router.get("/{artifact_id}", response_model=ArtifactOut)
async def get_artifact(artifact_id: str, user: CurrentUser, session: SessionDep) -> ArtifactOut:
    stmt = (
        select(Artifact)
        .join(Capture, Artifact.capture_id == Capture.id)
        .where(Artifact.id == artifact_id, Capture.user_id == user.user_id)
    )
    row = await session.execute(stmt)
    artifact = row.scalar_one_or_none()
    if artifact is None:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return ArtifactOut(
        id=artifact.id,
        capture_id=artifact.capture_id,
        artifact_type=artifact.artifact_type,
        content=artifact.content,
        created_at=artifact.created_at.isoformat(),
    )
