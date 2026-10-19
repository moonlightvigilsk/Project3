from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class TokenAnalysis(BaseModel):
    """Linguistic properties for a single token."""

    index: int
    text: str
    lemma: str
    pos: str
    dep: str
    morph: Dict[str, str] = Field(default_factory=dict)
    head_text: str
    is_stop: bool


class PatternMatchResult(BaseModel):
    """Details of a grammar rule match within a sentence."""

    rule_id: str
    rule_name: str
    matched_text: str
    start_char: int
    end_char: int
    matched_token_indices: List[int]
    confidence: float = 1.0
    notes: Optional[str] = None


class SentenceAnalysis(BaseModel):
    """Complete linguistic and grammar pattern analysis of a sentence."""

    text: str
    tokens: List[TokenAnalysis]
    matches: List[PatternMatchResult]
    matched_rule_ids: List[str]
