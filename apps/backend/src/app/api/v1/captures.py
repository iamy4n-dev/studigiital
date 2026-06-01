from __future__ import annotations

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import UserClaims, get_current_user
from app.core.config import settings
from app.core.db import get_session
from app.core.llm import LLMBackend, get_llm_backend
from app.core.s3 import download_s3_object, generate_presigned_put_url
from app.models.artifact import Artifact
from app.models.artifact_item import ArtifactItem
from app.models.capture import Capture
from app.skills.generate_flashcard import (
    FlashcardPair,
    GenerateFlashcardInput,
    GenerateFlashcardSkill,
)
from app.skills.generate_note import GenerateNoteInput, GenerateNoteSkill
from app.skills.generate_quiz import GenerateQuizInput, GenerateQuizSkill, QuizQuestion
from app.skills.infer_format import InferFormatInput
from app.skills.ocr_extract import OcrExtractSkill
from app.skills.registry import SkillRegistry
from app.skills.suggest_tags import SuggestTagsInput, SuggestTagsSkill

router = APIRouter()

LLMBackendDep = Annotated[LLMBackend, Depends(get_llm_backend)]
CurrentUser = Annotated[UserClaims, Depends(get_current_user)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


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
    source_artifact_id: str | None = None  # if set, inherit committed tags (Derivation)
    confirmed_tags: list[str] = Field(default_factory=list)


class FlashcardTransformResponse(BaseModel):
    skill_name: Literal["generate_flashcard"]
    cards: list[FlashcardPair]
    source_summary: str
    suggested_tags: list[str] = []
    artifact_id: str = ""


class NoteTransformResponse(BaseModel):
    skill_name: Literal["generate_note"]
    title: str
    body_markdown: str
    key_points: list[str]
    suggested_tags: list[str] = []
    artifact_id: str = ""


class QuizTransformResponse(BaseModel):
    skill_name: Literal["generate_quiz"]
    questions: list[QuizQuestion]
    suggested_tags: list[str] = []
    artifact_id: str = ""


TransformResponse = Annotated[
    FlashcardTransformResponse | NoteTransformResponse | QuizTransformResponse,
    Field(discriminator="skill_name"),
]


class SuggestTagsRequest(BaseModel):
    text: str = Field(min_length=1)
    existing_tags: list[str] = Field(default_factory=list)


class SuggestTagsResponse(BaseModel):
    suggestions: list[str]


class UploadUrlRequest(BaseModel):
    filename: str
    content_type: str


class UploadUrlResponse(BaseModel):
    upload_url: str
    object_key: str


class OcrRequest(BaseModel):
    media_key: str
    content_type: str = "image/jpeg"


class OcrResponse(BaseModel):
    extracted_text: str
    suggested_tags: list[str]


@router.post("/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    payload: UploadUrlRequest,
    user: CurrentUser,
) -> UploadUrlResponse:
    object_key = f"captures/{user.user_id}/{uuid.uuid4()}/{payload.filename}"
    upload_url = generate_presigned_put_url(object_key, payload.content_type)
    return UploadUrlResponse(upload_url=upload_url, object_key=object_key)


@router.post("/ocr", response_model=OcrResponse)
async def ocr_capture(
    payload: OcrRequest,
    _user: CurrentUser,
    backend: LLMBackendDep,
) -> OcrResponse:
    image_bytes = download_s3_object(payload.media_key)
    ocr_skill = OcrExtractSkill(backend, settings.llm_model_ocr)
    extracted_text = await ocr_skill.run(image_bytes, payload.content_type)
    tags_skill = SuggestTagsSkill(backend, settings.llm_model_infer)
    tags_out = await tags_skill.run(SuggestTagsInput(text=extracted_text))
    return OcrResponse(extracted_text=extracted_text, suggested_tags=tags_out.suggestions)


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
    user: CurrentUser,
    backend: LLMBackendDep,
    session: SessionDep,
) -> FlashcardTransformResponse | NoteTransformResponse | QuizTransformResponse:
    registry = SkillRegistry(backend)
    if payload.skill_name:
        skill_name = payload.skill_name
    else:
        infer_out = await registry.get_infer_skill().run(InferFormatInput(text=payload.text))
        skill_name = infer_out.skill_name

    result: FlashcardTransformResponse | NoteTransformResponse | QuizTransformResponse
    if skill_name == "generate_flashcard":
        fc_skill = registry.get_generate_skill("generate_flashcard", payload.tier)
        assert isinstance(fc_skill, GenerateFlashcardSkill)
        fc_out = await fc_skill.run(GenerateFlashcardInput(text=payload.text))
        result = FlashcardTransformResponse(
            skill_name="generate_flashcard",
            cards=fc_out.cards,
            source_summary=fc_out.source_summary,
        )
    elif skill_name == "generate_note":
        note_skill = registry.get_generate_skill("generate_note", payload.tier)
        assert isinstance(note_skill, GenerateNoteSkill)
        note_out = await note_skill.run(GenerateNoteInput(text=payload.text))
        result = NoteTransformResponse(
            skill_name="generate_note",
            title=note_out.title,
            body_markdown=note_out.body_markdown,
            key_points=note_out.key_points,
        )
    elif skill_name == "generate_quiz":
        quiz_skill = registry.get_generate_skill("generate_quiz", payload.tier)
        assert isinstance(quiz_skill, GenerateQuizSkill)
        quiz_out = await quiz_skill.run(GenerateQuizInput(text=payload.text))
        result = QuizTransformResponse(skill_name="generate_quiz", questions=quiz_out.questions)
    else:
        raise ValueError(f"Unsupported skill: {skill_name!r}")

    if payload.confirmed_tags:
        result.suggested_tags = payload.confirmed_tags
    elif payload.source_artifact_id:
        stmt = (
            select(Artifact, Capture)
            .join(Capture, Artifact.capture_id == Capture.id)
            .where(Artifact.id == payload.source_artifact_id, Capture.user_id == user.user_id)
        )
        row = await session.execute(stmt)
        source_result = row.one_or_none()
        if source_result is None:
            raise HTTPException(status_code=404, detail="Source artifact not found")
        source_artifact, _ = source_result
        tags = source_artifact.tags
        result.suggested_tags = tags if isinstance(tags, list) else []
    else:
        tags_skill = SuggestTagsSkill(backend, settings.llm_model_infer)
        tags_out = await tags_skill.run(SuggestTagsInput(text=payload.text))
        result.suggested_tags = tags_out.suggestions

    artifact_id = str(uuid.uuid4())
    capture = Capture(
        id=str(uuid.uuid4()),
        user_id=user.user_id,
        mode="quick_text",
        raw_content=payload.text,
        status="transformed",
    )
    session.add(capture)
    await session.flush()  # INSERT capture before artifact references it via FK
    artifact = Artifact(
        id=artifact_id,
        capture_id=capture.id,
        artifact_type=skill_name,
        content=result.model_dump(),
        tags=payload.confirmed_tags,
        status="draft",
    )
    session.add(artifact)
    await session.flush()

    if isinstance(result, FlashcardTransformResponse):
        for i, card in enumerate(result.cards):
            session.add(ArtifactItem(
                id=str(uuid.uuid4()),
                artifact_id=artifact_id,
                item_type="flashcard",
                content={"front": card.front, "back": card.back},
                position=i,
            ))
    elif isinstance(result, QuizTransformResponse):
        for i, q in enumerate(result.questions):
            session.add(ArtifactItem(
                id=str(uuid.uuid4()),
                artifact_id=artifact_id,
                item_type="quiz_question",
                content={
                    "stem": q.stem,
                    "options": q.options,
                    "correct_index": q.correct_index,
                    "explanation": q.explanation,
                },
                position=i,
            ))
    elif isinstance(result, NoteTransformResponse):
        session.add(ArtifactItem(
            id=str(uuid.uuid4()),
            artifact_id=artifact_id,
            item_type="note",
            content={"title": result.title, "body_markdown": result.body_markdown},
            position=0,
        ))

    await session.commit()

    result.artifact_id = artifact_id
    return result


@router.post("/", response_model=CaptureOut, status_code=201)
async def create_capture(
    payload: CaptureCreate,
    user: CurrentUser,
    session: SessionDep,
) -> CaptureOut:
    from datetime import UTC, datetime

    capture = Capture(
        id=str(uuid.uuid4()),
        user_id=user.user_id,
        mode=payload.mode,
        raw_content=payload.raw_content,
        media_key=payload.media_key,
        status="pending",
        created_at=datetime.now(UTC),
    )
    session.add(capture)
    await session.commit()
    return CaptureOut(
        id=capture.id,
        user_id=capture.user_id,
        mode=capture.mode,
        status=capture.status,
        created_at=capture.created_at.isoformat(),
    )


@router.get("/{capture_id}", response_model=CaptureOut)
async def get_capture(capture_id: str) -> CaptureOut:
    raise NotImplementedError


@router.get("/", response_model=list[CaptureOut])
async def list_captures() -> list[CaptureOut]:
    raise NotImplementedError
