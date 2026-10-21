import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_word_lookup_and_lemmatize():
    # 1. Lookup inflected verb: 'visitons' -> lemma 'visiter'
    payload = {
        "word": "visitons",
        "context_sentence": "Nous visitons le musée du Louvre.",
    }
    response = client.post("/api/vocabulary/lookup", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["word"] == "visitons"
    assert data["lemma"] == "visiter"
    assert data["pos"] in ("VERB", "AUX")
    assert data["definition"] is not None
    assert "voir" in data["definition"].lower() or "visiter" in data["definition"].lower()
    assert data["status"] == "new"
    assert data["occurrences"] >= 1
    assert data["context_sentence"] == "Nous visitons le musée du Louvre."


def test_word_lookup_repeated_increments_occurrence():
    payload = {
        "word": "visiter",
        "context_sentence": "Je veux visiter Paris.",
    }
    res1 = client.post("/api/vocabulary/lookup", json=payload)
    assert res1.status_code == 200
    count1 = res1.json()["occurrences"]

    res2 = client.post("/api/vocabulary/lookup", json=payload)
    assert res2.status_code == 200
    count2 = res2.json()["occurrences"]
    assert count2 == count1 + 1


def test_update_status_and_filtering():
    # 1. Create/Lookup word 'livre'
    lookup_res = client.post("/api/vocabulary/lookup", json={"word": "livre"})
    assert lookup_res.status_code == 200

    # 2. Update status to 'learning'
    update_res = client.patch(
        "/api/vocabulary/lemma/livre/status",
        json={"status": "learning"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "learning"

    # 3. Filter by status 'learning'
    list_res = client.get("/api/vocabulary?status=learning")
    assert list_res.status_code == 200
    items = list_res.json()
    assert any(it["lemma"] == "livre" and it["status"] == "learning" for it in items)

    # 4. Advance status to 'known'
    update_known = client.patch(
        "/api/vocabulary/lemma/livre/status",
        json={"status": "known"},
    )
    assert update_known.status_code == 200
    assert update_known.json()["status"] == "known"


def test_export_vocabulary_csv():
    # Make sure at least one word exists
    client.post("/api/vocabulary/lookup", json={"word": "maison"})

    res = client.get("/api/vocabulary/export/csv")
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("content-type", "")
    content = res.text
    assert "Lemma" in content
    assert "Trạng thái" in content
    assert "maison" in content


def test_vocabulary_status_map():
    client.patch("/api/vocabulary/lemma/partir/status", json={"status": "learning"})
    res = client.get("/api/vocabulary/status-map")
    assert res.status_code == 200
    status_map = res.json()
    assert "partir" in status_map
    assert status_map["partir"] == "learning"
