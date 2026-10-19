import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db

# In-memory SQLite database for test isolation
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert data["docs_url"] == "/docs"


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert data["llm_provider"] == "mock"
    assert data["llm_available"] is True


def test_practice_evaluate_and_history():
    payload = {
        "user_sentence": "Je vais visiter mon ami à Paris.",
        "target_rule_id": "futur_proche",
        "target_rule_name": "Futur proche",
        "target_rule_formula": "aller + infinitif",
        "learner_native_lang": "vi",
    }
    response = client.post("/api/practice/evaluate", json=payload)
    assert response.status_code == 200
    result = response.json()
    assert result["is_correct"] is True
    assert result["target_pattern_matched"] is True
    assert result["score"] >= 90
    assert result["status"] == "correct"

    # Verify history retrieval
    hist_response = client.get("/api/practice/history")
    assert hist_response.status_code == 200
    history = hist_response.json()
    assert len(history) >= 1
    assert history[0]["rule_id"] == "futur_proche"
    assert "Je vais visiter" in history[0]["user_sentence"]


def test_practice_explain_endpoint():
    payload = {
        "rule_id": "futur_proche",
        "rule_name": "Futur proche",
        "learner_native_lang": "vi",
    }
    response = client.post("/api/practice/explain", json=payload)
    assert response.status_code == 200
    result = response.json()
    assert result["rule_id"] == "futur_proche"
    assert "aller" in result["formula"].lower()
    assert len(result["key_rules"]) > 0
