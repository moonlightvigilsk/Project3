from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import Base, engine, get_db
from app.models.document import Document, DocumentSection, DocumentSentence
from app.services.document_parser.base import ScannedPDFError

client = TestClient(app)
FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    # Cleanup DB after tests
    with engine.connect() as conn:
        conn.execute(DocumentSentence.__table__.delete())
        conn.execute(DocumentSection.__table__.delete())
        conn.execute(Document.__table__.delete())
        conn.commit()


def test_post_documents_pdf_success():
    pdf_path = FIXTURES_DIR / "sample_french.pdf"
    assert pdf_path.exists(), "Sample French PDF fixture must exist"

    with open(pdf_path, "rb") as f:
        response = client.post(
            "/documents",
            files={"file": ("sample_french.pdf", f, "application/pdf")},
            data={"title": "Les Misérables (Extrait)"},
        )

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Les Misérables (Extrait)"
    assert data["file_type"] == "pdf"
    assert data["total_sentences"] > 0
    doc_id = data["id"]

    # Check sections endpoint
    sec_resp = client.get(f"/documents/{doc_id}/sections")
    assert sec_resp.status_code == 200
    sections = sec_resp.json()
    assert len(sections) == 2
    assert sections[0]["section_index"] == 1
    assert "Chapitre I" in sections[0]["title"]
    assert sections[1]["section_index"] == 2
    assert "Chapitre II" in sections[1]["title"]

    # Check sentences endpoint
    sent_resp = client.get(f"/documents/{doc_id}/sentences")
    assert sent_resp.status_code == 200
    sentences = sent_resp.json()
    assert len(sentences) > 0

    # Verify position indices
    for idx, s in enumerate(sentences):
        assert s["sentence_index"] == idx
        assert s["section_index"] in (1, 2)
        assert s["order_index"] is not None
        assert s["order_index"] >= 0

    # Verify header / footer was removed
    full_text = " ".join(s["text"] for s in sentences)
    assert "Victor Hugo - Les Misérables" not in full_text
    assert "— 1 —" not in full_text
    assert "— 2 —" not in full_text
    assert "· 1 ·" not in full_text

    # Verify hyphenated line break was unwrapped: "extraordinaires"
    assert "extraordinaires" in full_text


def test_post_documents_scanned_pdf_error():
    scanned_path = FIXTURES_DIR / "sample_scanned.pdf"
    assert scanned_path.exists(), "Sample scanned PDF fixture must exist"

    with open(scanned_path, "rb") as f:
        response = client.post(
            "/documents",
            files={"file": ("sample_scanned.pdf", f, "application/pdf")},
        )

    assert response.status_code == 422
    data = response.json()
    assert "detail" in data
    # Clear error message indicating scanned PDF and no OCR yet
    assert "scan" in data["detail"].lower()
    assert "ocr" in data["detail"].lower()


def test_post_documents_epub_success():
    epub_path = FIXTURES_DIR / "sample_french.epub"
    assert epub_path.exists(), "Sample French EPUB fixture must exist"

    with open(epub_path, "rb") as f:
        response = client.post(
            "/documents",
            files={"file": ("sample_french.epub", f, "application/epub+zip")},
            data={"title": "Le Tour du monde en 80 jours"},
        )

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Le Tour du monde en 80 jours"
    assert data["file_type"] == "epub"
    assert data["total_sentences"] > 0
    doc_id = data["id"]

    # Check sections
    sec_resp = client.get(f"/documents/{doc_id}/sections")
    assert sec_resp.status_code == 200
    sections = sec_resp.json()
    assert len(sections) == 2
    assert sections[0]["section_index"] == 1
    assert "Chapitre I" in sections[0]["title"]
    assert sections[1]["section_index"] == 2
    assert "Chapitre II" in sections[1]["title"]

    # Check sentences per chapter
    ch1_resp = client.get(f"/documents/{doc_id}/sentences?chapter_index=1")
    assert ch1_resp.status_code == 200
    ch1_sentences = ch1_resp.json()
    assert len(ch1_sentences) > 0
    assert all(s["section_index"] == 1 for s in ch1_sentences)


def test_legacy_upload_route_backward_compatibility():
    pdf_path = FIXTURES_DIR / "sample_french.pdf"
    with open(pdf_path, "rb") as f:
        response = client.post(
            "/documents/upload",
            files={"file": ("sample_french.pdf", f, "application/pdf")},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["total_sentences"] > 0
