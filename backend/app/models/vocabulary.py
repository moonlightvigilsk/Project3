from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class VocabularyItem(Base):
    """User vocabulary tracking per lemma and optionally per document."""

    __tablename__ = "vocabulary_items"

    id = Column(Integer, primary_key=True, index=True)
    lemma = Column(String(128), nullable=False, index=True)
    surface_form = Column(String(128), nullable=True)  # Inflected form as seen
    pos = Column(String(32), nullable=True)  # VERB, NOUN, ADJ, etc.
    definition = Column(Text, nullable=True)  # Cached definition
    definition_vi = Column(Text, nullable=True)  # Vietnamese translation if available
    definition_source = Column(String(64), default="wiktionary")
    status = Column(String(32), default="new", nullable=False, index=True)  # "new" | "learning" | "known"
    occurrences = Column(Integer, default=1)  # Encounter count
    context_sentence = Column(Text, nullable=True)  # Example sentence from reading
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    document = relationship("Document", backref="vocabulary_items")

    __table_args__ = (
        UniqueConstraint("lemma", "document_id", name="uq_lemma_document"),
    )
