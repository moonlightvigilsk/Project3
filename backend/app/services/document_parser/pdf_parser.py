import io
import re
from pathlib import Path
from typing import List, Union, Set, Dict, Optional, Any
import pymupdf

from app.services.document_parser.base import (
    ExtractedChapter,
    ParsedDocument,
    ScannedPDFError,
    EmptyDocumentError,
)

# Known French compound words that should keep hyphens across lines if split
KNOWN_COMPOUNDS = {
    "peut-être", "au-delà", "au-dehors", "au-devant", "au-dessus", "au-dessous",
    "rendez-vous", "celui-ci", "celui-là", "celle-ci", "celle-là", "ceux-ci",
    "ceux-là", "celles-ci", "celles-là", "c'est-à-dire", "après-midi",
    "grand-chose", "chef-d'œuvre", "par-dessus", "par-dessous", "vis-à-vis",
}


def clean_french_text(text: str) -> str:
    """Clean whitespace, rejoin hyphenated line breaks, and unwrap broken lines."""
    if not text:
        return ""

    # Rejoin words broken by hyphen at line break: e.g. "extraordi-\nnaire" -> "extraordinaire"
    def _rejoin_hyphen(match: re.Match) -> str:
        part1 = match.group(1)
        part2 = match.group(2)
        combined = f"{part1}-{part2}".lower()
        if combined in KNOWN_COMPOUNDS:
            return f"{part1}-{part2}"
        return f"{part1}{part2}"

    text = re.sub(
        r"(\b[a-zA-ZàâäéèêëîïôöùûüçœæÀÂÄÉÈÊËÎÏÔÖÙÛÜÇŒÆ]+)-\s*\n\s*([a-zA-ZàâäéèêëîïôöùûüçœæÀÂÄÉÈÊËÎÏÔÖÙÛÜÇŒÆ]+\b)",
        _rejoin_hyphen,
        text,
    )

    # Unwrap soft broken lines within paragraphs
    paragraphs: List[str] = []
    for raw_para in re.split(r"\n\s*\n+", text):
        lines = [line.strip() for line in raw_para.split("\n") if line.strip()]
        if not lines:
            continue
        # Join lines inside a paragraph with a single space
        joined = " ".join(lines)
        # Collapse multiple spaces
        joined = re.sub(r"[ \t]+", " ", joined).strip()
        if joined:
            paragraphs.append(joined)

    return "\n\n".join(paragraphs).strip()


def is_page_number_line(line: str) -> bool:
    """Check if a line looks like a standalone page number or running counter."""
    s = line.strip().lower()
    if not s:
        return False
    # Strip surrounding dashes, brackets, middle dots, bullets, etc.
    stripped = re.sub(r"^[\s\-—–~•·\[\(\.,]+|[\s\-—–~•·\]\)\.,]+$", "", s)
    if stripped.isdigit():
        return True
    # e.g., "Page 12", "p. 5", "page 3 / 10"
    if re.match(r"^(page|p\.)\s*\d+(\s*/\s*\d+)?$", s):
        return True
    # e.g., Roman numerals "- iv -", "xii"
    if re.match(r"^[-—–~•·]?\s*[ivxlcdm]+\s*[-—–~•·]?$", s):
        return True
    return False


