from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str
    database_url: str
    youtube_api_key: str
    groq_api_key: str
    anthropic_api_key: str
    assemblyai_api_key: str = ""
    environment: str = "development"
    cors_origins: list[str] = ["http://localhost:3000"]


settings = Settings()
