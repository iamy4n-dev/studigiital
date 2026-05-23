from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel


class ModelConfig(BaseModel):
    model_id: str
    temperature: float = 0.0
    max_tokens: int = 1024


class BaseSkill(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...

    @property
    @abstractmethod
    def model_config(self) -> ModelConfig: ...

    @property
    @abstractmethod
    def input_schema(self) -> type[BaseModel]: ...

    @property
    @abstractmethod
    def output_schema(self) -> type[BaseModel]: ...

    @abstractmethod
    async def run(self, input_data: Any) -> Any: ...
