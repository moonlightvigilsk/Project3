import io
import os
import zipfile
import tempfile
from pathlib import Path
from typing import List, Union
from bs4 import BeautifulSoup
import ebooklib
from ebooklib import epub

from app.services.document_parser.base import ExtractedChapter, ParsedDocument
from app.services.document_parser.pdf_parser import clean_french_text


def _parse_epub_with_zip(file_stream: Union[io.BytesIO, str], filename: str) -> ParsedDocument:
    """Robust fallback: parse EPUB directly via standard zipfile and BeautifulSoup."""
    chapters: List[ExtractedChapter] = []
    doc_title = Path(filename).stem
    total_words = 0
    chapter_idx = 1

    with zipfile.ZipFile(file_stream, "r") as zf:
        # Extract title from metadata if container and opf exist
        for name in zf.namelist():
            if name.endswith(".opf"):
                try:
                    opf_soup = BeautifulSoup(zf.read(name), "xml")
                    title_elem = opf_soup.find("dc:title") or opf_soup.find("title")
                    if title_elem and title_elem.text.strip():
                        doc_title = title_elem.text.strip()
                except Exception:
                    pass
                break

        # Read text/html documents
        doc_names = sorted(
            [
                n
                for n in zf.namelist()
                if n.endswith((".xhtml", ".html", ".htm"))
                and not any(x in n.lower() for x in ("nav.xhtml", "toc.xhtml", "cover.xhtml"))
            ]
        )

        for name in doc_names:
            try:
                raw_html = zf.read(name).decode("utf-8", errors="replace")
                soup = BeautifulSoup(raw_html, "html.parser")

                for elem in soup(["script", "style", "nav", "footer", "header"]):
                    elem.decompose()

                heading = soup.find(["h1", "h2", "h3", "title"])
                chapter_title = heading.get_text().strip() if heading else f"Chapitre {chapter_idx}"

                paragraphs = [p.get_text().strip() for p in soup.find_all("p") if p.get_text().strip()]
                if paragraphs:
                    body_text = "\n\n".join(paragraphs)
                else:
                    body_text = soup.get_text(separator="\n\n").strip()

                cleaned = clean_french_text(body_text)
                if not cleaned or len(cleaned) < 15:
                    continue

                words = len(cleaned.split())
                total_words += words

                chapters.append(
                    ExtractedChapter(
                        index=chapter_idx,
                        title=chapter_title[:100],
                        text=cleaned,
                        sentences=[],
                    )
                )
                chapter_idx += 1
            except Exception:
                continue

    return ParsedDocument(
        title=doc_title,
        file_type="epub",
        total_words=total_words,
        total_sentences=0,
        chapters=chapters,
    )


def parse_epub(file_source: Union[str, Path, bytes], filename: str = "book.epub") -> ParsedDocument:
    """Extract chapters and text from an EPUB ebook using ebooklib with zip fallback."""
    if isinstance(file_source, bytes):
        stream = io.BytesIO(file_source)
        return _parse_epub_with_zip(stream, filename)

    # If it's a file path
    try:
        with open(file_source, "rb") as f:
            stream = io.BytesIO(f.read())
        return _parse_epub_with_zip(stream, filename)
    except Exception:
        return _parse_epub_with_zip(str(file_source), filename)
