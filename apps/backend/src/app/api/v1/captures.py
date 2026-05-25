from typing import Annotated, Literal

import anthropic
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.auth import UserClaims, get_current_user
from app.core.llm import get_anthropic_client
from app.skills.generate_flashcard import FlashcardPair, GenerateFlashcardInput
from app.skills.infer_format import InferFormatInput
from app.skills.registry import SkillRegistry
from app.skills.suggest_tags import SuggestTagsInput, SuggestTagsSkill

router = APIRouter()

AnthropicDep = Annotated[anthropic.AsyncAnthropic, Depends(get_anthropic_client)]
CurrentUser = Annotated[UserClaims, Depends(get_current_user)]


class CaptureCreate(BaseModel):
    mode: str  # "photo" | "quick_text" | "backlog"
    raw_content: str | None = None
    media_key: str | None = None


class CaptureOut(BaseModel):
    id: str
    user_id: str
    mode: str
    status: str
    created_at: str


class TransformRequest(BaseModel):
    text: str
    tier: Literal["free", "paid"] = "free"


class TransformResponse(BaseModel):
    skill_name: str
    cards: list[FlashcardPair]
    source_summary: str


class SuggestTagsRequest(BaseModel):
    text: str = Field(min_length=1)
    existing_tags: list[str] = Field(default_factory=list)


class SuggestTagsResponse(BaseModel):
    suggestions: list[str]


@router.post("/suggest-tags", response_model=SuggestTagsResponse)
async def suggest_tags(
    payload: SuggestTagsRequest,
    _user: CurrentUser,
    client: AnthropicDep,
) -> SuggestTagsResponse:
    skill = SuggestTagsSkill(client, model="claude-haiku-4-5-20251001")
    out = await skill.run(SuggestTagsInput(text=payload.text, existing_tags=payload.existing_tags))
    return SuggestTagsResponse(suggestions=out.suggestions)


@router.post("/transform", response_model=TransformResponse)
async def transform_capture(
    payload: TransformRequest,
    _user: CurrentUser,
    client: AnthropicDep,
) -> TransformResponse:
    registry = SkillRegistry(client)
    infer_out = await registry.get_infer_skill().run(InferFormatInput(text=payload.text))
    generate_out = await registry.get_generate_skill(infer_out.skill_name, payload.tier).run(
        GenerateFlashcardInput(text=payload.text)
    )
    return TransformResponse(
        skill_name=infer_out.skill_name,
        cards=generate_out.cards,
        source_summary=generate_out.source_summary,
    )


@router.post("/", response_model=CaptureOut, status_code=201)
async def create_capture(payload: CaptureCreate) -> CaptureOut:
    raise NotImplementedError


@router.get("/{capture_id}", response_model=CaptureOut)
async def get_capture(capture_id: str) -> CaptureOut:
    raise NotImplementedError


@router.get("/", response_model=list[CaptureOut])
async def list_captures() -> list[CaptureOut]:
    raise NotImplementedError
