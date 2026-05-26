from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel

from app.core.llm import LLMBackend


class BaseSkill[InputT: BaseModel, OutputT: BaseModel](ABC):
    def __init__(self, backend: LLMBackend, model: str) -> None:
        self._backend = backend
        self.model = model

    @abstractmethod
    async def run(self, inp: InputT) -> OutputT: ...

    async def _call_structured(
        self,
        prompt: str,
        output_schema: type[OutputT],
    ) -> OutputT:
        raw = await self._backend.call_structured(
            prompt, output_schema.model_json_schema(), self.model
        )
        return output_schema.model_validate(raw)
