from skills.base import BaseSkill, ModelConfig

from .prompts import GENERATE_NOTE_PROMPT
from .schemas import GenerateNoteInput, GenerateNoteOutput


class GenerateNoteSkill(BaseSkill):
    @property
    def name(self) -> str:
        return "generate-note"

    @property
    def model_config(self) -> ModelConfig:
        return ModelConfig(model_id="gemma-4", temperature=0.3, max_tokens=2048)

    @property
    def input_schema(self) -> type[GenerateNoteInput]:
        return GenerateNoteInput

    @property
    def output_schema(self) -> type[GenerateNoteOutput]:
        return GenerateNoteOutput

    async def run(self, input_data: GenerateNoteInput) -> GenerateNoteOutput:
        raise NotImplementedError
