from __future__ import annotations

from app.core.llm import LLMBackend

_PROMPT = (
    "Extract all text visible in this image. "
    "Return only the raw text content, preserving line breaks and structure where present. "
    "Do not add commentary or formatting. "
    "If no text is visible, return an empty string."
)


class OcrExtractSkill:
    def __init__(self, backend: LLMBackend, model: str) -> None:
        self._backend = backend
        self.model = model

    async def run(self, image_bytes: bytes, content_type: str) -> str:
        return await self._backend.call_vision(image_bytes, content_type, _PROMPT, self.model)
