from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Document(Base):
    """Uploaded user reading document (PDF, EPUB, or raw text)."""

    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(32), nullable=False)  # "pdf", "epub", "text"
    file_path = Column(String(512), nullable=False)
    total_words = Column(Integer, default=0)
    total_sentences = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    sentences = relationship("DocumentSentence", back_populates="document", cascade="all, delete-orphan")


class DocumentSentence(Base):
    """Indexed sentence extracted from an uploaded document."""

    __tablename__ = "document_sentences"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chapter_index = Column(Integer, default=0)
    chapter_title = Column(String(255), nullable=True)
    sentence_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    spacy_analysis = Column(Text, nullable=True)  # JSON-encoded tokens, lemmas, POS tags

    document = relationship("Document", back_populates="sentences")
