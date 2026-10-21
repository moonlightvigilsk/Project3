from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.document import DocumentSentence as DBSentence
from app.services.grammar_catalog.catalog import (
    GrammarRuleMetadata,
    list_all_rules,
    get_rule_by_id,
)
from app.services.spacy_engine.engine import get_grammar_engine
from app.services.spacy_engine.models import SentenceAnalysis
from app.services.nlp_service import analyze_tokens

router = APIRouter(tags=["Grammar"])


class AnalyzeSentenceRequest(BaseModel):
    sentence: str = Field(..., min_length=1, max_length=2000)


@router.get("/grammar/rules", response_model=List[GrammarRuleMetadata])
def get_all_rules():
    """Retrieve all curated French grammar rules in catalog."""
    return list_all_rules()


@router.get("/grammar/rules/{rule_id}", response_model=GrammarRuleMetadata)
def get_rule_details(rule_id: str):
    """Retrieve metadata and examples for a specific grammar rule."""
    rule = get_rule_by_id(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail=f"Rule '{rule_id}' not found.")
    return rule


@router.get("/grammar/{rule_id}", response_model=GrammarRuleMetadata)
def get_rule_by_id_direct(rule_id: str):
    """Direct rule endpoint: GET /grammar/{id}."""
    # Prevent route conflict with existing sub-paths if any
    if rule_id in ("rules", "analyze", "sentences"):
        raise HTTPException(status_code=404, detail="Resource not found.")
    rule = get_rule_by_id(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail=f"Rule '{rule_id}' not found.")
    return rule


@router.post("/grammar/analyze", response_model=SentenceAnalysis)
def analyze_sentence(payload: AnalyzeSentenceRequest):
    """Analyze a French sentence using spaCy and detect present grammar patterns."""
    engine = get_grammar_engine()
    return engine.analyze_sentence(payload.sentence)


@router.get("/sentences/{sentence_id}/analysis", response_model=SentenceAnalysis)
def get_sentence_analysis(sentence_id: int, db: Session = Depends(get_db)):
    """Endpoint: GET /sentences/{id}/analysis
    
    Returns token breakdown (text, lemma, POS, morph, dep, head) and detected grammar constructs.
    Utilizes caching for tokens.
    """
    sentence = db.query(DBSentence).filter(DBSentence.id == sentence_id).first()
    if not sentence:
        raise HTTPException(status_code=404, detail=f"Sentence with id {sentence_id} not found.")

    engine = get_grammar_engine()
    # Cached token parsing
    tokens = analyze_tokens(sentence.text)
    
    # Run full engine analysis for pattern matches
    analysis = engine.analyze_sentence(sentence.text)
    
    # Replace tokens with cached tokens to ensure consistency
    analysis.tokens = tokens
    return analysis
