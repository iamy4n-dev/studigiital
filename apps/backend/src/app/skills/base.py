from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

import anthropic
from pydantic import BaseModel


class BaseSkill[InputT: BaseModel, OutputT: BaseModel](ABC):
    def __init__(self, client: anthropic.AsyncAnthropic, model: str) -> None:
        self._client = client
        self.model = model

    @abstractmethod
    async def run(self, inp: InputT) -> OutputT: ...

    async def _call_structured(
        self,
        prompt: str,
        output_schema: type[OutputT],
    ) -> OutputT:
        schema: dict[str, Any] = output_schema.model_json_schema()
        response = await self._client.messages.create(
            model=self.model,
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
        return output_schema.model_validate(tool_block.input)
