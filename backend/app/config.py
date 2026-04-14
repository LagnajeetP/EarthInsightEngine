from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:///./data/app.db"
    data_dir: Path = Path("./data")
    uploads_dir: Path = Path("./data/uploads")


@lru_cache
def get_settings() -> Settings:
    return Settings()
