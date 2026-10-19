import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db

# Isolated in-memory SQLite database
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


def test_evaluate_correct_futur_proche():
    payload = {
        "user_sentence": "Je vais visiter mon ami ce soir.",
        "target_rule_id": "futur_proche",
        "target_rule_name": "Futur proche",
        "target_rule_formula": "aller + infinitif",
        "learner_native_lang": "vi",
        "document_id": 42,
    }
    response = client.post("/api/practice/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["is_correct"] is True
    assert data["target_pattern_matched"] is True
    assert data["score"] >= 90
    assert data["status"] == "correct"
    assert "tương lai gần" in data["positive_feedback"].lower()
    assert len(data["diff_tokens"]) > 0
    assert len(data["spacy_tokens"]) > 0
    assert len(data["suggested_alternatives"]) >= 1


def test_evaluate_minor_issue_double_conjugation():
    # User wrote 'Je vais mange' instead of 'Je vais manger'
    payload = {
        "user_sentence": "Je vais mange une pomme.",
        "target_rule_id": "futur_proche",
        "target_rule_name": "Futur proche",
        "learner_native_lang": "vi",
    }
    response = client.post("/api/practice/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["is_correct"] is False
    assert data["status"] == "minor_issues"
    assert "manger" in data["corrected_sentence"]
    assert "nguyên mẫu" in data["error_explanation"].lower()

    # Check diff tokens
    diff_types = [d["type"] for d in data["diff_tokens"]]
    assert "replaced" in diff_types or "same" in diff_types


def test_evaluate_incorrect_missing_pattern():
    payload = {
        "user_sentence": "Je mange une pomme rouge.",
        "target_rule_id": "futur_proche",
        "target_rule_name": "Futur proche",
        "learner_native_lang": "vi",
    }
    response = client.post("/api/practice/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["is_correct"] is False
    assert data["target_pattern_matched"] is False
    assert data["score"] <= 50
    assert data["status"] == "incorrect"
    assert "aller" in data["error_explanation"].lower()


def test_evaluate_negation():
    payload = {
        "user_sentence": "Je ne comprends pas la question.",
        "target_rule_id": "negation",
        "target_rule_name": "Négation",
        "learner_native_lang": "vi",
    }
    response = client.post("/api/practice/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["is_correct"] is True
    assert data["target_pattern_matched"] is True
    assert data["score"] >= 90


def test_practice_history_and_stats():
    # Retrieve history
    hist_res = client.get("/api/practice/history")
    assert hist_res.status_code == 200
    records = hist_res.json()
    assert len(records) >= 4

    # Test filtering history by rule_id
    filtered_res = client.get("/api/practice/history?rule_id=negation")
    assert filtered_res.status_code == 200
    filtered = filtered_res.json()
    assert all(r["rule_id"] == "negation" for r in filtered)

    # Test stats aggregation endpoint
    stats_res = client.get("/api/practice/stats")
    assert stats_res.status_code == 200
    stats = stats_res.json()

    assert stats["total_attempts"] >= 4
    assert stats["correct_attempts"] >= 2
    assert 0 <= stats["accuracy_rate"] <= 100
    assert "futur_proche" in stats["rules_breakdown"]
    assert "negation" in stats["rules_breakdown"]


def test_practice_explain_vietnamese():
    payload = {
        "rule_id": "futur_proche",
        "rule_name": "Futur proche",
        "learner_native_lang": "vi",
    }
    res = client.post("/api/practice/explain", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["rule_id"] == "futur_proche"
    assert "tương lai gần" in data["summary"].lower()
    assert "aller" in data["formula"].lower()
    assert len(data["key_rules"]) >= 3
    assert len(data["common_mistakes"]) >= 1
    assert "je" in data["conjugation_or_forms"]
