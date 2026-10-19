from app.services.llm.openai_provider import OpenAICompatibleProvider


class OllamaProvider(OpenAICompatibleProvider):
    """Local Ollama LLM provider running via Ollama's OpenAI-compatible v1 API."""

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "llama3",
        timeout: float = 60.0,
    ) -> None:
        clean_base = base_url.rstrip("/")
        if not clean_base.endswith("/v1"):
            clean_base = f"{clean_base}/v1"
        super().__init__(
            api_key="ollama",  # Ollama does not require key, but v1 client handles a dummy token
            base_url=clean_base,
            model=model,
            timeout=timeout,
        )

    @property
    def provider_name(self) -> str:
        return "ollama"
