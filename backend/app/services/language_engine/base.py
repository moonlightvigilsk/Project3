from abc import ABC, abstractmethod
from typing import List, Optional, Tuple, Dict, Any
from app.services.spacy_engine.models import SentenceAnalysis, PatternMatchResult
from app.services.grammar_catalog.catalog import GrammarRuleMetadata


class BaseLanguageEngine(ABC):
    """Abstract Base Class for language-specific grammar engines and rule matchers.
    
    Any new language (e.g. Spanish, German, Japanese) can be plugged in by
    implementing this contract and registering itself in the LanguageRegistry.
    """

    @property
    @abstractmethod
    def language_code(self) -> str:
        """ISO 639-1 language code (e.g. 'fr', 'es', 'de')."""
        pass

    @property
    @abstractmethod
    def language_name(self) -> str:
        """Human-readable language name (e.g. 'French (Français)')."""
        pass

    @property
    @abstractmethod
    def spacy_model_name(self) -> str:
        """spaCy pipeline package name (e.g. 'fr_core_news_md')."""
        pass

    @abstractmethod
    def analyze_sentence(self, sentence_text: str) -> SentenceAnalysis:
        """Analyze sentence syntax, token morphology, and check all registered grammar rules."""
        pass

    @abstractmethod
    def check_target_rule(
        self, sentence_text: str, rule_id: str
    ) -> Tuple[bool, Optional[PatternMatchResult]]:
        """Verify presence of a specific grammar pattern in the sentence."""
        pass

    @abstractmethod
    def segment_into_sentences(self, full_text: str) -> List[str]:
        """Segment a paragraph or document into grammatically well-formed sentences."""
        pass

    @abstractmethod
    def get_rule_metadata(self, rule_id: str) -> Optional[GrammarRuleMetadata]:
        """Retrieve pedagogical rule metadata, formula, and conjugation tables."""
        pass

    @abstractmethod
    def list_all_rules(self) -> List[GrammarRuleMetadata]:
        """List all available grammar rules for this language."""
        pass
