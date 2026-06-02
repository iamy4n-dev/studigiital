from unittest.mock import ANY, AsyncMock, MagicMock

import pytest

from app.core.llm import LLMBackend
from app.skills.ocr_extract import OcrExtractSkill


@pytest.mark.asyncio
async def test_ocr_extract_returns_text_from_backend() -> None:
    mock_backend = MagicMock(spec=LLMBackend)
    mock_backend.call_vision = AsyncMock(return_value="Photosynthesis converts sunlight to energy.")
    skill = OcrExtractSkill(mock_backend, "claude-haiku")

    result = await skill.run(b"\xff\xd8\xff", "image/jpeg")

    assert result == "Photosynthesis converts sunlight to energy."


@pytest.mark.asyncio
async def test_ocr_extract_passes_image_bytes_and_model() -> None:
    mock_backend = MagicMock(spec=LLMBackend)
    mock_backend.call_vision = AsyncMock(return_value="some text")
    skill = OcrExtractSkill(mock_backend, "claude-haiku-test")

    await skill.run(b"\x89PNG\r\n\x1a\n", "image/png")

    mock_backend.call_vision.assert_called_once_with(
        b"\x89PNG\r\n\x1a\n",
        "image/png",
        ANY,
        "claude-haiku-test",
    )
