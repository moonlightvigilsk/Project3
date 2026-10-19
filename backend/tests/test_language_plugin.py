from typing import List, Optional, Tuple
from app.services.language_engine.base import BaseLanguageEngine
from app.services.language_engine.registry import LanguageRegistry, get_language_registry
from app.services.spacy_engine.engine import FrenchGrammarEngine, get_grammar_engine
from app.services.spacy_engine.models import SentenceAnalysis, PatternMatchResult
from app.services.grammar_catalog.catalog import GrammarRuleMetadata


class MockSpanishLanguageEngine(BaseLanguageEngine):
    """Example implementation of a second language plugin (Spanish) to prove extensibility."""

    @property
    def language_code(self) -> str:
        return "es"

    @property
    def language_name(self) -> str:
        return "Spanish (Español)"

    @property
    def spacy_model_name(self) -> str:
        return "es_core_news_md"

    def analyze_sentence(self, sentence_text: str) -> SentenceAnalysis:
        lower = sentence_text.lower()
        return SentenceAnalysis(
            text=sentence_text,
            tokens=[],
            matches=[],
            matched_rule_ids=["futuro_proximo"] if "voy a" in lower else [],
        )

    def check_target_rule(
        self, sentence_text: str, rule_id: str
    ) -> Tuple[bool, Optional[PatternMatchResult]]:
        lower = sentence_text.lower()
        if rule_id == "futuro_proximo" and "voy a" in lower:
            return True, PatternMatchResult(
                rule_id="futuro_proximo",
                rule_name="Futuro próximo",
                matched_text="voy a",
                start_char=0,
                end_char=5,
                matched_token_indices=[0, 1],
            )
        return False, None

    def segment_into_sentences(self, full_text: str) -> List[str]:
        return [s.strip() for s in full_text.split(".") if s.strip()]

    def get_rule_metadata(self, rule_id: str) -> Optional[GrammarRuleMetadata]:
        return None

    def list_all_rules(self) -> List[GrammarRuleMetadata]:
        return []


def test_language_registry_registration_and_retrieval():
    registry = LanguageRegistry()
    french = FrenchGrammarEngine()
    spanish = MockSpanishLanguageEngine()

    registry.register(french)
    registry.register(spanish)

    # Test retrieval by code
    assert registry.get_engine("fr").language_name == "French (Français)"
    assert registry.get_engine("es").language_name == "Spanish (Español)"

    # Test supported languages listing
    supported = registry.list_supported_languages()
    assert len(supported) == 2
    codes = [l["code"] for l in supported]
    assert "fr" in codes
    assert "es" in codes


def test_french_engine_implements_base_contract():
    engine = get_grammar_engine()
    assert isinstance(engine, BaseLanguageEngine)
    assert engine.language_code == "fr"
    assert engine.spacy_model_name == "fr_core_news_md"

    rules = engine.list_all_rules()
    assert len(rules) >= 7

    meta = engine.get_rule_metadata("futur_proche")
    assert meta is not None
    assert meta.id == "futur_proche"


def test_mock_spanish_plugin_extension():
    spanish = MockSpanishLanguageEngine()
    analysis = spanish.analyze_sentence("Voy a comer una manzana.")
    assert "futuro_proximo" in analysis.matched_rule_ids

    matched, res = spanish.check_target_rule("Voy a comer una manzana.", "futuro_proximo")
    assert matched is True
    assert res is not None
    assert res.rule_id == "futuro_proximo"
