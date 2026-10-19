from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.services.document_parser.service import DocumentService

router = APIRouter(prefix="/documents", tags=["Documents"])


class DocumentResponse(BaseModel):
    id: int
    title: str
    filename: str
    file_type: str
    total_words: int
    total_sentences: int
    created_at: Optional[str] = None


class SentenceResponse(BaseModel):
    id: int
    chapter_index: int
    chapter_title: Optional[str]
    sentence_index: int
    text: str
    matched_rules: Optional[str] = None


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Upload a PDF, EPUB, or TXT document, segment into French sentences, and index grammar patterns."""
    filename = file.filename or "uploaded_document.txt"
    suffix = filename.lower().split(".")[-1] if "." in filename else ""

    if suffix not in ("pdf", "epub", "txt", "md", "text"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '.{suffix}'. Supported formats: .pdf, .epub, .txt, .md",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

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
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(exc)}")


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


@router.get("/{document_id}/sentences", response_model=List[SentenceResponse])
def get_document_sentences(
    document_id: int,
    chapter_index: Optional[int] = None,
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
        skip=skip,
        limit=limit,
    )
    return [
        SentenceResponse(
            id=s.id,
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
