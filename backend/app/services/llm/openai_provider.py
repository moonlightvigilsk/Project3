import json
import logging
from typing import Optional, Dict, Any
import httpx

from app.services.llm.base import LLMProvider
from app.schemas.llm import (
    GrammarEvaluationRequest,
    GrammarEvaluationResult,
    GrammarExplanationRequest,
    GrammarExplanationResult,
)

logger = logging.getLogger(__name__)


class OpenAICompatibleProvider(LLMProvider):
    """Provider for OpenAI and OpenAI-compatible APIs (Groq, DeepSeek, Ollama v1, etc.)."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.openai.com/v1",
        model: str = "gpt-4o-mini",
        timeout: float = 30.0,
    ) -> None:
        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    @property
    def provider_name(self) -> str:
        return "openai"

    async def health_check(self) -> bool:
        if not self.api_key and "localhost" not in self.base_url and "127.0.0.1" not in self.base_url:
            return False
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
                response = await client.get(f"{self.base_url}/models", headers=headers)
                return response.status_code in (200, 401)  # 401 means server is reachable
        except Exception:
            return False

    async def evaluate_sentence(self, request: GrammarEvaluationRequest) -> GrammarEvaluationResult:
        system_prompt = (
            "You are an expert French language tutor. Evaluate a student's sentence based on whether they correctly "
            "applied the target French grammar rule.\n"
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
            "}\n"
            f"Write the explanation in Vietnamese if learner_native_lang is 'vi', or in French/English otherwise."
        )

        user_content = (
            f"Target Grammar Rule ID: {request.target_rule_id}\n"
            f"Rule Name: {request.target_rule_name}\n"
            f"Formula/Pattern: {request.target_rule_formula}\n"
            f"Learner Sentence: \"{request.user_sentence}\"\n"
            f"Learner native language: {request.learner_native_lang}\n"
        )

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }

        headers = {
            "Content-Type": "application/json",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            return GrammarEvaluationResult(**parsed)

    async def explain_grammar_point(self, request: GrammarExplanationRequest) -> GrammarExplanationResult:
        system_prompt = (
            "You are a pedagogical French linguist. Provide a concise, clear grammar explanation.\n"
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

        user_content = (
            f"Rule ID: {request.rule_id}\n"
            f"Rule Name: {request.rule_name}\n"
            f"Context sentence from document: {request.context_sentence or 'None'}\n"
            f"Learner native language: {request.learner_native_lang}\n"
        )

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            parsed["rule_id"] = request.rule_id
            return GrammarExplanationResult(**parsed)
