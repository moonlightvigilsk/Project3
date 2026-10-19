import re
from pathlib import Path
from typing import List, Union
from app.services.document_parser.base import ExtractedChapter, ParsedDocument
from app.services.document_parser.pdf_parser import clean_french_text


def parse_text(file_source: Union[str, Path, bytes], filename: str = "document.txt") -> ParsedDocument:
    """Extract chapters/sections from plain text or Markdown."""
    if isinstance(file_source, bytes):
        raw_text = file_source.decode("utf-8", errors="replace")
    elif isinstance(file_source, Path):
        raw_text = file_source.read_text(encoding="utf-8", errors="replace")
    else:
        with open(file_source, "r", encoding="utf-8", errors="replace") as f:
            raw_text = f.read()

    cleaned_full = clean_french_text(raw_text)
    doc_title = Path(filename).stem

    # Attempt to split by chapter headers: '# Chapter' or 'Chapitre N'
    chapter_splits = re.split(r"(?m)^(?:#{1,3}\s+|Chapitre\s+\d+[:\s]*)", cleaned_full)

    chapters: List[ExtractedChapter] = []
    total_words = 0

    if len(chapter_splits) > 1:
        for idx, part in enumerate(chapter_splits):
            part_clean = part.strip()
            if not part_clean:
                continue
            lines = part_clean.split("\n", 1)
            title = lines[0].strip()[:80] if lines else f"Section {idx}"
            text = lines[1].strip() if len(lines) > 1 else part_clean

            words = len(text.split())
            total_words += words

            chapters.append(
                ExtractedChapter(
                    index=len(chapters) + 1,
                    title=title,
                    text=text,
                    sentences=[],
                )
            )
    else:
        words = len(cleaned_full.split())
        total_words = words
        chapters.append(
            ExtractedChapter(
                index=1,
                title="Texte intégral",
                text=cleaned_full,
                sentences=[],
            )
        )

    return ParsedDocument(
        title=doc_title,
        file_type="text",
        total_words=total_words,
        total_sentences=0,
        chapters=chapters,
    )
