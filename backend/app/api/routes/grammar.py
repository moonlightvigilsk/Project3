from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.grammar_catalog.catalog import (
    GrammarRuleMetadata,
    list_all_rules,
    get_rule_by_id,
)
from app.services.spacy_engine.engine import get_grammar_engine
from app.services.spacy_engine.models import SentenceAnalysis

router = APIRouter(prefix="/grammar", tags=["Grammar"])


class AnalyzeSentenceRequest(BaseModel):
    sentence: str = Field(..., min_length=1, max_length=2000)


@router.get("/rules", response_model=List[GrammarRuleMetadata])
def get_all_rules():
    """Retrieve all curated French grammar rules in catalog."""
    return list_all_rules()


@router.get("/rules/{rule_id}", response_model=GrammarRuleMetadata)
def get_rule_details(rule_id: str):
    """Retrieve metadata and examples for a specific grammar rule."""
    rule = get_rule_by_id(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail=f"Rule '{rule_id}' not found.")
    return rule


@router.post("/analyze", response_model=SentenceAnalysis)
def analyze_sentence(payload: AnalyzeSentenceRequest):
    """Analyze a French sentence using spaCy and detect present grammar patterns."""
    engine = get_grammar_engine()
    return engine.analyze_sentence(payload.sentence)
