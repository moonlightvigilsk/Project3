from typing import List, Optional
from pydantic import BaseModel, Field


class DocumentParsingError(Exception):
    """Base exception for document parsing failures."""
    pass


class ScannedPDFError(DocumentParsingError):
    """Raised when an uploaded PDF appears to be a scanned document without extractable text."""
    pass


class EmptyDocumentError(DocumentParsingError):
    """Raised when an uploaded document contains no extractable text."""
    pass


class ExtractedChapter(BaseModel):
    """A chapter or section within a parsed document."""

    index: int
    title: str
    text: str
    sentences: List[str] = Field(default_factory=list)


# Alias for ExtractedChapter
ExtractedSection = ExtractedChapter


class ParsedDocument(BaseModel):
    """Structured representation of a parsed book/document."""

    title: str
    file_type: str  # "pdf", "epub", "text"
    total_words: int
    total_sentences: int
    chapters: List[ExtractedChapter]

    @property
    def sections(self) -> List[ExtractedChapter]:
        return self.chapters
