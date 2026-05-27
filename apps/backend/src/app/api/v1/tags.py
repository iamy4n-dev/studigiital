from __future__ import annotations

import hashlib
from typing import Annotated

from fastapi import APIRouter, Depends
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

_PALETTE: list[tuple[str, str]] = [
    ("#dbeafe", "#1e40af"),  # blue
    ("#dcfce7", "#166534"),  # green
    ("#fef9c3", "#854d0e"),  # yellow
    ("#fce7f3", "#9d174d"),  # pink
    ("#ede9fe", "#5b21b6"),  # purple
    ("#ffedd5", "#9a3412"),  # orange
    ("#e0f2fe", "#0c4a6e"),  # sky
    ("#f0fdf4", "#14532d"),  # lime
]


def tag_colors(name: str) -> tuple[str, str]:
    h = int(hashlib.md5(name.encode()).hexdigest(), 16)
    return _PALETTE[h % len(_PALETTE)]


class TagOut(BaseModel):
    name: str
    bg: str
    text: str


@router.get("/", response_model=list[TagOut])
async def list_tags(user: CurrentUser, session: SessionDep) -> list[TagOut]:
    stmt = (
        select(Artifact.tags)
        .join(Capture, Artifact.capture_id == Capture.id)
        .where(Capture.user_id == user.user_id)
    )
    rows = await session.execute(stmt)
    names = sorted({tag for (tags,) in rows.all() for tag in (tags or [])})
    bg, text = zip(*[tag_colors(n) for n in names]) if names else ([], [])
    return [TagOut(name=n, bg=b, text=t) for n, b, t in zip(names, bg, text)]
