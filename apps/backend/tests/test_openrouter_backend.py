import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.llm import OpenRouterBackend


@pytest.mark.asyncio
async def test_call_structured_returns_parsed_json() -> None:
    mock_fn = MagicMock()
    mock_fn.arguments = json.dumps({"front": "Q", "back": "A"})
    mock_tool_call = MagicMock()
    mock_tool_call.function = mock_fn
    mock_message = MagicMock()
    mock_message.tool_calls = [mock_tool_call]
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch("app.core.llm.litellm.acompletion", new=AsyncMock(return_value=mock_response)):
        backend = OpenRouterBackend()
        result = await backend.call_structured("prompt", {"type": "object"}, "google/gemma-3-27b-it")

    assert result == {"front": "Q", "back": "A"}


@pytest.mark.asyncio
async def test_call_structured_prefixes_model_with_openrouter() -> None:
    mock_fn = MagicMock()
    mock_fn.arguments = "{}"
    mock_tool_call = MagicMock()
    mock_tool_call.function = mock_fn
    mock_message = MagicMock()
    mock_message.tool_calls = [mock_tool_call]
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    mock_acompletion = AsyncMock(return_value=mock_response)
    with patch("app.core.llm.litellm.acompletion", new=mock_acompletion):
        backend = OpenRouterBackend()
        await backend.call_structured("prompt", {}, "anthropic/claude-sonnet-4-5")

    call_kwargs = mock_acompletion.call_args.kwargs
    assert call_kwargs["model"] == "openrouter/anthropic/claude-sonnet-4-5"


@pytest.mark.asyncio
async def test_call_vision_returns_text_content() -> None:
    mock_message = MagicMock()
    mock_message.content = "Extracted text from image"
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch("app.core.llm.litellm.acompletion", new=AsyncMock(return_value=mock_response)):
        backend = OpenRouterBackend()
        result = await backend.call_vision(b"\xff\xd8\xff", "image/jpeg", "Read this", "google/gemma-3-27b-it")

    assert result == "Extracted text from image"


@pytest.mark.asyncio
async def test_call_vision_returns_empty_string_when_content_none() -> None:
    mock_message = MagicMock()
    mock_message.content = None
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    with patch("app.core.llm.litellm.acompletion", new=AsyncMock(return_value=mock_response)):
        backend = OpenRouterBackend()
        result = await backend.call_vision(b"\x89PNG", "image/png", "Read this", "google/gemma-3-27b-it")

    assert result == ""


@pytest.mark.asyncio
async def test_call_vision_sends_base64_data_url() -> None:
    mock_message = MagicMock()
    mock_message.content = "ok"
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    mock_acompletion = AsyncMock(return_value=mock_response)
    with patch("app.core.llm.litellm.acompletion", new=mock_acompletion):
        backend = OpenRouterBackend()
        await backend.call_vision(b"\x89PNG", "image/png", "What is this?", "google/gemma-3-27b-it")

    messages = mock_acompletion.call_args.kwargs["messages"]
    content = messages[0]["content"]
    assert content[0]["type"] == "image_url"
    assert content[0]["image_url"]["url"].startswith("data:image/png;base64,")
    assert content[1]["type"] == "text"
    assert content[1]["text"] == "What is this?"
