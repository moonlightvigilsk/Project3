import time
import pytest
from app.services.spacy_engine.engine import get_grammar_engine
from app.services.nlp_service import analyze_tokens, compute_sentence_hash
from app.services.grammar_catalog.catalog import get_rule_by_id, list_all_rules


POSITIVE_CASES = [
    "Je vais visiter mon ami ce soir.",
    "Nous allons visiter Hanoi cet ete.",
    "Elle va partir demain matin.",
    "Ils vont comprendre la lecon plus tard.",
    "Tu vas apprendre le francais tres vite.",
    "Qu'est-ce que vous allez faire aujourd'hui ?",
]

NEGATIVE_CASES = [
    "Je vais a Hanoi en train.",
    "J'ai visite Hanoi l'annee derniere.",
    "Il allait partir quand nous sommes arrives.",
    "Nous sommes alles au marche hier.",
    "Elle va bien aujourd'hui.",
]


class TestFuturProcheGrammar:
    """Test suite evaluating Precision, Recall, and F1 for aller + infinitif matcher."""

    def setup_method(self):
        self.engine = get_grammar_engine()

    def test_positive_and_negative_with_precision_report(self):
        tp = 0
        fn = 0
        fp = 0
        tn = 0

        # Evaluate Positive Cases
        for sent in POSITIVE_CASES:
            matched, res = self.engine.check_target_rule(sent, "aller_infinitif")
            if matched:
                tp += 1
            else:
                fn += 1
                print(f"[FAILED POSITIVE] {sent}")

        # Evaluate Negative Cases
        for sent in NEGATIVE_CASES:
            matched, res = self.engine.check_target_rule(sent, "aller_infinitif")
            if matched:
                fp += 1
                print(f"[FALSE POSITIVE] {sent}")
            else:
                tn += 1

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

        print("\n" + "=" * 55)
        print(" PRECISION REPORT: ALLER + INFINITIF (FUTUR PROCHE) ")
        print("=" * 55)
        print(f"  True Positives (TP) : {tp} / {len(POSITIVE_CASES)}")
        print(f"  True Negatives (TN) : {tn} / {len(NEGATIVE_CASES)}")
        print(f"  False Positives (FP): {fp}")
        print(f"  False Negatives (FN): {fn}")
        print(f"  --> PRECISION       : {precision * 100:.2f}%")
        print(f"  --> RECALL          : {recall * 100:.2f}%")
        print(f"  --> F1 SCORE        : {f1 * 100:.2f}%")
        print("=" * 55 + "\n")

        assert precision >= 1.0, f"Precision target >= 1.0, got {precision}"
        assert recall >= 1.0, f"Recall target >= 1.0, got {recall}"

    def test_nlp_service_token_format_and_cache(self):
        sent = "Je vais visiter mon ami."
        
        # Test token attributes
        tokens = analyze_tokens(sent)
        assert len(tokens) >= 5
        tok0 = tokens[0]
        assert hasattr(tok0, "text")
        assert hasattr(tok0, "lemma")
        assert hasattr(tok0, "pos")
        assert hasattr(tok0, "morph")
        assert hasattr(tok0, "dep")
        assert hasattr(tok0, "head_text")

        # Verify second call is cached and instantaneous
        t0 = time.perf_counter()
        tokens_cached = analyze_tokens(sent)
        t_duration = time.perf_counter() - t0

        assert len(tokens) == len(tokens_cached)
        assert t_duration < 0.05

    def test_grammar_yaml_catalog_loading(self):
        rule = get_rule_by_id("aller_infinitif")
        assert rule is not None
        assert rule.id == "aller_infinitif"
        assert rule.formula == "Sujet + aller (présent de l'indicatif) + verbe à l'infinitif"
        assert rule.description_vi is not None
        assert rule.description_en is not None
        assert len(rule.examples_correct) > 0
        assert len(rule.examples_incorrect) > 0
