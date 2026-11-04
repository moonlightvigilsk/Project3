from fastapi.testclient import TestClient
from app.main import app
from app.services.practice_rule_verifier import verify_sentence_by_rules

client = TestClient(app)


def test_verifier_other_rules_depend_on_the_matcher_only():
    ok = verify_sentence_by_rules("Nous avons parlé longtemps.", "passe_compose")
    assert ok.pattern_matched is True
    assert ok.auxiliary_correct is True
    assert ok.main_verb_infinitive is True
    assert ok.auxiliary_token is None

    missing = verify_sentence_by_rules("Nous parlons longtemps.", "passe_compose")
    assert missing.pattern_matched is False


def test_submit_passe_compose_correct_sentence():
    res = client.post(
        "/api/practice/submit",
        json={"user_sentence": "Nous avons parlé longtemps.", "target_rule_id": "passe_compose"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_correct"] is True
    assert data["uses_target_construct"] is True
    assert data["errors"] == []
    assert data["llm_provider"] == "mock"


def test_submit_passe_compose_missing_construct_is_not_about_aller():
    res = client.post(
        "/api/practice/submit",
        json={"user_sentence": "Nous parlons longtemps.", "target_rule_id": "passe_compose"},
    )
    data = res.json()
    assert data["is_correct"] is False
    assert data["errors"][0]["type"] == "missing_construct"
    assert "aller" not in data["short_comment"]
    assert data["corrected_sentence"] is None
