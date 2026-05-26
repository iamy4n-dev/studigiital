from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import Any

import anthropic
import openai

from app.core.config import settings


class LLMBackend(ABC):
    @abstractmethod
    async def call_structured(
        self,
        prompt: str,
        schema: dict[str, Any],
        model: str,
    ) -> dict[str, Any]: ...


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
        return dict(tool_block.input)  # type: ignore[arg-type]


class OpenAICompatBackend(LLMBackend):
    """Works with Ollama (http://localhost:11434/v1) and LM Studio (http://localhost:1234/v1)."""

    def __init__(self) -> None:
        self._client = openai.AsyncOpenAI(
            base_url=settings.llm_base_url,
            api_key="local",  # local servers don't verify the key; SDK requires a non-empty value
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
            tool_choice={"type": "function", "function": {"name": "output"}},
        )
        args = response.choices[0].message.tool_calls[0].function.arguments  # type: ignore[index]
        return json.loads(args)  # type: ignore[no-any-return]


def get_llm_backend() -> LLMBackend:
    if settings.llm_provider == "openai_compat":
        return OpenAICompatBackend()
    return AnthropicBackend()
