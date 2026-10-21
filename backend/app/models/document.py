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

    sections = relationship(
        "DocumentSection",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocumentSection.section_index",
    )

    sentences = relationship(
        "DocumentSentence",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocumentSentence.sentence_index",
    )


class DocumentSection(Base):
    """Section or chapter within a document."""

    __tablename__ = "document_sections"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    section_index = Column(Integer, nullable=False, index=True)
    title = Column(String(255), nullable=True)
    total_words = Column(Integer, default=0)
    total_sentences = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    document = relationship("Document", back_populates="sections")
    sentences = relationship(
        "DocumentSentence",
        back_populates="section",
        cascade="all, delete-orphan",
        order_by="DocumentSentence.order_index",
    )


class DocumentSentence(Base):
    """Indexed sentence extracted from an uploaded document."""

    __tablename__ = "document_sentences"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    section_id = Column(Integer, ForeignKey("document_sections.id", ondelete="CASCADE"), nullable=True, index=True)
    section_index = Column(Integer, default=1, index=True)
    chapter_index = Column(Integer, default=1)  # Backward compatibility alias
    chapter_title = Column(String(255), nullable=True)
    order_index = Column(Integer, default=0, index=True)  # Position index within section
    sentence_index = Column(Integer, nullable=False, index=True)  # Position index within document
    text = Column(Text, nullable=False)
    matched_rules = Column(String(512), nullable=True, index=True)  # e.g. "futur_proche,negation"
    spacy_analysis = Column(Text, nullable=True)  # JSON-encoded tokens, lemmas, POS tags

    document = relationship("Document", back_populates="sentences")
    section = relationship("DocumentSection", back_populates="sentences")
