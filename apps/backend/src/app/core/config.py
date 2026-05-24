from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    debug: bool = False
    database_url: str = "postgresql+asyncpg://localhost/studigital"
    cors_origins: list[str] = ["http://localhost:3000"]
    aws_region: str = "us-east-1"
    s3_bucket: str = "studigiital-media"
    clerk_secret_key: str = ""
    clerk_jwks_url: str = "https://api.clerk.com/v1/jwks"
    dev_mode: bool = False


settings = Settings()
