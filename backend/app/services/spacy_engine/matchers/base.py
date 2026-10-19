from abc import ABC, abstractmethod
from typing import List
from spacy.tokens import Doc
from app.services.spacy_engine.models import PatternMatchResult


class BaseRuleMatcher(ABC):
    """Abstract base class for a specific grammar rule matcher."""

    @property
    @abstractmethod
    def rule_id(self) -> str:
        pass

    @property
    @abstractmethod
    def rule_name(self) -> str:
        pass

    @abstractmethod
    def match(self, doc: Doc) -> List[PatternMatchResult]:
        """Analyze a spaCy Doc and return matches if pattern is present."""
        pass
