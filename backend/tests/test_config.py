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


def test_extension_origins_allowed_by_regex():
    import re
    settings = Settings()
    assert re.fullmatch(settings.cors_origin_regex, "chrome-extension://abcdefghijklmnopabcdefghijklmnop")
    assert re.fullmatch(settings.cors_origin_regex, "moz-extension://1b2c3d4e-0000-4000-8000-123456789abc")
    assert not re.fullmatch(settings.cors_origin_regex, "https://evil.example")
