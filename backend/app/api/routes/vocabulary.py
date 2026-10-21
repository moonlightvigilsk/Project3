import csv
import io
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.vocabulary import VocabularyItem
from app.models.document import Document
from app.services.spacy_engine.loader import get_nlp
from app.services.dictionary_service import lookup_definition

router = APIRouter(prefix="/vocabulary", tags=["Vocabulary"])


class WordLookupRequest(BaseModel):
    word: str = Field(..., min_length=1, max_length=100)
    context_sentence: Optional[str] = None
    document_id: Optional[int] = None


class WordLookupResponse(BaseModel):
    word: str
    lemma: str
    pos: str
    definition: Optional[str] = None
    definition_vi: Optional[str] = None
    context_sentence: Optional[str] = None
    status: str = "new"  # "new" | "learning" | "known"
    occurrences: int = 1
    document_id: Optional[int] = None
    source: str = "wiktionary"


class VocabularyItemResponse(BaseModel):
    id: int
    lemma: str
    surface_form: Optional[str] = None
    pos: Optional[str] = None
    definition: Optional[str] = None
    definition_vi: Optional[str] = None
    status: str
    occurrences: int
    context_sentence: Optional[str] = None
    document_id: Optional[int] = None
    document_title: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class UpdateStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(new|learning|known)$")


class CreateOrUpdateVocabRequest(BaseModel):
    lemma: str = Field(..., min_length=1)
    surface_form: Optional[str] = None
    pos: Optional[str] = None
    definition: Optional[str] = None
    definition_vi: Optional[str] = None
    status: str = Field(default="new", pattern="^(new|learning|known)$")
    context_sentence: Optional[str] = None
    document_id: Optional[int] = None


@router.post("/lookup", response_model=WordLookupResponse)
async def lookup_word(
    payload: WordLookupRequest,
    db: Session = Depends(get_db),
):
    """Lemmatize word with spaCy fr_core_news_md, fetch definition (cached Wiktionary/local),
    and check/update vocabulary status in database.
    """
    raw_word = payload.word.strip(" ,.;:!?\"'«»()[]{}").strip()
    if not raw_word:
        raise HTTPException(status_code=400, detail="Empty word.")

    # 1. Lemmatize and tag with spaCy
    nlp = get_nlp()
    doc = nlp(raw_word)
    token = doc[0] if len(doc) > 0 else None
    lemma = token.lemma_.lower() if token else raw_word.lower()
    pos = token.pos_ if token else "NOUN"

    # 2. Lookup definition
    def_data = await lookup_definition(word=raw_word, lemma=lemma, pos=pos)

    # 3. Check existing item in database
    query = db.query(VocabularyItem).filter(VocabularyItem.lemma == lemma)
    if payload.document_id:
        query = query.filter(VocabularyItem.document_id == payload.document_id)
    existing = query.first()

    status = "new"
    occurrences = 1

    if existing:
        status = existing.status
        existing.occurrences += 1
        occurrences = existing.occurrences
        if payload.context_sentence and not existing.context_sentence:
            existing.context_sentence = payload.context_sentence
        db.commit()
    else:
        # Create new record in vocabulary
        item = VocabularyItem(
            lemma=lemma,
            surface_form=raw_word,
            pos=pos,
            definition=def_data.get("definition"),
            definition_vi=def_data.get("definition_vi"),
            definition_source=def_data.get("source", "wiktionary"),
            status="new",
            occurrences=1,
            context_sentence=payload.context_sentence,
            document_id=payload.document_id,
        )
        db.add(item)
        try:
            db.commit()
        except Exception:
            db.rollback()

    return WordLookupResponse(
        word=raw_word,
        lemma=lemma,
        pos=pos,
        definition=def_data.get("definition"),
        definition_vi=def_data.get("definition_vi"),
        context_sentence=payload.context_sentence,
        status=status,
        occurrences=occurrences,
        document_id=payload.document_id,
        source=def_data.get("source", "wiktionary"),
    )