def _detect_repetitive_headers_footers(doc: pymupdf.Document) -> Set[str]:
    """Identify repetitive running header and footer text across pages."""
    if len(doc) <= 1:
        return set()

    header_footer_counts: Dict[str, int] = {}

    for page in doc:
        rect = page.rect
        page_h = rect.height
        blocks = page.get_text("blocks")
        if not blocks:
            continue

        for b in blocks:
            # b = (x0, y0, x1, y1, text, block_no, block_type)
            if len(b) < 5 or b[6] != 0:  # Only text blocks
                continue
            y0, y1, text = b[1], b[3], b[4].strip()
            if not text:
                continue

            # Header region: top 12% of page
            # Footer region: bottom 12% of page
            is_in_header_zone = y0 < (page_h * 0.12)
            is_in_footer_zone = y1 > (page_h * 0.88)

            if is_in_header_zone or is_in_footer_zone:
                for line in text.splitlines():
                    clean_line = re.sub(r"\s+", " ", line).strip().lower()
                    if clean_line and len(clean_line) < 120:
                        header_footer_counts[clean_line] = header_footer_counts.get(clean_line, 0) + 1

    # Any non-page-number line appearing in header/footer on >= 2 pages (or > 20% of pages)
    threshold = 2 if len(doc) <= 5 else max(2, int(len(doc) * 0.2))
    repetitive: Set[str] = {
        line_text
        for line_text, count in header_footer_counts.items()
        if count >= threshold
    }
    return repetitive


def _extract_page_content_without_headers_footers(
    page: pymupdf.Page, repetitive_headers: Set[str]
) -> str:
    """Extract page text while filtering out header/footer lines."""
    rect = page.rect
    page_h = rect.height
    blocks = page.get_text("blocks")
    if not blocks:
        return ""

    cleaned_blocks: List[str] = []

    for b in blocks:
        if len(b) < 5 or b[6] != 0:
            continue
        y0, y1, text = b[1], b[3], b[4].strip()
        if not text:
            continue

        is_header_zone = y0 < (page_h * 0.12)
        is_footer_zone = y1 > (page_h * 0.88)

        block_lines: List[str] = []
        for line in text.splitlines():
            line_stripped = line.strip()
            if not line_stripped:
                continue

            # If in header or footer zone, check if it's a page number or repetitive header
            if is_header_zone or is_footer_zone:
                if is_page_number_line(line_stripped):
                    continue
                normalized = re.sub(r"\s+", " ", line_stripped).strip().lower()
                if normalized in repetitive_headers:
                    continue

            block_lines.append(line_stripped)

        if block_lines:
            cleaned_blocks.append("\n".join(block_lines))

    return "\n\n".join(cleaned_blocks)


