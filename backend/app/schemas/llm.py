from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.services.spacy_engine.diff import DiffToken


class PracticeErrorDetail(BaseModel):
    """Specific error highlight in user sentence."""
    span: str = Field(..., description="The erroneous substring or word")
    type: str = Field(..., description="Error category, e.g. 'conjugation', 'infinitive', 'spelling'")
    explanation_vi: str = Field(..., description="Explanation in Vietnamese")
    suggestion: str = Field(..., description="Suggested correction for this span")


class LLMStructuredEvaluation(BaseModel):
    """Strict JSON schema required from LLM call."""
    is_correct: bool = Field(..., description="Whether the sentence is grammatically correct and appropriate")
    uses_target_construct: bool = Field(..., description="Whether the sentence uses the target grammar construct")
    errors: List[PracticeErrorDetail] = Field(default_factory=list, description="List of detected errors")
    corrected_sentence: Optional[str] = Field(None, description="Full corrected sentence")
    short_comment: str = Field(..., description="Short pedagogical feedback in Vietnamese")


class RuleCheckResult(BaseModel):
    """Deterministic rule verification result from spaCy."""
    target_rule_id: str
    target_rule_name: str
    pattern_matched: bool
    auxiliary_correct: bool
    main_verb_infinitive: bool
    subject_token: Optional[str] = None
    auxiliary_token: Optional[str] = None
    infinitive_token: Optional[str] = None
    matched_span: Optional[str] = None
    rule_notes: Optional[str] = None


class PracticeSubmitRequest(BaseModel):
    """Payload for POST /practice/submit."""
    user_sentence: str = Field(..., min_length=1, max_length=1000)
    target_rule_id: str = Field(..., min_length=1)
    target_rule_name: Optional[str] = None
    document_id: Optional[int] = None
    document_sentence_id: Optional[int] = None


class PracticeSubmitResponse(BaseModel):
    """Final merged response for POST /practice/submit."""
    is_correct: bool
    uses_target_construct: bool
    score: int = Field(ge=0, le=100)
    status: str = Field(..., description="'correct' | 'minor_issues' | 'incorrect'")
    errors: List[PracticeErrorDetail] = Field(default_factory=list)
    corrected_sentence: Optional[str] = None
    short_comment: str
    diff_tokens: List[DiffToken] = Field(default_factory=list)
    rule_check: RuleCheckResult
    llm_unavailable: bool = False
    created_at: Optional[str] = None


class GrammarEvaluationRequest(BaseModel):
    """Payload for legacy evaluating a learner's production sentence against a target rule."""

    user_sentence: str = Field(..., min_length=1, max_length=1000)
    target_rule_id: str = Field(..., min_length=1)
    target_rule_name: str = Field(..., min_length=1)
    target_rule_description: str = Field(default="")
    target_rule_formula: str = Field(default="")
    example_sentences: List[str] = Field(default_factory=list)
    language: str = Field(default="fr")
    learner_native_lang: str = Field(default="vi")
    document_id: Optional[int] = None
    document_sentence_id: Optional[int] = None


class GrammarEvaluationResult(BaseModel):
    """Structured evaluation result returned by the LLM or Mock provider."""

    is_correct: bool
    target_pattern_matched: bool
    score: int = Field(ge=0, le=100)
    status: str = Field(..., description="'correct' | 'minor_issues' | 'incorrect'")
    corrected_sentence: Optional[str] = None
    error_explanation: Optional[str] = None
    positive_feedback: Optional[str] = None
    suggested_alternatives: List[str] = Field(default_factory=list)
    diff_tokens: List[DiffToken] = Field(default_factory=list)
    spacy_tokens: List[Dict[str, Any]] = Field(default_factory=list)
    rule_id: Optional[str] = None
    rule_name: Optional[str] = None
    user_sentence: Optional[str] = None


class GrammarExplanationRequest(BaseModel):
    """Request to generate or fetch explicit grammar explanation."""

    rule_id: str = Field(..., min_length=1)
    rule_name: str = Field(..., min_length=1)
    language: str = Field(default="fr")
    context_sentence: Optional[str] = None
    learner_native_lang: str = Field(default="vi")


class GrammarExplanationResult(BaseModel):
    """Structured explanation of a grammar concept."""

    rule_id: str
    rule_name: str
    summary: str
    formula: str
    key_rules: List[str]
    common_mistakes: List[str]
    conjugation_or_forms: Dict[str, Any] = Field(default_factory=dict)
    examples: List[str] = Field(default_factory=list)
