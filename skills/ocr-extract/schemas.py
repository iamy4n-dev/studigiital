from pydantic import BaseModel


class OcrInput(BaseModel):
    media_key: str
    mime_type: str = "image/jpeg"


class OcrOutput(BaseModel):
    text: str
    confidence: float
