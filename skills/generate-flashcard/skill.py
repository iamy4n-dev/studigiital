from skills.base import BaseSkill, ModelConfig

from .prompts import GENERATE_FLASHCARD_PROMPT
from .schemas import GenerateFlashcardInput, GenerateFlashcardOutput


class GenerateFlashcardSkill(BaseSkill):
    @property
    def name(self) -> str:
        return "generate-flashcard"

    @property
    def model_config(self) -> ModelConfig:
        return ModelConfig(model_id="gemma-4", temperature=0.2, max_tokens=1024)

    @property
    def input_schema(self) -> type[GenerateFlashcardInput]:
        return GenerateFlashcardInput

    @property
    def output_schema(self) -> type[GenerateFlashcardOutput]:
        return GenerateFlashcardOutput

    async def run(self, input_data: GenerateFlashcardInput) -> GenerateFlashcardOutput:
        raise NotImplementedError
