from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.auth import UserClaims, get_current_user
from app.core.config import settings
from app.core.llm import LLMBackend, get_llm_backend
from app.skills.generate_flashcard import FlashcardPair, GenerateFlashcardInput, GenerateFlashcardSkill
from app.skills.generate_note import GenerateNoteInput, GenerateNoteSkill
from app.skills.generate_quiz import GenerateQuizInput, GenerateQuizSkill, QuizQuestion
from app.skills.infer_format import InferFormatInput
from app.skills.registry import SkillRegistry
from app.skills.suggest_tags import SuggestTagsInput, SuggestTagsSkill

router = APIRouter()

LLMBackendDep = Annotated[LLMBackend, Depends(get_llm_backend)]
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
    text: str = Field(min_length=1)
    tier: Literal["free", "paid"] = "free"
    skill_name: str | None = None  # if set, skips the infer step


class FlashcardTransformResponse(BaseModel):
    skill_name: Literal["generate_flashcard"]
    cards: list[FlashcardPair]
    source_summary: str


class NoteTransformResponse(BaseModel):
    skill_name: Literal["generate_note"]
    title: str
    body_markdown: str
    key_points: list[str]


class QuizTransformResponse(BaseModel):
    skill_name: Literal["generate_quiz"]
    questions: list[QuizQuestion]


TransformResponse = Annotated[
    FlashcardTransformResponse | NoteTransformResponse | QuizTransformResponse,
    Field(discriminator="skill_name"),
]


class SuggestTagsRequest(BaseModel):
    text: str = Field(min_length=1)
    existing_tags: list[str] = Field(default_factory=list)


class SuggestTagsResponse(BaseModel):
    suggestions: list[str]


@router.post("/suggest-tags", response_model=SuggestTagsResponse)
async def suggest_tags(
    payload: SuggestTagsRequest,
    _user: CurrentUser,
    backend: LLMBackendDep,
) -> SuggestTagsResponse:
    skill = SuggestTagsSkill(backend, settings.llm_model_infer)
    out = await skill.run(SuggestTagsInput(text=payload.text, existing_tags=payload.existing_tags))
    return SuggestTagsResponse(suggestions=out.suggestions)


@router.post("/transform", response_model=TransformResponse)
async def transform_capture(
    payload: TransformRequest,
    _user: CurrentUser,
    backend: LLMBackendDep,
) -> FlashcardTransformResponse | NoteTransformResponse | QuizTransformResponse:
    registry = SkillRegistry(backend)
    if payload.skill_name:
        skill_name = payload.skill_name
    else:
        infer_out = await registry.get_infer_skill().run(InferFormatInput(text=payload.text))
        skill_name = infer_out.skill_name

    if skill_name == "generate_flashcard":
        skill = registry.get_generate_skill("generate_flashcard", payload.tier)
        assert isinstance(skill, GenerateFlashcardSkill)
        out = await skill.run(GenerateFlashcardInput(text=payload.text))
        return FlashcardTransformResponse(
            skill_name="generate_flashcard",
            cards=out.cards,
            source_summary=out.source_summary,
        )

    if skill_name == "generate_note":
        skill = registry.get_generate_skill("generate_note", payload.tier)
        assert isinstance(skill, GenerateNoteSkill)
        out = await skill.run(GenerateNoteInput(text=payload.text))
        return NoteTransformResponse(
            skill_name="generate_note",
            title=out.title,
            body_markdown=out.body_markdown,
            key_points=out.key_points,
        )

    if skill_name == "generate_quiz":
        skill = registry.get_generate_skill("generate_quiz", payload.tier)
        assert isinstance(skill, GenerateQuizSkill)
        out = await skill.run(GenerateQuizInput(text=payload.text))
        return QuizTransformResponse(skill_name="generate_quiz", questions=out.questions)

    raise ValueError(f"Unsupported skill: {skill_name!r}")


@router.post("/", response_model=CaptureOut, status_code=201)
async def create_capture(payload: CaptureCreate) -> CaptureOut:
    raise NotImplementedError


@router.get("/{capture_id}", response_model=CaptureOut)
async def get_capture(capture_id: str) -> CaptureOut:
    raise NotImplementedError


@router.get("/", response_model=list[CaptureOut])
async def list_captures() -> list[CaptureOut]:
    raise NotImplementedError