def parse_pdf(
    file_source: Union[str, Path, bytes, io.BytesIO],
    filename: str = "document.pdf",
) -> ParsedDocument:
    """Extract clean text and chapters/sections from a PDF using PyMuPDF.

    Detects scanned PDFs (no text/searchable content) and raises ScannedPDFError.
    Removes repetitive headers, footers, page numbers, and joins broken lines.
    """
    if isinstance(file_source, bytes):
        doc = pymupdf.open(stream=file_source, filetype="pdf")
    elif isinstance(file_source, io.BytesIO):
        doc = pymupdf.open(stream=file_source.getvalue(), filetype="pdf")
    else:
        doc = pymupdf.open(str(file_source))

    try:
        total_pages = len(doc)
        if total_pages == 0:
            raise EmptyDocumentError("Tập tin PDF không chứa trang nào.")

        # Scanned PDF Detection:
        # Check raw text volume across all pages before processing
        total_raw_chars = 0
        total_images = 0
        for page in doc:
            page_raw = page.get_text() or ""
            total_raw_chars += len(page_raw.strip())
            total_images += len(page.get_images())

        # If raw text is empty or virtually non-existent (< 30 characters across entire document)
        if total_raw_chars < 30:
            raise ScannedPDFError(
                "Tài liệu PDF là bản scan hoặc chỉ chứa hình ảnh (không có văn bản dạng text). "
                "Hệ thống hiện tại chưa hỗ trợ OCR."
            )

        # Detect repetitive headers and footers
        repetitive_headers = _detect_repetitive_headers_footers(doc)

        # Determine document title from PDF metadata or filename
        doc_title = Path(filename).stem
        if doc.metadata:
            meta_title = doc.metadata.get("title")
            if meta_title and str(meta_title).strip():
                doc_title = str(meta_title).strip()

        # Check for PDF Outline / Table of Contents
        toc = doc.get_toc()  # [[lvl, title, page_1_based], ...]
        page_to_toc_title: Dict[int, str] = {}
        if toc:
            for item in toc:
                if len(item) >= 3:
                    lvl, title, pno = item[0], item[1], item[2]
                    # Map 1-based page number to chapter title
                    if pno not in page_to_toc_title:
                        page_to_toc_title[pno] = title.strip()

        # Extract text per page
        page_texts: List[Dict[str, Any]] = []
        for page_idx, page in enumerate(doc):
            pno = page_idx + 1
            extracted = _extract_page_content_without_headers_footers(page, repetitive_headers)
            cleaned = clean_french_text(extracted)
            if cleaned:
                toc_title = page_to_toc_title.get(pno)
                page_texts.append({
                    "page_num": pno,
                    "text": cleaned,
                    "toc_title": toc_title,
                })

        if not page_texts:
            raise ScannedPDFError(
                "Tài liệu PDF không có văn bản đọc được sau khi xử lý. "
                "Hệ thống hiện tại chưa hỗ trợ OCR."
            )

        # Group pages into chapters / sections
        chapters: List[ExtractedChapter] = []
        current_chapter_title: Optional[str] = None
        current_chapter_texts: List[str] = []
        chapter_index = 1

        # Check if text contains explicit chapter headings
        # e.g., "Chapitre 1", "Chapitre I", "LIVRE PREMIER"
        chapter_heading_pattern = re.compile(
            r"^(?:CHAPITRE|Chapitre|LIVRE|Livre|SECTION|Section|ACTE|Acte)\s+([IVXLCDM\d]+|[A-ZÀ-Ÿa-zà-ÿ]+)",
            re.MULTILINE,
        )

        # If TOC exists, split by TOC titles
        if page_to_toc_title and len(page_to_toc_title) > 1:
            for pt in page_texts:
                if pt["toc_title"]:
                    if current_chapter_texts:
                        combined_text = "\n\n".join(current_chapter_texts).strip()
                        chapters.append(
                            ExtractedChapter(
                                index=chapter_index,
                                title=current_chapter_title or f"Section {chapter_index}",
                                text=combined_text,
                                sentences=[],
                            )
                        )
                        chapter_index += 1
                        current_chapter_texts = []
                    current_chapter_title = pt["toc_title"]
                current_chapter_texts.append(pt["text"])

            if current_chapter_texts:
                combined_text = "\n\n".join(current_chapter_texts).strip()
                chapters.append(
                    ExtractedChapter(
                        index=chapter_index,
                        title=current_chapter_title or f"Section {chapter_index}",
                        text=combined_text,
                        sentences=[],
                    )
                )
        else:
            # Fallback: check if pages contain chapter heading lines
            # If not, treat each page (or small page groups) as sections
            all_text = "\n\n".join([pt["text"] for pt in page_texts])
            matches = list(chapter_heading_pattern.finditer(all_text))

            if len(matches) >= 2:
                # Split text along heading matches
                split_indices = [m.start() for m in matches] + [len(all_text)]
                for i in range(len(matches)):
                    start_pos = split_indices[i]
                    end_pos = split_indices[i + 1]
                    chunk = all_text[start_pos:end_pos].strip()
                    first_line = chunk.split("\n")[0].strip()
                    chapters.append(
                        ExtractedChapter(
                            index=i + 1,
                            title=first_line[:80],
                            text=chunk,
                            sentences=[],
                        )
                    )
            else:
                # Fallback: each page with text is a section/chapter
                for idx, pt in enumerate(page_texts):
                    chapters.append(
                        ExtractedChapter(
                            index=idx + 1,
                            title=f"Page {pt['page_num']}",
                            text=pt["text"],
                            sentences=[],
                        )
                    )

        total_words = sum(len(ch.text.split()) for ch in chapters)

        return ParsedDocument(
            title=doc_title,
            file_type="pdf",
            total_words=total_words,
            total_sentences=0,
            chapters=chapters,
        )
    finally:
        doc.close()
