import os
import json
from pathlib import Path
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.document import Document, DocumentSection, DocumentSentence
from app.services.document_parser.base import (
    ParsedDocument,
    DocumentParsingError,
    ScannedPDFError,
    EmptyDocumentError,
)
from app.services.document_parser.pdf_parser import parse_pdf
from app.services.document_parser.epub_parser import parse_epub
from app.services.document_parser.text_parser import parse_text
from app.services.spacy_engine.engine import get_grammar_engine

UPLOAD_DIR = Path("data/uploads")


def ensure_upload_dir() -> Path:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return UPLOAD_DIR


class DocumentService:
    """Handles document ingestion, storage, sentence segmentation, and grammar mining."""

    @staticmethod
    def parse_file(file_bytes: bytes, filename: str) -> ParsedDocument:
        """Parse raw file bytes into a structured ParsedDocument."""
        suffix = Path(filename).suffix.lower()

        if suffix == ".pdf":
            return parse_pdf(file_bytes, filename=filename)
        elif suffix == ".epub":
            return parse_epub(file_bytes, filename=filename)
        elif suffix in (".txt", ".md", ".text"):
            return parse_text(file_bytes, filename=filename)
        else:
            return parse_text(file_bytes, filename=filename)

    @classmethod
    def ingest_document(
        cls,
        db: Session,
        file_bytes: bytes,
        filename: str,
        title: Optional[str] = None,
    ) -> Document:
        """Process an uploaded document, index all sentences with spaCy, and persist to DB.

        Hierarchy: Document -> DocumentSection -> DocumentSentence with position indices.
        """
        upload_folder = ensure_upload_dir()
        file_path = upload_folder / filename

        # Save binary to disk
        with open(file_path, "wb") as f:
            f.write(file_bytes)

        # Parse file (will raise ScannedPDFError or EmptyDocumentError if invalid)
        parsed_doc = cls.parse_file(file_bytes, filename)
        doc_title = title.strip() if title and title.strip() else parsed_doc.title

        doc_record = Document(
            title=doc_title,
            filename=filename,
            file_type=parsed_doc.file_type,
            file_path=str(file_path),
            total_words=parsed_doc.total_words,
            total_sentences=0,
        )
        db.add(doc_record)
        db.flush()  # Get generated doc_record.id

        grammar_engine = get_grammar_engine()
        global_sentence_idx = 0
        all_sentence_records: List[DocumentSentence] = []

        for ch_order, chapter in enumerate(parsed_doc.chapters, start=1):
            ch_index = chapter.index if chapter.index is not None else ch_order
            section_record = DocumentSection(
                document_id=doc_record.id,
                section_index=ch_index,
                title=chapter.title or f"Section {ch_index}",
                total_words=len(chapter.text.split()),
                total_sentences=0,
            )
            db.add(section_record)
            db.flush()  # Get section_record.id

            sents = grammar_engine.segment_into_sentences(chapter.text)
            section_sentences: List[DocumentSentence] = []

            for order_in_section, sent_text in enumerate(sents):
                clean_sent = sent_text.strip()
                if len(clean_sent) < 3:
                    continue

                analysis = grammar_engine.analyze_sentence(clean_sent)
                rules_str = (
                    f",{','.join(analysis.matched_rule_ids)},"
                    if analysis.matched_rule_ids
                    else None
                )

                analysis_json = json.dumps(
                    {
                        "matched_rule_ids": analysis.matched_rule_ids,
                        "matches": [m.model_dump() for m in analysis.matches],
                        "tokens": [t.model_dump() for t in analysis.tokens[:30]],
                    },
                    ensure_ascii=False,
                )

                sent_record = DocumentSentence(
                    document_id=doc_record.id,
                    section_id=section_record.id,
                    section_index=ch_index,
                    chapter_index=ch_index,
                    chapter_title=chapter.title,
                    order_index=order_in_section,
                    sentence_index=global_sentence_idx,
                    text=clean_sent,
                    matched_rules=rules_str,
                    spacy_analysis=analysis_json,
                )
                section_sentences.append(sent_record)
                all_sentence_records.append(sent_record)
                global_sentence_idx += 1

            section_record.total_sentences = len(section_sentences)

        db.bulk_save_objects(all_sentence_records)
        doc_record.total_sentences = len(all_sentence_records)
        db.commit()
        db.refresh(doc_record)

        return doc_record

    @staticmethod
    def list_documents(db: Session, limit: int = 50) -> List[Document]:
        """List all uploaded reading documents."""
        return db.query(Document).order_by(desc(Document.created_at)).limit(limit).all()

    @staticmethod
    def get_document(db: Session, document_id: int) -> Optional[Document]:
        """Fetch a single document by ID."""
        return db.query(Document).filter(Document.id == document_id).first()

    @staticmethod
    def get_sections(db: Session, document_id: int) -> List[DocumentSection]:
        """Retrieve all sections/chapters of a document."""
        return (
            db.query(DocumentSection)
            .filter(DocumentSection.document_id == document_id)
            .order_by(DocumentSection.section_index)
            .all()
        )

    @staticmethod
    def delete_document(db: Session, document_id: int) -> bool:
        """Delete a document and its stored file."""
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return False

        if doc.file_path and os.path.exists(doc.file_path):
            try:
                os.remove(doc.file_path)
            except OSError:
                pass

        db.delete(doc)
        db.commit()
        return True

    @staticmethod
    def get_sentences(
        db: Session,
        document_id: int,
        chapter_index: Optional[int] = None,
        section_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[DocumentSentence]:
        """Retrieve paginated sentences from a document."""
        query = db.query(DocumentSentence).filter(DocumentSentence.document_id == document_id)
        if section_id is not None:
            query = query.filter(DocumentSentence.section_id == section_id)
        elif chapter_index is not None:
            query = query.filter(DocumentSentence.chapter_index == chapter_index)
        return query.order_by(DocumentSentence.sentence_index).offset(skip).limit(limit).all()

    @staticmethod
    def mine_sentences_by_rule(
        db: Session,
        document_id: int,
        rule_id: str,
        limit: int = 30,
    ) -> List[Dict[str, Any]]:
        """Mine and extract contextual example sentences matching a target grammar rule."""
        rule_token = f",{rule_id.lower().strip()},"
        matches = (
            db.query(DocumentSentence)
            .filter(
                DocumentSentence.document_id == document_id,
                DocumentSentence.matched_rules.like(f"%{rule_token}%"),
            )
            .order_by(DocumentSentence.sentence_index)
            .limit(limit)
            .all()
        )

        results: List[Dict[str, Any]] = []
        for sent in matches:
            analysis_data = json.loads(sent.spacy_analysis) if sent.spacy_analysis else {}
            rule_match = None
            for m in analysis_data.get("matches", []):
                if m.get("rule_id") == rule_id.lower().strip():
                    rule_match = m
                    break

            results.append(
                {
                    "sentence_id": sent.id,
                    "sentence_index": sent.sentence_index,
                    "order_index": sent.order_index,
                    "section_id": sent.section_id,
                    "section_index": sent.section_index,
                    "chapter_index": sent.chapter_index,
                    "chapter_title": sent.chapter_title,
                    "text": sent.text,
                    "matched_span": rule_match.get("matched_text") if rule_match else None,
                    "span_start": rule_match.get("start_char") if rule_match else None,
                    "span_end": rule_match.get("end_char") if rule_match else None,
                    "notes": rule_match.get("notes") if rule_match else None,
                }
            )

        return results
