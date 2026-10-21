import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.practice_rule_verifier import verify_sentence_by_rules

client = TestClient(app)

# 20 curated test sentences for aller + infinitif (futur proche)
BENCHMARK_20_CASES = [
    # 10 Positive / Valid sentences
    {"text": "Je vais visiter mon ami ce soir.", "expected_correct": True, "label": "1st sing standard"},
    {"text": "Tu vas apprendre le français rapidement.", "expected_correct": True, "label": "2nd sing standard"},
    {"text": "Il va partir demain matin.", "expected_correct": True, "label": "3rd sing masc"},
    {"text": "Elle va commencer un nouveau livre.", "expected_correct": True, "label": "3rd sing fem"},
    {"text": "Nous allons manger au restaurant.", "expected_correct": True, "label": "1st plur standard"},
    {"text": "Vous allez comprendre cette règle.", "expected_correct": True, "label": "2nd plur polite"},
    {"text": "Ils vont voyager en France.", "expected_correct": True, "label": "3rd plur masc"},
    {"text": "Elles vont finir leurs devoirs.", "expected_correct": True, "label": "3rd plur fem"},
    {"text": "Je vais lire ce document attentivement.", "expected_correct": True, "label": "1st sing with adverb"},
    {"text": "On va voir nos parents ce week-end.", "expected_correct": True, "label": "Informal on"},

    # 10 Negative / Invalid sentences with distinct failure reasons
    {"text": "Je vais à Hanoi en train.", "expected_correct": False, "label": "Motion verb with prep, no infinitive"},
    {"text": "J'ai visité Hanoi hier.", "expected_correct": False, "label": "Passé composé, wrong tense"},
    {"text": "Tu va partir demain.", "expected_correct": False, "label": "Subject-auxiliary mismatch (tu va vs vas)"},
    {"text": "Je va manger une pomme.", "expected_correct": False, "label": "Subject-auxiliary mismatch (je va vs vais)"},
    {"text": "Nous vont voyager ensemble.", "expected_correct": False, "label": "Subject-auxiliary mismatch (nous vont vs allons)"},
    {"text": "Je vais mange une pomme.", "expected_correct": False, "label": "Double conjugation, not infinitive"},
    {"text": "Elle va mangeait du pain.", "expected_correct": False, "label": "Imparfait after aller"},
    {"text": "Il allait partir quand je suis arrivé.", "expected_correct": False, "label": "Aller in imparfait"},
    {"text": "Nous mangeons du pain.", "expected_correct": False, "label": "Present tense without aller"},
    {"text": "Demain fera beau.", "expected_correct": False, "label": "Futur simple without aller"},
]


class TestPracticeGradingPipeline:
    """Test suite running the 20 benchmark sentences through the grading pipeline."""

    def test_formal_rule_verifier_20_cases(self):
        passed = 0
        for item in BENCHMARK_20_CASES:
            res = verify_sentence_by_rules(item["text"], "aller_infinitif")
            is_valid = res.pattern_matched and res.auxiliary_correct and res.main_verb_infinitive
            assert is_valid == item["expected_correct"], f"Failed on: {item['text']} ({item['label']})"
            passed += 1
        assert passed == 20

    def test_post_practice_submit_endpoint_positive(self):
        payload = {
            "user_sentence": "Je vais visiter mon ami demain.",
            "target_rule_id": "aller_infinitif",
            "target_rule_name": "Futur proche (aller + infinitif)",
        }
        res = client.post("/api/practice/submit", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["is_correct"] is True
        assert data["uses_target_construct"] is True
        assert data["score"] >= 80
        assert data["status"] == "correct"
        assert len(data["errors"]) == 0
        assert len(data["diff_tokens"]) > 0
        assert data["rule_check"]["pattern_matched"] is True
        assert data["rule_check"]["auxiliary_correct"] is True
        assert data["rule_check"]["main_verb_infinitive"] is True

    def test_post_practice_submit_subject_auxiliary_mismatch(self):
        payload = {
            "user_sentence": "Tu va partir maintenant.",
            "target_rule_id": "aller_infinitif",
            "target_rule_name": "Futur proche (aller + infinitif)",
        }
        res = client.post("/api/practice/submit", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["is_correct"] is False
        assert data["rule_check"]["auxiliary_correct"] is False
        assert any(e["type"] == "conjugation" for e in data["errors"])

    def test_post_practice_submit_main_verb_not_infinitive(self):
        payload = {
            "user_sentence": "Je vais mange une pomme.",
            "target_rule_id": "aller_infinitif",
            "target_rule_name": "Futur proche (aller + infinitif)",
        }
        res = client.post("/api/practice/submit", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["is_correct"] is False
        assert data["rule_check"]["main_verb_infinitive"] is False
        assert any(e["type"] == "infinitive" for e in data["errors"])

    def test_post_practice_submit_persisted_in_db(self):
        sent = "Nous allons visiter Hanoi ce week-end."
        payload = {
            "user_sentence": sent,
            "target_rule_id": "aller_infinitif",
        }
        res = client.post("/api/practice/submit", json=payload)
        assert res.status_code == 200

        # Check history endpoint to verify persistence in SQLite
        hist_res = client.get("/api/practice/history?limit=5")
        assert hist_res.status_code == 200
        hist_data = hist_res.json()
        assert len(hist_data) > 0
        latest = hist_data[0]
        assert latest["user_sentence"] == sent
        assert latest["is_correct"] is True
