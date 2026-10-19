import io
import tempfile
from pathlib import Path
import pytest
from ebooklib import epub
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.services.document_parser.pdf_parser import parse_pdf
from app.services.document_parser.epub_parser import parse_epub
from app.services.document_parser.text_parser import parse_text
from app.services.document_parser.service import DocumentService

# Test SQLite in-memory database
TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_db
client = TestClient(app)


def test_parse_text_multichapter():
    raw_content = (
        "# Chapitre 1: Le Départ\n"
        "Bonjour à tous. Je vais visiter Paris demain matin.\n\n"
        "# Chapitre 2: L'Arrivée\n"
        "Nous sommes arrivés à l'heure. J'ai mangé un croissant."
    )
    parsed = parse_text(raw_content.encode("utf-8"), filename="voyage.txt")
    assert parsed.title == "voyage"
    assert parsed.file_type == "text"
    assert len(parsed.chapters) == 2
    assert "Chapitre 1" in parsed.chapters[0].title
    assert "Chapitre 2" in parsed.chapters[1].title
    assert parsed.total_words > 10


def test_parse_pdf():
    # Construct a minimal valid PDF with a French sentence
    minimal_pdf = b"""%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /Resources <</Font <</F1 4 0 R>>>> /MediaBox [0 0 500 800] /Contents 5 0 R>> endobj
4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
5 0 obj <</Length 55>> stream
BT
/F1 12 Tf
72 712 Td
(Bonjour. Je vais visiter Paris.) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000227 00000 n 
0000000295 00000 n 
trailer <</Size 6 /Root 1 0 R>>
startxref
402
%%EOF"""

    parsed = parse_pdf(minimal_pdf, filename="test_guide.pdf")
    assert parsed.file_type == "pdf"
    assert len(parsed.chapters) >= 1
    assert "Je vais visiter" in parsed.chapters[0].text


def test_parse_epub():
    book = epub.EpubBook()
    book.set_title("Le Petit Prince Test")
    c1 = epub.EpubHtml(title="Introduction", file_name="intro.xhtml", lang="fr")
    c1.content = "<h1>Introduction</h1><p>Je ne vais pas partir tout de suite.</p>"
    book.add_item(c1)
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    book.spine = ["nav", c1]

    with tempfile.NamedTemporaryFile(suffix=".epub", delete=False) as tmp:
        tmp_name = tmp.name

    try:
        epub.write_epub(tmp_name, book)
        with open(tmp_name, "rb") as f:
            file_bytes = f.read()

        parsed = parse_epub(file_bytes, filename="prince.epub")
        assert parsed.title == "Le Petit Prince Test"
        assert parsed.file_type == "epub"
        assert len(parsed.chapters) >= 1
        assert "Je ne vais pas partir" in parsed.chapters[0].text
    finally:
        Path(tmp_name).unlink(missing_ok=True)



def test_document_service_ingest_and_grammar_mining():
    db = TestingSession()
    try:
        french_text = (
            "Bonjour les amis. "
            "Je vais visiter mon ami ce week-end. "
            "Nous allons voyager en train à travers le pays. "
            "Hier, j'ai fini la lecture de ce beau livre. "
            "Elle est allée à la gare. "
            "Je ne comprends pas cette énigme complexe."
        )

        doc = DocumentService.ingest_document(
            db=db,
            file_bytes=french_text.encode("utf-8"),
            filename="mon_livre.txt",
            title="Mon Livre Français",
        )

        assert doc.id is not None
        assert doc.title == "Mon Livre Français"
        assert doc.total_sentences == 6

        # Mine 'futur_proche' examples
        mined_futur = DocumentService.mine_sentences_by_rule(db, doc.id, "futur_proche")
        assert len(mined_futur) == 2
        mined_texts = [m["text"] for m in mined_futur]
        assert any("Je vais visiter" in t for t in mined_texts)
        assert any("Nous allons voyager" in t for t in mined_texts)

        # Mine 'passe_compose' examples
        mined_passe = DocumentService.mine_sentences_by_rule(db, doc.id, "passe_compose")
        assert len(mined_passe) == 2
        passe_texts = [m["text"] for m in mined_passe]
        assert any("j'ai fini" in t.lower() for t in passe_texts)
        assert any("est allée" in t for t in passe_texts)

        # Mine 'negation' examples
        mined_neg = DocumentService.mine_sentences_by_rule(db, doc.id, "negation")
        assert len(mined_neg) == 1
        assert "Je ne comprends pas" in mined_neg[0]["text"]

    finally:
        db.close()


def test_documents_api_full_flow():
    test_content = (
        "C'est une belle journée. "
        "Je vais lire un poème. "
        "Elle a regardé les étoiles. "
        "Il ne fait rien."
    )
    files = {"file": ("demo.txt", io.BytesIO(test_content.encode("utf-8")), "text/plain")}
    data = {"title": "Poésie Démo"}

    # 1. Upload
    upload_res = client.post("/api/documents/upload", files=files, data=data)
    assert upload_res.status_code == 200
    doc_info = upload_res.json()
    doc_id = doc_info["id"]
    assert doc_info["title"] == "Poésie Démo"
    assert doc_info["total_sentences"] == 4

    # 2. List
    list_res = client.get("/api/documents")
    assert list_res.status_code == 200
    docs = list_res.json()
    assert any(d["id"] == doc_id for d in docs)

    # 3. Get sentences
    sents_res = client.get(f"/api/documents/{doc_id}/sentences")
    assert sents_res.status_code == 200
    sents = sents_res.json()
    assert len(sents) == 4

    # 4. Mine grammar examples
    mine_res = client.get(f"/api/documents/{doc_id}/mine/futur_proche")
    assert mine_res.status_code == 200
    mine_data = mine_res.json()
    assert mine_data["rule_id"] == "futur_proche"
    assert mine_data["total_mined"] == 1
    assert "Je vais lire" in mine_data["examples"][0]["text"]

    # 5. Delete
    del_res = client.delete(f"/api/documents/{doc_id}")
    assert del_res.status_code == 200

    # Verify deleted
    get_res = client.get(f"/api/documents/{doc_id}")
    assert get_res.status_code == 404
