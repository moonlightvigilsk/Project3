import json
import logging
from typing import Optional
import httpx

from app.services.llm.base import LLMClient
from app.schemas.llm import (
    GrammarEvaluationRequest,
    GrammarEvaluationResult,
    GrammarExplanationRequest,
    GrammarExplanationResult,
    LLMStructuredEvaluation,
    RuleCheckResult,
)

logger = logging.getLogger(__name__)


class OllamaProvider(LLMClient):
    """Local Ollama instance provider for private and offline AI inference."""

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "llama3",
        timeout: float = 60.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    @property
    def provider_name(self) -> str:
        return "ollama"

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                return res.status_code == 200
        except Exception:
            return False

    async def evaluate_practice_submission(
        self,
        user_sentence: str,
        target_rule_id: str,
        target_rule_name: str,
        rule_check: RuleCheckResult,
    ) -> LLMStructuredEvaluation:
        url = f"{self.base_url}/api/generate"
        prompt = (
            "Bạn là giáo viên tiếng Pháp cho người Việt. Đánh giá câu thực hành:\n"
            f"- Cấu trúc đích: {target_rule_name} (ID: {target_rule_id})\n"
            f"- Câu: \"{user_sentence}\"\n"
            f"- Kiểm tra cú pháp: pattern={rule_check.pattern_matched}, aux_ok={rule_check.auxiliary_correct}, inf_ok={rule_check.main_verb_infinitive}\n\n"
            "Trả về JSON:\n"
            "{\"is_correct\": bool, \"uses_target_construct\": bool, \"errors\": [], \"corrected_sentence\": string, \"short_comment\": string}"
        )
        body = {
            "model": self.model,
            "prompt": prompt,
            "format": "json",
            "stream": False,
        }

        last_error = None
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(url, json=body)
                    response.raise_for_status()
                    data = response.json()
                    content = data.get("response", "{}")
                    parsed = json.loads(content)
                    return LLMStructuredEvaluation.model_validate(parsed)
            except Exception as e:
                last_error = e
                logger.warning(f"Ollama attempt {attempt + 1}/3 failed: {e}")

        raise ValueError(f"Ollama evaluation failed: {last_error}")

    async def evaluate_sentence(self, request: GrammarEvaluationRequest) -> GrammarEvaluationResult:
        url = f"{self.base_url}/api/generate"
        prompt = (
            f"Evaluate this French sentence: \"{request.user_sentence}\" for rule: {request.target_rule_name}.\n"
            "Return JSON matching:\n"
            "{\n"
            '  "is_correct": boolean,\n'
            '  "target_pattern_matched": boolean,\n'
            '  "score": integer 0-100,\n'
            '  "status": "correct" | "minor_issues" | "incorrect",\n'
            '  "corrected_sentence": string,\n'
            '  "error_explanation": string,\n'
            '  "positive_feedback": string,\n'
            '  "suggested_alternatives": [string]\n'
            "}"
        )
        body = {
            "model": self.model,
            "prompt": prompt,
            "format": "json",
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json=body)
            response.raise_for_status()
            data = response.json()
            parsed = json.loads(data.get("response", "{}"))
            return GrammarEvaluationResult(**parsed)

    async def explain_grammar_point(self, request: GrammarExplanationRequest) -> GrammarExplanationResult:
        url = f"{self.base_url}/api/generate"
        prompt = (
            f"Explain French grammar rule: {request.rule_name} (ID: {request.rule_id}) for Vietnamese learner.\n"
            "Return JSON conforming to:\n"
            "{\n"
            '  "rule_id": string,\n'
            '  "rule_name": string,\n'
            '  "summary": string,\n'
            '  "formula": string,\n'
            '  "key_rules": [string],\n'
            '  "common_mistakes": [string],\n'
            '  "conjugation_or_forms": object,\n'
            '  "examples": [string]\n'
            "}"
        )
        body = {
            "model": self.model,
            "prompt": prompt,
            "format": "json",
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json=body)
            response.raise_for_status()
            data = response.json()
            parsed = json.loads(data.get("response", "{}"))
            parsed["rule_id"] = request.rule_id
            return GrammarExplanationResult(**parsed)
