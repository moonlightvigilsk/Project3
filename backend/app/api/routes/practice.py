import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.config import get_settings, Settings
from app.core.database import get_db
from app.models.practice import PracticeSession
from app.schemas.llm import (
    GrammarEvaluationRequest,
    GrammarEvaluationResult,
    GrammarExplanationRequest,
    GrammarExplanationResult,
)
from app.services.llm.factory import get_llm_provider
from app.services.spacy_engine.engine import get_grammar_engine

router = APIRouter(prefix="/practice", tags=["Practice"])


@router.post("/evaluate", response_model=GrammarEvaluationResult)
async def evaluate_user_sentence(
    request: GrammarEvaluationRequest,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
):
    """Evaluate a user's generated sentence against target grammar rule using spaCy + LLM."""
    spacy_engine = get_grammar_engine()
    spacy_matched, match_info = spacy_engine.check_target_rule(
        request.user_sentence, request.target_rule_id
    )

    provider = get_llm_provider(settings)
    try:
        result = await provider.evaluate_sentence(request)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"LLM Provider evaluation failed: {str(exc)}",
        )

    # Reconcile with spaCy deterministic check if available
    if not spacy_matched and result.is_correct and "futur_proche" in request.target_rule_id:
        # If spaCy found no aller+inf pattern for futur_proche, ensure target_pattern_matched is accurate
        result.target_pattern_matched = False

    # Persist session in database for learner's review
    try:
        session_record = PracticeSession(
            rule_id=request.target_rule_id,
            user_sentence=request.user_sentence,
            is_correct=result.is_correct,
            target_pattern_matched=result.target_pattern_matched,
            score=result.score,
            corrected_sentence=result.corrected_sentence,
            feedback_json=json.dumps(result.model_dump(), ensure_ascii=False),
        )
        db.add(session_record)
        db.commit()
    except Exception:
        db.rollback()

    return result


@router.post("/explain", response_model=GrammarExplanationResult)
async def explain_grammar(
    request: GrammarExplanationRequest,
    settings: Settings = Depends(get_settings),
):
    """Get explicit explanation, formula, and conjugation patterns for a grammar rule."""
    provider = get_llm_provider(settings)
    try:
        return await provider.explain_grammar_point(request)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"LLM Provider explanation failed: {str(exc)}",
        )


@router.get("/history")
async def get_practice_history(
    rule_id: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Retrieve history of learner's sentence productions."""
    query = db.query(PracticeSession)
    if rule_id:
        query = query.filter(PracticeSession.rule_id == rule_id)
    records = query.order_by(desc(PracticeSession.created_at)).limit(limit).all()

    return [
        {
            "id": r.id,
            "rule_id": r.rule_id,
            "user_sentence": r.user_sentence,
            "is_correct": r.is_correct,
            "target_pattern_matched": r.target_pattern_matched,
            "score": r.score,
            "corrected_sentence": r.corrected_sentence,
            "feedback": json.loads(r.feedback_json) if r.feedback_json else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]
