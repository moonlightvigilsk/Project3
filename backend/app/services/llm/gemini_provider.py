import json
import logging
from typing import Optional
import httpx
from pydantic import ValidationError

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


class GeminiProvider(LLMClient):
    """Google Gemini API client with strict JSON schema and retry logic."""

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

    async def evaluate_practice_submission(
        self,
        user_sentence: str,
        target_rule_id: str,
        target_rule_name: str,
        rule_check: RuleCheckResult,
    ) -> LLMStructuredEvaluation:
        """Call Gemini to evaluate learner practice submission with up to 2 retries."""
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured.")

        url = f"{self.base_url}/{self.model}:generateContent?key={self.api_key}"

        prompt = (
            "Bạn là giáo viên tiếng Pháp chuyên nghiệp hướng dẫn người học Việt Nam.\n"
            "Hãy đánh giá câu thực hành của học viên dựa trên cấu trúc ngữ pháp mục tiêu và thông tin phân tích cú pháp đã kiểm chứng dưới đây.\n\n"
            f"- Cấu trúc mục tiêu: {target_rule_name} (ID: {target_rule_id})\n"
            f"- Câu của học viên: \"{user_sentence}\"\n"
            f"- Kết quả kiểm tra bằng luật hình thức (spaCy):\n"
            f"  + Khớp mẫu cú pháp (pattern_matched): {rule_check.pattern_matched}\n"
            f"  + Trợ động từ chia đúng với chủ ngữ: {rule_check.auxiliary_correct} (Chủ ngữ: {rule_check.subject_token}, Động từ chia: {rule_check.auxiliary_token})\n"
            f"  + Động từ chính ở dạng nguyên mẫu: {rule_check.main_verb_infinitive} (Động từ: {rule_check.infinitive_token})\n\n"
            "QUAN TRỌNG: Hãy đảm bảo đánh giá của bạn KHÔNG MÂU THUẪN với kết quả kiểm tra bằng luật ở trên.\n"
            "Đầu ra BẮT BUỘC là JSON duy nhất tuân thủ đúng định dạng:\n"
            "{\n"
            '  "is_correct": boolean,\n'
            '  "uses_target_construct": boolean,\n'
            '  "errors": [\n'
            '    {\n'
            '      "span": "từ hoặc cụm từ bị lỗi",\n'
            '      "type": "loại lỗi (conjugation | infinitive | spelling | vocabulary)",\n'
            '      "explanation_vi": "giải thích ngắn gọn bằng tiếng Việt",\n'
            '      "suggestion": "từ hoặc dạng sửa đúng"\n'
            "    }\n"
            "  ],\n"
            '  "corrected_sentence": "câu hoàn chỉnh đã sửa đúng ngữ pháp",\n'
            '  "short_comment": "nhận xét sư phạm ngắn gọn bằng tiếng Việt (1-2 câu)"\n'
            "}"
        )

        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.1,
            },
        }

        last_error = None
        for attempt in range(3):  # initial attempt + up to 2 retries
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(url, json=body)
                    response.raise_for_status()
                    data = response.json()
                    raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(raw_text)
                    return LLMStructuredEvaluation.model_validate(parsed)
            except Exception as e:
                last_error = e
                logger.warning(f"Gemini evaluation attempt {attempt + 1}/3 failed: {e}")

        raise ValueError(f"Gemini validation failed after retries: {last_error}")

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
