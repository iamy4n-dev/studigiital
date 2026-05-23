from skills.base import BaseSkill, ModelConfig

from .prompts import GENERATE_QUIZ_PROMPT
from .schemas import GenerateQuizInput, GenerateQuizOutput


class GenerateQuizSkill(BaseSkill):
    @property
    def name(self) -> str:
        return "generate-quiz"

    @property
    def model_config(self) -> ModelConfig:
        return ModelConfig(model_id="gemma-4", temperature=0.3, max_tokens=4096)

    @property
    def input_schema(self) -> type[GenerateQuizInput]:
        return GenerateQuizInput

    @property
    def output_schema(self) -> type[GenerateQuizOutput]:
        return GenerateQuizOutput

    async def run(self, input_data: GenerateQuizInput) -> GenerateQuizOutput:
        raise NotImplementedError
