from skills.base import BaseSkill, ModelConfig

from .schemas import OcrInput, OcrOutput


class OcrExtractSkill(BaseSkill):
    @property
    def name(self) -> str:
        return "ocr-extract"

    @property
    def model_config(self) -> ModelConfig:
        return ModelConfig(model_id="google-vision-ocr")

    @property
    def input_schema(self) -> type[OcrInput]:
        return OcrInput

    @property
    def output_schema(self) -> type[OcrOutput]:
        return OcrOutput

    async def run(self, input_data: OcrInput) -> OcrOutput:
        raise NotImplementedError
