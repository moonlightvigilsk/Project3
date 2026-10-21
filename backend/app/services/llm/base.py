from abc import ABC, abstractmethod
from typing import Optional
from app.schemas.llm import (
    GrammarEvaluationRequest,
    GrammarEvaluationResult,
    GrammarExplanationRequest,
    GrammarExplanationResult,
    LLMStructuredEvaluation,
    RuleCheckResult,
)


class LLMClient(ABC):
    """Abstract interface for LLM clients used in the pedagogical grading pipeline."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the provider implementation."""
        pass

    @abstractmethod
    async def evaluate_practice_submission(
        self,
        user_sentence: str,
        target_rule_id: str,
        target_rule_name: str,
        rule_check: RuleCheckResult,
    ) -> LLMStructuredEvaluation:
        """Evaluate learner submission with strict JSON output matching LLMStructuredEvaluation.
        
        Must incorporate deterministic rule check results into prompt to prevent hallucination.
        Retries up to 2 times upon JSON parsing/validation failure.
        """
        pass

    @abstractmethod
    async def evaluate_sentence(self, request: GrammarEvaluationRequest) -> GrammarEvaluationResult:
        """Legacy sentence evaluation."""
        pass

    @abstractmethod
    async def explain_grammar_point(self, request: GrammarExplanationRequest) -> GrammarExplanationResult:
        """Provide explicit pedagogical explanation, formula, and conjugation patterns."""
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Verify provider availability."""
        pass


# Backward compatibility alias
LLMProvider = LLMClient
