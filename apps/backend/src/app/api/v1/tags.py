from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class TagOut(BaseModel):
    id: str
    name: str
    color: str
    mastery_score: float


@router.get("/", response_model=list[TagOut])
async def list_tags() -> list[TagOut]:
    raise NotImplementedError


@router.get("/{tag_id}", response_model=TagOut)
async def get_tag(tag_id: str) -> TagOut:
    raise NotImplementedError
