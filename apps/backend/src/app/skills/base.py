from __future__ import annotations

import copy
from abc import ABC, abstractmethod
from typing import Any, cast

from pydantic import BaseModel

from app.core.llm import LLMBackend


def _flatten_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Resolve $ref pointers inline so local LLMs receive a flat schema without $defs."""
    schema = copy.deepcopy(schema)
    defs = schema.pop("$defs", {})

    def resolve(node: Any) -> Any:
        if isinstance(node, dict):
            if "$ref" in node:
                name = node["$ref"].rsplit("/", 1)[-1]
                return resolve(copy.deepcopy(defs[name]))
            return {k: resolve(v) for k, v in node.items()}
        if isinstance(node, list):
            return [resolve(item) for item in node]
        return node

    return cast(dict[str, Any], resolve(schema))


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
        schema = _flatten_schema(output_schema.model_json_schema())
        raw = await self._backend.call_structured(prompt, schema, self.model)
        return output_schema.model_validate(raw)
