from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class ArtifactOut(BaseModel):
    id: str
    capture_id: str
    artifact_type: str  # "note" | "flashcard" | "quiz"
    content: dict
    created_at: str


@router.get("/{artifact_id}", response_model=ArtifactOut)
async def get_artifact(artifact_id: str) -> ArtifactOut:
    raise NotImplementedError


@router.get("/", response_model=list[ArtifactOut])
async def list_artifacts() -> list[ArtifactOut]:
    raise NotImplementedError
