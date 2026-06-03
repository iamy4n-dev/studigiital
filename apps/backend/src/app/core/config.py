from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    debug: bool = False
    database_url: str = "postgresql+asyncpg://localhost/studigital"
    db_ssl: bool = False
    cors_origins: list[str] = ["http://localhost:3000"]
    aws_region: str = "us-east-1"
    s3_bucket: str = "studigiital-media"
    clerk_secret_key: str = ""
    clerk_publishable_key: str = ""
    # Derived automatically from clerk_publishable_key when left blank.
    clerk_jwks_url: str = ""
    # LLM backend — "anthropic" uses Anthropic SDK directly;
    # "openai_compat" works with Ollama, LM Studio, or any OpenAI-compatible server;
    # "openrouter" routes through OpenRouter via LiteLLM.
    llm_provider: str = "anthropic"
    openrouter_api_key: str = ""
    llm_base_url: str = "http://localhost:11434/v1"  # Ollama default; use :1234 for LM Studio
    llm_api_key: str = "local"  # "local" works for Ollama/LM Studio; set a real key for OpenRouter
    llm_model_infer: str = "claude-haiku-4-5-20251001"
    llm_model_ocr: str = "claude-haiku-4-5-20251001"
    llm_model_free: str = "claude-haiku-4-5-20251001"
    llm_model_paid: str = "claude-sonnet-4-6"


settings = Settings()
