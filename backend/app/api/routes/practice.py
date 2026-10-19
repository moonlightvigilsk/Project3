import json
from typing import List, Optional, Dict, Any
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
from app.services.spacy_engine.diff import compute_sentence_diff

router = APIRouter(prefix="/practice", tags=["Practice"])


@router.post("/evaluate", response_model=GrammarEvaluationResult)
async def evaluate_user_sentence(
    request: GrammarEvaluationRequest,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
):
    """Evaluate a user's generated sentence against target grammar rule using spaCy + LLM."""
    spacy_engine = get_grammar_engine()
    analysis = spacy_engine.analyze_sentence(request.user_sentence)
    spacy_matched = request.target_rule_id.lower().strip() in analysis.matched_rule_ids

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
        result.target_pattern_matched = False

    # Attach computed diff tokens if not already provided by provider
    if not result.diff_tokens:
        result.diff_tokens = compute_sentence_diff(
            request.user_sentence, result.corrected_sentence
        )

    # Attach linguistic token breakdown for frontend educational inspection
    result.spacy_tokens = [
        {
            "index": t.index,
            "text": t.text,
            "lemma": t.lemma,
            "pos": t.pos,
            "dep": t.dep,
            "morph": t.morph,
        }
        for t in analysis.tokens
    ]
    result.rule_id = request.target_rule_id
    result.rule_name = request.target_rule_name
    result.user_sentence = request.user_sentence

    # Persist session in database for learner's review
    try:
        session_record = PracticeSession(
            rule_id=request.target_rule_id,
            document_id=request.document_id,
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
    document_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Retrieve history of learner's sentence productions."""
    query = db.query(PracticeSession)
    if rule_id:
        query = query.filter(PracticeSession.rule_id == rule_id)
    if document_id is not None:
        query = query.filter(PracticeSession.document_id == document_id)

    records = query.order_by(desc(PracticeSession.created_at)).limit(limit).all()

    return [
        {
            "id": r.id,
            "rule_id": r.rule_id,
            "document_id": r.document_id,
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


@router.get("/stats")
async def get_practice_stats(
    db: Session = Depends(get_db),
):
    """Calculate aggregate learning statistics and rule-level mastery."""
    records = db.query(PracticeSession).all()

    total_attempts = len(records)
    if total_attempts == 0:
        return {
            "total_attempts": 0,
            "correct_attempts": 0,
            "accuracy_rate": 0.0,
            "average_score": 0.0,
            "rules_breakdown": {},
        }

    correct_attempts = sum(1 for r in records if r.is_correct)
    total_score = sum(r.score for r in records)
    accuracy_rate = round((correct_attempts / total_attempts) * 100, 1)
    average_score = round(total_score / total_attempts, 1)

    rules_map: Dict[str, Dict[str, Any]] = {}
    for r in records:
        rid = r.rule_id
        if rid not in rules_map:
            rules_map[rid] = {"attempts": 0, "correct": 0, "total_score": 0}
        rules_map[rid]["attempts"] += 1
        if r.is_correct:
            rules_map[rid]["correct"] += 1
        rules_map[rid]["total_score"] += r.score

    breakdown = {}
    for rid, data in rules_map.items():
        att = data["attempts"]
        breakdown[rid] = {
            "attempts": att,
            "correct": data["correct"],
            "accuracy_rate": round((data["correct"] / att) * 100, 1),
            "average_score": round(data["total_score"] / att, 1),
        }

    return {
        "total_attempts": total_attempts,
        "correct_attempts": correct_attempts,
        "accuracy_rate": accuracy_rate,
        "average_score": average_score,
        "rules_breakdown": breakdown,
    }