@router.get("", response_model=List[VocabularyItemResponse])
def list_vocabulary(
    status: Optional[str] = Query(None, pattern="^(new|learning|known)$"),
    document_id: Optional[int] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """List vocabulary items with filtering by status and document."""
    query = db.query(VocabularyItem)

    if status:
        query = query.filter(VocabularyItem.status == status)
    if document_id is not None:
        query = query.filter(VocabularyItem.document_id == document_id)
    if search:
        query = query.filter(VocabularyItem.lemma.contains(search.lower()))

    items = query.order_by(desc(VocabularyItem.updated_at)).offset(offset).limit(limit).all()

    # Prefetch document titles
    doc_ids = {it.document_id for it in items if it.document_id}
    docs_map = {}
    if doc_ids:
        docs = db.query(Document).filter(Document.id.in_(doc_ids)).all()
        docs_map = {d.id: d.title for d in docs}

    return [
        VocabularyItemResponse(
            id=it.id,
            lemma=it.lemma,
            surface_form=it.surface_form,
            pos=it.pos,
            definition=it.definition,
            definition_vi=it.definition_vi,
            status=it.status,
            occurrences=it.occurrences,
            context_sentence=it.context_sentence,
            document_id=it.document_id,
            document_title=docs_map.get(it.document_id),
            created_at=it.created_at.isoformat() if it.created_at else None,
            updated_at=it.updated_at.isoformat() if it.updated_at else None,
        )
        for it in items
    ]


@router.patch("/{vocab_id}/status", response_model=VocabularyItemResponse)
def update_vocabulary_status(
    vocab_id: int,
    payload: UpdateStatusRequest,
    db: Session = Depends(get_db),
):
    """Update status of a vocabulary lemma (new -> learning -> known)."""
    item = db.query(VocabularyItem).filter(VocabularyItem.id == vocab_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Vocabulary item not found.")

    item.status = payload.status
    item.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)

    doc_title = item.document.title if item.document else None
    return VocabularyItemResponse(
        id=item.id,
        lemma=item.lemma,
        surface_form=item.surface_form,
        pos=item.pos,
        definition=item.definition,
        definition_vi=item.definition_vi,
        status=item.status,
        occurrences=item.occurrences,
        context_sentence=item.context_sentence,
        document_id=item.document_id,
        document_title=doc_title,
        created_at=item.created_at.isoformat() if item.created_at else None,
        updated_at=item.updated_at.isoformat() if item.updated_at else None,
    )


@router.patch("/lemma/{lemma}/status", response_model=VocabularyItemResponse)
def update_status_by_lemma(
    lemma: str,
    payload: UpdateStatusRequest,
    db: Session = Depends(get_db),
):
    """Update or upsert status for all instances of a lemma."""
    clean_lemma = lemma.strip().lower()
    items = db.query(VocabularyItem).filter(VocabularyItem.lemma == clean_lemma).all()

    if not items:
        # Create brand new item if not exists
        item = VocabularyItem(
            lemma=clean_lemma,
            status=payload.status,
            occurrences=1,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        items = [item]
    else:
        for it in items:
            it.status = payload.status
            it.updated_at = datetime.now(timezone.utc)
        db.commit()
        item = items[0]

    return VocabularyItemResponse(
        id=item.id,
        lemma=item.lemma,
        surface_form=item.surface_form,
        pos=item.pos,
        definition=item.definition,
        definition_vi=item.definition_vi,
        status=item.status,
        occurrences=item.occurrences,
        context_sentence=item.context_sentence,
        document_id=item.document_id,
        created_at=item.created_at.isoformat() if item.created_at else None,
        updated_at=item.updated_at.isoformat() if item.updated_at else None,
    )


@router.get("/export/csv")
def export_vocabulary_csv(
    status: Optional[str] = Query(None, pattern="^(new|learning|known)$"),
    document_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Export vocabulary items to downloadable CSV file."""
    query = db.query(VocabularyItem)
    if status:
        query = query.filter(VocabularyItem.status == status)
    if document_id is not None:
        query = query.filter(VocabularyItem.document_id == document_id)

    items = query.order_by(desc(VocabularyItem.occurrences)).all()

    # Generate CSV stream
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_ALL)
    writer.writerow(["Lemma", "Từ gốc", "Loại từ (POS)", "Trạng thái", "Số lần gặp", "Nghĩa tiếng Pháp", "Nghĩa tiếng Việt", "Câu ngữ cảnh", "Ngày thêm"])

    for it in items:
        writer.writerow([
            it.lemma,
            it.surface_form or "",
            it.pos or "",
            it.status,
            it.occurrences,
            it.definition or "",
            it.definition_vi or "",
            it.context_sentence or "",
            it.created_at.strftime("%Y-%m-%d %H:%M") if it.created_at else "",
        ])

    csv_data = output.getvalue()
    filename = f"vocab_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "text/csv; charset=utf-8",
        },
    )


@router.get("/status-map")
def get_vocabulary_status_map(
    document_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Get lemma -> status mapping dictionary for instant frontend reader highlighting."""
    query = db.query(VocabularyItem.lemma, VocabularyItem.status)
    if document_id is not None:
        query = query.filter(VocabularyItem.document_id == document_id)

    pairs = query.all()
    # If lemma has multiple records, pick the most advanced status (known > learning > new)
    status_priority = {"new": 1, "learning": 2, "known": 3}
    result: Dict[str, str] = {}
    for lemma, st in pairs:
        current = result.get(lemma)
        if not current or status_priority.get(st, 0) > status_priority.get(current, 0):
            result[lemma] = st

    return result
