import pytest
from app.core.config import Settings


def test_default_settings():
    settings = Settings()
    assert settings.app_name == "Language Learning Tool"
    assert settings.llm_provider in ["mock", "openai", "gemini", "ollama"]
    assert isinstance(settings.cors_origins, list)
    assert "http://localhost:5173" in settings.cors_origins


def test_cors_origins_parsing():
    settings = Settings(cors_origins="http://example.com, http://test.com")
    assert settings.cors_origins == ["http://example.com", "http://test.com"]

    settings_json = Settings(cors_origins='["http://alpha.com", "http://beta.com"]')
    assert settings_json.cors_origins == ["http://alpha.com", "http://beta.com"]
