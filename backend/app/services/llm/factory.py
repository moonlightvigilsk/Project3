from typing import Optional
from app.core.config import Settings, get_settings
from app.services.llm.base import LLMClient
from app.services.llm.mock_provider import MockLLMProvider
from app.services.llm.openai_provider import OpenAICompatibleProvider
from app.services.llm.gemini_provider import GeminiProvider
from app.services.llm.ollama_provider import OllamaProvider


def get_llm_provider(settings: Optional[Settings] = None) -> LLMClient:
    """Factory function returning the configured LLMClient instance."""
    if settings is None:
        settings = get_settings()

    provider_type = settings.llm_provider.lower().strip()

    if provider_type == "openai":
        return OpenAICompatibleProvider(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            model=settings.openai_model,
        )
    elif provider_type == "gemini":
        return GeminiProvider(
            api_key=settings.gemini_api_key,
            model=settings.gemini_model,
        )
    elif provider_type == "ollama":
        base_url = settings.ollama_base_url.rstrip("/")
        if not base_url.endswith("/v1"):
            base_url = f"{base_url}/v1"
        return OllamaProvider(
            base_url=base_url,
            model=settings.ollama_model,
        )
    else:
        # Default fallback is MockLLMProvider for offline safety & tests
        return MockLLMProvider()
