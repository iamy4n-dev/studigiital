from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import UserClaims, get_current_user

router = APIRouter()

CurrentUser = Annotated[UserClaims, Depends(get_current_user)]

LearningType = Literal["language_learner", "professional", "student", "generic"]

# In-memory store until DB is wired — replaced by DB in a future issue
_profiles: dict[str, LearningType] = {}


class UserProfileIn(BaseModel):
    learning_type: LearningType


class UserProfileOut(BaseModel):
    user_id: str
    learning_type: LearningType


@router.get("/me", response_model=UserClaims)
async def get_me(user: CurrentUser) -> UserClaims:
    return user


@router.post("/profile", response_model=UserProfileOut, status_code=201)
async def create_profile(payload: UserProfileIn, user: CurrentUser) -> UserProfileOut:
    _profiles[user.user_id] = payload.learning_type
    return UserProfileOut(user_id=user.user_id, learning_type=payload.learning_type)


@router.get("/profile", response_model=UserProfileOut)
async def get_profile(user: CurrentUser) -> UserProfileOut:
    learning_type = _profiles.get(user.user_id)
    if learning_type is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return UserProfileOut(user_id=user.user_id, learning_type=learning_type)
