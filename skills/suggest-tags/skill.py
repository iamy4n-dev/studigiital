from skills.base import BaseSkill, ModelConfig

from .prompts import SUGGEST_TAGS_PROMPT
from .schemas import SuggestTagsInput, SuggestTagsOutput


class SuggestTagsSkill(BaseSkill):
    @property
    def name(self) -> str:
        return "suggest-tags"

    @property
    def model_config(self) -> ModelConfig:
        return ModelConfig(model_id="gemma-4-flash", temperature=0.2, max_tokens=128)

    @property
    def input_schema(self) -> type[SuggestTagsInput]:
        return SuggestTagsInput

    @property
    def output_schema(self) -> type[SuggestTagsOutput]:
        return SuggestTagsOutput

    async def run(self, input_data: SuggestTagsInput) -> SuggestTagsOutput:
        raise NotImplementedError
