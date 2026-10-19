from abc import ABC, abstractmethod
from app.schemas.llm import (
    GrammarEvaluationRequest,
    GrammarEvaluationResult,
    GrammarExplanationRequest,
    GrammarExplanationResult,
)


class LLMProvider(ABC):
    """Abstract interface for LLM backends (OpenAI, Gemini, Ollama, Mock)."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the provider implementation."""
        pass

    @abstractmethod
    async def evaluate_sentence(self, request: GrammarEvaluationRequest) -> GrammarEvaluationResult:
        """Evaluate a learner's sentence against a target grammar rule."""
        pass

    @abstractmethod
    async def explain_grammar_point(self, request: GrammarExplanationRequest) -> GrammarExplanationResult:
        """Provide explicit pedagogical explanation, formula, and conjugation patterns."""
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Verify provider availability."""
        pass
