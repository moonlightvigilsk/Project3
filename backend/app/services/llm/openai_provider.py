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


class OpenAICompatibleProvider(LLMClient):
    """Client for OpenAI and any OpenAI-compatible API (Groq, Together, DeepSeek, vLLM)."""

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
        return bool(self.api_key)

    async def evaluate_practice_submission(
        self,
        user_sentence: str,
        target_rule_id: str,
        target_rule_name: str,
        rule_check: RuleCheckResult,
    ) -> LLMStructuredEvaluation:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY is not configured.")

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        system_msg = (
            "Bạn là giáo viên tiếng Pháp chuyên nghiệp hướng dẫn học viên Việt Nam. "
            "Hãy đánh giá câu thực hành tiếng Pháp dựa trên cấu trúc ngữ pháp đích và thông tin kiểm tra cú pháp đã cho. "
            "QUAN TRỌNG: Đầu ra BẮT BUỘC là JSON duy nhất, không thêm văn bản ngoài JSON."
        )

        user_msg = (
            f"- Cấu trúc ngữ pháp đích: {target_rule_name} (ID: {target_rule_id})\n"
            f"- Câu của học viên: \"{user_sentence}\"\n"
            f"- Kiểm tra bằng luật (spaCy):\n"
            f"  + Khớp mẫu: {rule_check.pattern_matched}\n"
            f"  + Trợ động từ chia đúng: {rule_check.auxiliary_correct} (Chủ ngữ: {rule_check.subject_token}, Trợ từ: {rule_check.auxiliary_token})\n"
            f"  + Động từ chính nguyên mẫu: {rule_check.main_verb_infinitive} (Động từ: {rule_check.infinitive_token})\n\n"
            "Hãy trả về JSON theo schema:\n"
            "{\n"
            '  "is_correct": boolean,\n'
            '  "uses_target_construct": boolean,\n'
            '  "errors": [{"span": string, "type": string, "explanation_vi": string, "suggestion": string}],\n'
            '  "corrected_sentence": string,\n'
            '  "short_comment": string\n'
            "}"
        )

        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
        }

        last_error = None
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(url, headers=headers, json=body)
                    response.raise_for_status()
                    data = response.json()
                    content = data["choices"][0]["message"]["content"]
                    parsed = json.loads(content)
                    return LLMStructuredEvaluation.model_validate(parsed)
            except Exception as e:
                last_error = e
                logger.warning(f"OpenAI practice evaluation attempt {attempt + 1}/3 failed: {e}")

        raise ValueError(f"OpenAI evaluation failed after retries: {last_error}")

    async def evaluate_sentence(self, request: GrammarEvaluationRequest) -> GrammarEvaluationResult:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY is not configured.")

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        system_prompt = (
            "You are an expert French language pedagogical evaluator. "
            "Always return valid JSON according to the requested schema. "
            "Provide all pedagogical explanations in the student's native language (e.g. Vietnamese 'vi')."
        )

        user_prompt = (
            f"Evaluate this learner's sentence against the target French grammar rule.\n\n"
            f"Target Grammar Rule ID: {request.target_rule_id}\n"
            f"Rule Name: {request.target_rule_name}\n"
            f"Rule Formula: {request.target_rule_formula}\n"
            f"Rule Description: {request.target_rule_description}\n"
            f"Student's Sentence: \"{request.user_sentence}\"\n"
            f"Learner Native Language: {request.learner_native_lang}\n\n"
            "Return JSON matching:\n"
            "{\n"
            '  "is_correct": boolean,\n'
            '  "target_pattern_matched": boolean,\n'
            '  "score": integer 0-100,\n'
            '  "status": "correct" | "minor_issues" | "incorrect",\n'
            '  "corrected_sentence": string,\n'
            '  "error_explanation": string or null,\n'
            '  "positive_feedback": string or null,\n'
            '  "suggested_alternatives": [string, string]\n'
            "}"
        )

        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, headers=headers, json=body)
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            return GrammarEvaluationResult(**parsed)

    async def explain_grammar_point(self, request: GrammarExplanationRequest) -> GrammarExplanationResult:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY is not configured.")

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        user_prompt = (
            f"Explain French grammar rule '{request.rule_name}' (ID: {request.rule_id}) for a Vietnamese speaker.\n"
            f"Context sentence: {request.context_sentence or 'None'}\n"
            "Output JSON conforming to:\n"
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
            "messages": [
                {"role": "system", "content": "You are a French grammar teacher. Return valid JSON."},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, headers=headers, json=body)
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            parsed["rule_id"] = request.rule_id
            return GrammarExplanationResult(**parsed)
