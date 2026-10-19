import io
import re
from pathlib import Path
from typing import List, Union
from pypdf import PdfReader
from app.services.document_parser.base import ExtractedChapter, ParsedDocument


def clean_french_text(text: str) -> str:
    """Clean whitespace and rejoin hyphenated line breaks common in PDFs."""
    # Rejoin words broken by hyphen at line break: e.g. "com-\nprendre" -> "comprendre"
    text = re.sub(r"(\b\w+)-\s*\n\s*(\w+\b)", r"\1\2", text)
    # Replace multiple consecutive whitespaces/newlines with single space
    text = re.sub(r"[ \t]+", " ", text)
    # Normalize multiple newlines to double newline
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_pdf(file_source: Union[str, Path, bytes, io.BytesIO], filename: str = "document.pdf") -> ParsedDocument:
    """Extract chapters/pages from a PDF document."""
    if isinstance(file_source, bytes):
        stream = io.BytesIO(file_source)
    elif isinstance(file_source, io.BytesIO):
        stream = file_source
    else:
        stream = open(file_source, "rb")

    try:
        reader = PdfReader(stream)
        doc_title = Path(filename).stem
        if reader.metadata and reader.metadata.title:
            doc_title = str(reader.metadata.title).strip() or doc_title

        chapters: List[ExtractedChapter] = []
        total_words = 0

        for page_idx, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            cleaned = clean_french_text(page_text)
            if not cleaned:
                continue

            words_count = len(cleaned.split())
            total_words += words_count

            chapters.append(
                ExtractedChapter(
                    index=page_idx + 1,
                    title=f"Page {page_idx + 1}",
                    text=cleaned,
                    sentences=[],
                )
            )

        return ParsedDocument(
            title=doc_title,
            file_type="pdf",
            total_words=total_words,
            total_sentences=0,
            chapters=chapters,
        )
    finally:
        if not isinstance(file_source, (bytes, io.BytesIO)):
            stream.close()
