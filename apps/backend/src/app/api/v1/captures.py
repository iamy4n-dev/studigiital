from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


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


@router.post("/", response_model=CaptureOut, status_code=201)
async def create_capture(payload: CaptureCreate) -> CaptureOut:
    raise NotImplementedError


@router.get("/{capture_id}", response_model=CaptureOut)
async def get_capture(capture_id: str) -> CaptureOut:
    raise NotImplementedError


@router.get("/", response_model=list[CaptureOut])
async def list_captures() -> list[CaptureOut]:
    raise NotImplementedError
