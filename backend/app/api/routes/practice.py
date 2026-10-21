import json
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.config import get_settings, Settings
from app.core.database import get_db
from app.models.practice import PracticeSession
from app.schemas.llm import (
    PracticeSubmitRequest,
    PracticeSubmitResponse,
    PracticeErrorDetail,
    GrammarEvaluationRequest,
    GrammarEvaluationResult,
    GrammarExplanationRequest,
    GrammarExplanationResult,
)
from app.services.llm.factory import get_llm_provider
from app.services.practice_rule_verifier import verify_sentence_by_rules
from app.services.spacy_engine.engine import get_grammar_engine
from app.services.spacy_engine.diff import compute_sentence_diff
from app.services.grammar_catalog.catalog import get_rule_by_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/practice", tags=["Practice"])


@router.post("/submit", response_model=PracticeSubmitResponse)
async def submit_practice_sentence(
    request: PracticeSubmitRequest,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
):
    """Grading pipeline for active practice:
    a. Formal check: DependencyMatcher, auxiliary agreement with subject, main verb infinitive.
    b. Call LLM via abstract LLMClient with prompt containing (a) results. Validate JSON, retry <= 2.
       If LLM fails, return rule check results with 'llm_unavailable' = True.
    c. Merge results: Rule check wins on verifiable grammar points.
    d. Persist session to SQLite.
    """
    rule_meta = get_rule_by_id(request.target_rule_id)
    rule_name = request.target_rule_name or (rule_meta.name if rule_meta else request.target_rule_id)

    # Step (a): Deterministic rule checking with spaCy fr_core_news_md
    rule_check = verify_sentence_by_rules(request.user_sentence, request.target_rule_id)

    # Step (b): Call LLM Client
    provider = get_llm_provider(settings)
    llm_unavailable = False
    llm_res = None

    try:
        llm_res = await provider.evaluate_practice_submission(
            user_sentence=request.user_sentence,
            target_rule_id=request.target_rule_id,
            target_rule_name=rule_name,
            rule_check=rule_check,
        )
    except Exception as exc:
        logger.warning(f"LLM call failed after retries: {exc}. Falling back to rule-based evaluation.")
        llm_unavailable = True

    # Step (c): Merge results - Formal rules WIN when there is a contradiction on verifiable points
    if llm_unavailable or llm_res is None:
        # Fallback to pure rule-based evaluation
        is_correct = rule_check.pattern_matched and rule_check.auxiliary_correct and rule_check.main_verb_infinitive
        uses_construct = rule_check.pattern_matched
        errors: List[PracticeErrorDetail] = []

        if not rule_check.auxiliary_correct and rule_check.auxiliary_token:
            errors.append(
                PracticeErrorDetail(
                    span=rule_check.auxiliary_token,
                    type="conjugation",
                    explanation_vi=f"Động từ phụ chia chưa chuẩn với chủ ngữ '{rule_check.subject_token or ''}'.",
                    suggestion="Cần chia đúng ngôi theo chủ ngữ",
                )
            )

        if not rule_check.main_verb_infinitive and rule_check.auxiliary_token:
            errors.append(
                PracticeErrorDetail(
                    span=rule_check.infinitive_token or request.user_sentence,
                    type="infinitive",
                    explanation_vi="Động từ chính theo sau phải giữ ở dạng nguyên mẫu (infinitif).",
                    suggestion="Dùng dạng nguyên mẫu (ví dụ: manger, partir)",
                )
            )

        if not rule_check.pattern_matched:
            errors.append(
                PracticeErrorDetail(
                    span=request.user_sentence,
                    type="missing_construct",
                    explanation_vi="Câu chưa khớp cấu trúc ngữ pháp mục tiêu.",
                    suggestion=rule_meta.formula if rule_meta else "Tuân thủ cấu trúc",
                )
            )

        score = 100 if is_correct else (60 if (rule_check.auxiliary_correct or rule_check.main_verb_infinitive) else 30)
        status = "correct" if is_correct else ("minor_issues" if (rule_check.pattern_matched or rule_check.auxiliary_correct) else "incorrect")
        corrected_sentence = request.user_sentence if is_correct else None
        short_comment = "Đánh giá bởi bộ luật hình thức (LLM hiện không khả dụng)."
    else:
        # Reconcile LLM with verified formal rules:
        # Rule check WINS on verifiable points:
        # If rule says auxiliary agreement failed or infinitive failed -> is_correct cannot be True
        rules_failed = (not rule_check.auxiliary_correct) or (not rule_check.main_verb_infinitive) or (not rule_check.pattern_matched)

        if rules_failed:
            is_correct = False
            uses_construct = rule_check.pattern_matched
        else:
            is_correct = llm_res.is_correct
            uses_construct = llm_res.uses_target_construct and rule_check.pattern_matched

        errors = llm_res.errors
        # Ensure errors list has conjugation error if rule check detected it
        if not rule_check.auxiliary_correct and rule_check.auxiliary_token:
            if not any(e.type == "conjugation" for e in errors):
                errors.insert(
                    0,
                    PracticeErrorDetail(
                        span=rule_check.auxiliary_token,
                        type="conjugation",
                        explanation_vi=f"Động từ '{rule_check.auxiliary_token}' chưa hòa hợp với chủ ngữ '{rule_check.subject_token or ''}'.",
                        suggestion="Chia lại đúng ngôi",
                    ),
                )

        corrected_sentence = llm_res.corrected_sentence or (request.user_sentence if is_correct else None)
        short_comment = llm_res.short_comment

        if is_correct:
            status = "correct"
            score = 100
        elif uses_construct or len(errors) == 1:
            status = "minor_issues"
            score = 70
        else:
            status = "incorrect"
            score = 40

    diff_tokens = compute_sentence_diff(request.user_sentence, corrected_sentence)
    created_at_str = datetime.now(timezone.utc).isoformat()

    response_payload = PracticeSubmitResponse(
        is_correct=is_correct,
        uses_target_construct=uses_construct,
        score=score,
        status=status,
        errors=errors,
        corrected_sentence=corrected_sentence,
        short_comment=short_comment,
        diff_tokens=diff_tokens,
        rule_check=rule_check,
        llm_unavailable=llm_unavailable,
        created_at=created_at_str,
    )

    # Step (d): Persist every practice attempt into SQLite
    try:
        session_record = PracticeSession(
            rule_id=request.target_rule_id,
            document_id=request.document_id,
            user_sentence=request.user_sentence,
            is_correct=is_correct,
            target_pattern_matched=uses_construct,
            score=score,
            corrected_sentence=corrected_sentence,
            feedback_json=json.dumps(response_payload.model_dump(), ensure_ascii=False),
            created_at=datetime.now(timezone.utc),
        )
        db.add(session_record)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to record practice session in DB: {e}")
        db.rollback()

    return response_payload


@router.post("/evaluate", response_model=GrammarEvaluationResult)
async def evaluate_user_sentence(
    request: GrammarEvaluationRequest,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
):
    """Legacy endpoint for backward compatibility."""
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

    if not spacy_matched and result.is_correct and "futur_proche" in request.target_rule_id:
        result.target_pattern_matched = False

    if not result.diff_tokens:
        result.diff_tokens = compute_sentence_diff(
            request.user_sentence, result.corrected_sentence
        )

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
