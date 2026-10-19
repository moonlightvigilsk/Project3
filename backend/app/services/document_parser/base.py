from typing import List, Optional
from pydantic import BaseModel, Field


class ExtractedChapter(BaseModel):
    """A chapter or section within a parsed document."""

    index: int
    title: str
    text: str
    sentences: List[str] = Field(default_factory=list)


class ParsedDocument(BaseModel):
    """Structured representation of a parsed book/document."""

    title: str
    file_type: str  # "pdf", "epub", "text"
    total_words: int
    total_sentences: int
    chapters: List[ExtractedChapter]
