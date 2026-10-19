from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.services.spacy_engine.diff import DiffToken


class GrammarEvaluationRequest(BaseModel):
    """Payload for evaluating a learner's production sentence against a target rule."""

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
