from __future__ import annotations

import base64
import json
from abc import ABC, abstractmethod
from typing import Any, Literal, cast

import anthropic
import litellm
import openai

from app.core.config import settings

_ANTHROPIC_IMAGE_TYPES = frozenset({"image/gif", "image/jpeg", "image/png", "image/webp"})


class LLMBackend(ABC):
    @abstractmethod
    async def call_structured(
        self,
        prompt: str,
        schema: dict[str, Any],
        model: str,
    ) -> dict[str, Any]: ...

    @abstractmethod
    async def call_vision(
        self,
        image_bytes: bytes,
        content_type: str,
        prompt: str,
        model: str,
    ) -> str: ...


class AnthropicBackend(LLMBackend):
    def __init__(self) -> None:
        self._client = anthropic.AsyncAnthropic()

    async def call_structured(
        self,
        prompt: str,
        schema: dict[str, Any],
        model: str,
    ) -> dict[str, Any]:
        response = await self._client.messages.create(
            model=model,
            max_tokens=1024,
            tools=[
                {
                    "name": "output",
                    "description": "Return the structured output.",
                    "input_schema": schema,
                }
            ],
            tool_choice={"type": "tool", "name": "output"},
            messages=[{"role": "user", "content": prompt}],
        )
        tool_block = next(b for b in response.content if b.type == "tool_use")
        return dict(tool_block.input)

    async def call_vision(
        self,
        image_bytes: bytes,
        content_type: str,
        prompt: str,
        model: str,
    ) -> str:
        if content_type not in _ANTHROPIC_IMAGE_TYPES:
            raise ValueError(f"Unsupported image content_type: {content_type!r}")
        b64 = base64.standard_b64encode(image_bytes).decode()
        response = await self._client.messages.create(
            model=model,
            max_tokens=2048,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": cast(
                                    Literal["image/gif", "image/jpeg", "image/png", "image/webp"],
                                    content_type,
                                ),
                                "data": b64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
        block = response.content[0]
        if block.type != "text":
            raise ValueError(f"Unexpected response block type: {block.type}")
        return block.text


class OpenAICompatBackend(LLMBackend):
    """Works with Ollama, LM Studio, OpenRouter, or any OpenAI-compatible endpoint."""

    def __init__(self) -> None:
        self._client = openai.AsyncOpenAI(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key,
        )

    async def call_structured(
        self,
        prompt: str,
        schema: dict[str, Any],
        model: str,
    ) -> dict[str, Any]:
        response = await self._client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            tools=[
                {
                    "type": "function",
                    "function": {
                        "name": "output",
                        "description": "Return the structured output.",
                        "parameters": schema,
                    },
                }
            ],
            tool_choice="required",  # Ollama/LM Studio only support string values
        )
        args = response.choices[0].message.tool_calls[0].function.arguments  # type: ignore[index, union-attr]
        return json.loads(args)  # type: ignore[no-any-return]

    async def call_vision(
        self,
        image_bytes: bytes,
        content_type: str,
        prompt: str,
        model: str,
    ) -> str:
        b64 = base64.standard_b64encode(image_bytes).decode()
        data_url = f"data:{content_type};base64,{b64}"
        response = await self._client.chat.completions.create(
            model=model,
            max_tokens=2048,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": data_url}},
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
        content = response.choices[0].message.content
        return content or ""


class OpenRouterBackend(LLMBackend):
    """Routes calls through OpenRouter via LiteLLM."""

    async def call_structured(
        self,
        prompt: str,
        schema: dict[str, Any],
        model: str,
    ) -> dict[str, Any]:
        response = await litellm.acompletion(
            model=f"openrouter/{model}",
            api_key=settings.openrouter_api_key,
            messages=[{"role": "user", "content": prompt}],
            tools=[
                {
                    "type": "function",
                    "function": {
                        "name": "output",
                        "description": "Return the structured output.",
                        "parameters": schema,
                    },
                }
            ],
            tool_choice="required",
        )
        args = response.choices[0].message.tool_calls[0].function.arguments  # type: ignore[index, union-attr]
        return json.loads(args)  # type: ignore[no-any-return]

    async def call_vision(
        self,
        image_bytes: bytes,
        content_type: str,
        prompt: str,
        model: str,
    ) -> str:
        b64 = base64.standard_b64encode(image_bytes).decode()
        data_url = f"data:{content_type};base64,{b64}"
        response = await litellm.acompletion(
            model=f"openrouter/{model}",
            api_key=settings.openrouter_api_key,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": data_url}},
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
        content = response.choices[0].message.content  # type: ignore[union-attr]
        return content or ""  # type: ignore[return-value]


def get_llm_backend() -> LLMBackend:
    if settings.llm_provider == "openai_compat":
        return OpenAICompatBackend()
    if settings.llm_provider == "openrouter":
        return OpenRouterBackend()
    return AnthropicBackend()
