from typing import List, Optional, Tuple, Dict
from spacy.language import Language

from app.services.spacy_engine.loader import get_nlp
from app.services.spacy_engine.models import (
    TokenAnalysis,
    PatternMatchResult,
    SentenceAnalysis,
)
from app.services.spacy_engine.matchers.base import BaseRuleMatcher
from app.services.spacy_engine.matchers.futur_proche import FuturProcheMatcher
from app.services.spacy_engine.matchers.passe_compose import PasseComposeMatcher
from app.services.spacy_engine.matchers.imparfait import ImparfaitMatcher
from app.services.spacy_engine.matchers.negation import NegationMatcher
from app.services.spacy_engine.matchers.pronoms_cod_coi import PronomsCodCoiMatcher
from app.services.spacy_engine.matchers.conditionnel import ConditionnelMatcher
from app.services.spacy_engine.matchers.subjonctif import SubjonctifMatcher

from app.services.language_engine.base import BaseLanguageEngine
from app.services.language_engine.registry import get_language_registry
from app.services.grammar_catalog.catalog import (
    GrammarRuleMetadata,
    get_rule_by_id,
    list_all_rules,
)


class FrenchGrammarEngine(BaseLanguageEngine):
    """French implementation of BaseLanguageEngine.
    
    Orchestrates French NLP tokenization, dependency parsing, and grammar matching
    via spaCy 'fr_core_news_md' and rule matcher plugins.
    """

    def __init__(self, nlp: Optional[Language] = None) -> None:
        self.nlp = nlp or get_nlp()
        self.matchers: List[BaseRuleMatcher] = [
            FuturProcheMatcher(),
            PasseComposeMatcher(),
            ImparfaitMatcher(),
            NegationMatcher(),
            PronomsCodCoiMatcher(),
            ConditionnelMatcher(),
            SubjonctifMatcher(),
        ]
        self._matchers_by_id: Dict[str, BaseRuleMatcher] = {
            m.rule_id: m for m in self.matchers
        }
        # Support aliases
        if "aller_infinitif" in self._matchers_by_id:
            self._matchers_by_id["futur_proche"] = self._matchers_by_id["aller_infinitif"]
        elif "futur_proche" in self._matchers_by_id:
            self._matchers_by_id["aller_infinitif"] = self._matchers_by_id["futur_proche"]

    @property
    def language_code(self) -> str:
        return "fr"

    @property
    def language_name(self) -> str:
        return "French (Français)"

    @property
    def spacy_model_name(self) -> str:
        return "fr_core_news_md"

    def analyze_sentence(self, sentence_text: str) -> SentenceAnalysis:
        """Run full linguistic token analysis and check all grammar rules."""
        clean_text = sentence_text.strip()
        doc = self.nlp(clean_text)

        tokens: List[TokenAnalysis] = [
            TokenAnalysis(
                index=t.i,
                text=t.text,
                lemma=t.lemma_,
                pos=t.pos_,
                dep=t.dep_,
                morph=dict(t.morph.to_dict()),
                head_text=t.head.text,
                is_stop=t.is_stop,
            )
            for t in doc
        ]

        matches: List[PatternMatchResult] = []
        matched_rule_ids: List[str] = []

        for matcher in self.matchers:
            rule_matches = matcher.match(doc)
            if rule_matches:
                matches.extend(rule_matches)
                if matcher.rule_id not in matched_rule_ids:
                    matched_rule_ids.append(matcher.rule_id)

        return SentenceAnalysis(
            text=clean_text,
            tokens=tokens,
            matches=matches,
            matched_rule_ids=matched_rule_ids,
        )

    def check_target_rule(
        self, sentence_text: str, rule_id: str
    ) -> Tuple[bool, Optional[PatternMatchResult]]:
        """Verify whether a specific grammar rule is present in the sentence."""
        rule_key = rule_id.lower().strip()
        matcher = self._matchers_by_id.get(rule_key)
        if not matcher:
            return False, None

        doc = self.nlp(sentence_text.strip())
        matches = matcher.match(doc)
        if matches:
            return True, matches[0]
        return False, None

    def segment_into_sentences(self, full_text: str) -> List[str]:
        """Split a long text or paragraph into well-formed French sentences."""
        if not full_text or not full_text.strip():
            return []
        doc = self.nlp(full_text)
        return [sent.text.strip() for sent in doc.sents if sent.text.strip()]

    def get_rule_metadata(self, rule_id: str) -> Optional[GrammarRuleMetadata]:
        return get_rule_by_id(rule_id)

    def list_all_rules(self) -> List[GrammarRuleMetadata]:
        return list_all_rules()


_engine_instance: Optional[FrenchGrammarEngine] = None


def get_grammar_engine() -> FrenchGrammarEngine:
    """Return singleton instance of FrenchGrammarEngine and register in LanguageRegistry."""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = FrenchGrammarEngine()
        get_language_registry().register(_engine_instance)
    return _engine_instance
