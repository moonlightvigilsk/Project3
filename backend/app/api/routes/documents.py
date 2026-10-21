from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.services.document_parser.service import DocumentService
from app.services.document_parser.base import ScannedPDFError, EmptyDocumentError

router = APIRouter(prefix="/documents", tags=["Documents"])


class DocumentResponse(BaseModel):
    id: int
    title: str
    filename: str
    file_type: str
    total_words: int
    total_sentences: int
    created_at: Optional[str] = None


class SectionResponse(BaseModel):
    id: int
    document_id: int
    section_index: int
    title: Optional[str] = None
    total_words: int
    total_sentences: int


class SentenceResponse(BaseModel):
    id: int
    document_id: Optional[int] = None
    section_id: Optional[int] = None
    section_index: Optional[int] = None
    order_index: Optional[int] = 0
    chapter_index: int
    chapter_title: Optional[str] = None
    sentence_index: int
    text: str
    matched_rules: Optional[str] = None


async def _process_upload(
    file: UploadFile,
    title: Optional[str],
    db: Session,
):
    """Common handler for document ingestion."""
    filename = file.filename or "uploaded_document.txt"
    suffix = filename.lower().split(".")[-1] if "." in filename else ""

    if suffix not in ("pdf", "epub", "txt", "md", "text"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '.{suffix}'. Supported formats: .pdf, .epub, .txt, .md",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    try:
        doc = DocumentService.ingest_document(
            db=db,
            file_bytes=file_bytes,
            filename=filename,
            title=title,
        )
        return DocumentResponse(
            id=doc.id,
            title=doc.title,
            filename=doc.filename,
            file_type=doc.file_type,
            total_words=doc.total_words,
            total_sentences=doc.total_sentences,
            created_at=doc.created_at.isoformat() if doc.created_at else None,
        )
    except ScannedPDFError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        )
    except EmptyDocumentError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process document: {str(exc)}",
        )


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Upload a PDF, EPUB, or TXT document, extract clean text, segment sentences, and index."""
    return await _process_upload(file=file, title=title, db=db)


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Upload alias for backward compatibility."""
    return await _process_upload(file=file, title=title, db=db)


@router.get("", response_model=List[DocumentResponse])
def list_documents(
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """List all uploaded reading documents."""
    docs = DocumentService.list_documents(db, limit=limit)
    return [
        DocumentResponse(
            id=d.id,
            title=d.title,
            filename=d.filename,
            file_type=d.file_type,
            total_words=d.total_words,
            total_sentences=d.total_sentences,
            created_at=d.created_at.isoformat() if d.created_at else None,
        )
        for d in docs
    ]


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
):
    """Get metadata for a specific document."""
    doc = DocumentService.get_document(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        filename=doc.filename,
        file_type=doc.file_type,
        total_words=doc.total_words,
        total_sentences=doc.total_sentences,
        created_at=doc.created_at.isoformat() if doc.created_at else None,
    )


@router.get("/{document_id}/sections", response_model=List[SectionResponse])
def get_document_sections(
    document_id: int,
    db: Session = Depends(get_db),
):
    """Get all sections / chapters for a specific document."""
    doc = DocumentService.get_document(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    sections = DocumentService.get_sections(db, document_id)
    return [
        SectionResponse(
            id=s.id,
            document_id=s.document_id,
            section_index=s.section_index,
            title=s.title,
            total_words=s.total_words,
            total_sentences=s.total_sentences,
        )
        for s in sections
    ]


@router.get("/{document_id}/sentences", response_model=List[SentenceResponse])
def get_document_sentences(
    document_id: int,
    chapter_index: Optional[int] = None,
    section_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Get paginated sentences for reading and navigation."""
    doc = DocumentService.get_document(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    sentences = DocumentService.get_sentences(
        db,
        document_id=document_id,
        chapter_index=chapter_index,
        section_id=section_id,
        skip=skip,
        limit=limit,
    )
    return [
        SentenceResponse(
            id=s.id,
            document_id=s.document_id,
            section_id=s.section_id,
            section_index=s.section_index,
            order_index=s.order_index,
            chapter_index=s.chapter_index,
            chapter_title=s.chapter_title,
            sentence_index=s.sentence_index,
            text=s.text,
            matched_rules=s.matched_rules.strip(",") if s.matched_rules else None,
        )
        for s in sentences
    ]


@router.get("/{document_id}/mine/{rule_id}")
def mine_grammar_examples(
    document_id: int,
    rule_id: str,
    limit: int = 30,
    db: Session = Depends(get_db),
):
    """Mine and extract contextual example sentences matching a target grammar rule."""
    doc = DocumentService.get_document(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    mined = DocumentService.mine_sentences_by_rule(
        db=db,
        document_id=document_id,
        rule_id=rule_id,
        limit=limit,
    )
    return {
        "document_id": document_id,
        "document_title": doc.title,
        "rule_id": rule_id,
        "total_mined": len(mined),
        "examples": mined,
    }


@router.get("/{document_id}/occurrences")
def get_document_occurrences(
    document_id: int,
    construct: str,
    db: Session = Depends(get_db),
):
    """List sentences in a document containing a specific grammar construct.
    
    Endpoint: GET /documents/{id}/occurrences?construct=aller_infinitif
    """
    from app.models.document import DocumentSentence as DBSentence
    from app.services.spacy_engine.engine import get_grammar_engine

    doc = DocumentService.get_document(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Match rule aliases (e.g. aller_infinitif <-> futur_proche)
    construct_aliases = [construct]
    if construct == "aller_infinitif":
        construct_aliases.append("futur_proche")
    elif construct == "futur_proche":
        construct_aliases.append("aller_infinitif")

    sentences = (
        db.query(DBSentence)
        .filter(DBSentence.document_id == document_id)
        .order_by(DBSentence.sentence_index)
        .all()
    )

    engine = get_grammar_engine()
    results = []

    for s in sentences:
        matched = False
        match_info = None

        # Check pre-indexed rules first
        if s.matched_rules:
            rules_in_sent = [r.strip() for r in s.matched_rules.split(",") if r.strip()]
            if any(alias in rules_in_sent for alias in construct_aliases):
                matched = True

        # Verify or extract match span via engine
        is_rule_present, rule_match = engine.check_target_rule(s.text, construct)
        if is_rule_present:
            matched = True
            match_info = rule_match

        if matched:
            results.append({
                "id": s.id,
                "sentence_id": s.id,
                "document_id": s.document_id,
                "section_id": s.section_id,
                "section_index": s.section_index,
                "chapter_index": s.chapter_index,
                "chapter_title": s.chapter_title,
                "sentence_index": s.sentence_index,
                "text": s.text,
                "matched_rules": s.matched_rules,
                "matched_span": match_info.matched_text if match_info else None,
                "notes": match_info.notes if match_info else None,
            })

    return {
        "document_id": document_id,
        "construct": construct,
        "total": len(results),
        "occurrences": results,
    }


@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
):
    """Delete a document and its stored file."""
    success = DocumentService.delete_document(db, document_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found.")
    return {"status": "success", "message": f"Document {document_id} deleted."}
