import json
import logging
from typing import Optional
import httpx

from app.services.llm.base import LLMProvider
from app.schemas.llm import (
    GrammarEvaluationRequest,
    GrammarEvaluationResult,
    GrammarExplanationRequest,
    GrammarExplanationResult,
)

logger = logging.getLogger(__name__)


class GeminiProvider(LLMProvider):
    """Google Gemini API provider using generateContent REST API."""

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-1.5-flash",
        timeout: float = 30.0,
    ) -> None:
        self.api_key = api_key.strip()
        self.model = model
        self.timeout = timeout
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"

    @property
    def provider_name(self) -> str:
        return "gemini"

    async def health_check(self) -> bool:
        return bool(self.api_key)

    async def evaluate_sentence(self, request: GrammarEvaluationRequest) -> GrammarEvaluationResult:
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured.")

        url = f"{self.base_url}/{self.model}:generateContent?key={self.api_key}"
        prompt = (
            "You are an expert French language tutor. Evaluate a student's sentence based on whether they correctly "
            "applied the target French grammar rule.\n"
            f"Target Grammar Rule ID: {request.target_rule_id}\n"
            f"Rule Name: {request.target_rule_name}\n"
            f"Formula: {request.target_rule_formula}\n"
            f"Learner Sentence: \"{request.user_sentence}\"\n"
            f"Learner native language: {request.learner_native_lang}\n\n"
            "Return strictly valid JSON matching this schema:\n"
            "{\n"
            '  "is_correct": boolean,\n'
            '  "target_pattern_matched": boolean,\n'
            '  "score": integer between 0 and 100,\n'
            '  "status": "correct" | "minor_issues" | "incorrect",\n'
            '  "corrected_sentence": string or null,\n'
            '  "error_explanation": string or null,\n'
            '  "positive_feedback": string or null,\n'
            '  "suggested_alternatives": array of 1-3 natural French strings\n'
            "}"
        )

        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.2,
            },
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json=body)
            response.raise_for_status()
            data = response.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(raw_text)
            return GrammarEvaluationResult(**parsed)

    async def explain_grammar_point(self, request: GrammarExplanationRequest) -> GrammarExplanationResult:
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured.")

        url = f"{self.base_url}/{self.model}:generateContent?key={self.api_key}"
        prompt = (
            "You are a pedagogical French linguist. Provide a concise, clear grammar explanation.\n"
            f"Rule ID: {request.rule_id}\n"
            f"Rule Name: {request.rule_name}\n"
            f"Context sentence: {request.context_sentence or 'None'}\n"
            f"Learner native language: {request.learner_native_lang}\n\n"
            "Return strictly valid JSON matching this schema:\n"
            "{\n"
            '  "rule_id": string,\n'
            '  "rule_name": string,\n'
            '  "summary": string,\n'
            '  "formula": string,\n'
            '  "key_rules": array of strings,\n'
            '  "common_mistakes": array of strings,\n'
            '  "conjugation_or_forms": object mapping subject/pronoun to form,\n'
            '  "examples": array of strings\n'
            "}"
        )

        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.2,
            },
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json=body)
            response.raise_for_status()
            data = response.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(raw_text)
            parsed["rule_id"] = request.rule_id
            return GrammarExplanationResult(**parsed)
