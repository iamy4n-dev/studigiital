from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.llm import AnthropicBackend, OpenAICompatBackend


@pytest.mark.asyncio
async def test_anthropic_call_vision_returns_extracted_text() -> None:
    backend = AnthropicBackend.__new__(AnthropicBackend)
    mock_client = MagicMock()
    backend._client = mock_client

    mock_text_block = MagicMock()
    mock_text_block.type = "text"
    mock_text_block.text = "Hello from the image"
    mock_response = MagicMock()
    mock_response.content = [mock_text_block]
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    result = await backend.call_vision(
        b"\xff\xd8\xff", "image/jpeg", "Extract text", "claude-haiku"
    )

    assert result == "Hello from the image"
    mock_client.messages.create.assert_called_once()
    call_kwargs = mock_client.messages.create.call_args.kwargs
    messages = call_kwargs["messages"]
    content = messages[0]["content"]
    assert content[0]["type"] == "image"
    assert content[0]["source"]["type"] == "base64"
    assert content[0]["source"]["media_type"] == "image/jpeg"
    assert content[1]["type"] == "text"
    assert content[1]["text"] == "Extract text"


@pytest.mark.asyncio
async def test_anthropic_call_vision_raises_on_non_text_block() -> None:
    backend = AnthropicBackend.__new__(AnthropicBackend)
    mock_client = MagicMock()
    backend._client = mock_client

    mock_tool_block = MagicMock()
    mock_tool_block.type = "tool_use"
    mock_response = MagicMock()
    mock_response.content = [mock_tool_block]
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with pytest.raises(ValueError, match="Unexpected response block"):
        await backend.call_vision(b"\xff\xd8\xff", "image/jpeg", "Extract text", "claude-haiku")


@pytest.mark.asyncio
async def test_openai_compat_call_vision_returns_content() -> None:
    backend = OpenAICompatBackend.__new__(OpenAICompatBackend)
    mock_client = MagicMock()
    backend._client = mock_client

    mock_message = MagicMock()
    mock_message.content = "Vision output text"
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    result = await backend.call_vision(b"\x89PNG", "image/png", "What is in this image?", "llava")

    assert result == "Vision output text"
    call_kwargs = mock_client.chat.completions.create.call_args.kwargs
    messages = call_kwargs["messages"]
    content = messages[0]["content"]
    assert content[0]["type"] == "image_url"
    assert content[0]["image_url"]["url"].startswith("data:image/png;base64,")
    assert content[1]["type"] == "text"


@pytest.mark.asyncio
async def test_openai_compat_call_vision_returns_empty_string_when_content_none() -> None:
    backend = OpenAICompatBackend.__new__(OpenAICompatBackend)
    mock_client = MagicMock()
    backend._client = mock_client

    mock_message = MagicMock()
    mock_message.content = None
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    result = await backend.call_vision(b"\x89PNG", "image/png", "Extract text", "llava")

    assert result == ""
