from pydantic import BaseModel

from .models import ArtifactType


class TransformRequest(BaseModel):
    capture_id: str
    user_id: str
    text: str
    requested_type: ArtifactType | None = None


class ArtifactOut(BaseModel):
    id: str
    capture_id: str
    artifact_type: ArtifactType
    content: dict
    created_at: str
