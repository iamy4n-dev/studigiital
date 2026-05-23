from skills.base import BaseSkill, ModelConfig

from .prompts import INFER_FORMAT_PROMPT
from .schemas import InferFormatInput, InferFormatOutput


class InferFormatSkill(BaseSkill):
    @property
    def name(self) -> str:
        return "infer-format"

    @property
    def model_config(self) -> ModelConfig:
        return ModelConfig(model_id="gemma-4-flash", temperature=0.0, max_tokens=256)

    @property
    def input_schema(self) -> type[InferFormatInput]:
        return InferFormatInput

    @property
    def output_schema(self) -> type[InferFormatOutput]:
        return InferFormatOutput

    async def run(self, input_data: InferFormatInput) -> InferFormatOutput:
        raise NotImplementedError
