from typing import Dict, List, Optional
from app.services.language_engine.base import BaseLanguageEngine


class LanguageRegistry:
    """Registry managing available language plugins."""

    def __init__(self) -> None:
        self._engines: Dict[str, BaseLanguageEngine] = {}
        self._default_lang: str = "fr"

    def register(self, engine: BaseLanguageEngine) -> None:
        """Register a language engine implementation."""
        code = engine.language_code.lower().strip()
        self._engines[code] = engine

    def get_engine(self, language_code: Optional[str] = None) -> BaseLanguageEngine:
        """Retrieve the language engine by code or fallback to default."""
        code = (language_code or self._default_lang).lower().strip()
        if code not in self._engines:
            # Fallback to default if requested language is not yet registered
            if self._default_lang in self._engines:
                return self._engines[self._default_lang]
            raise KeyError(f"Language engine for '{code}' is not registered.")
        return self._engines[code]

    def set_default_language(self, language_code: str) -> None:
        """Set active default language."""
        self._default_lang = language_code.lower().strip()

    def list_supported_languages(self) -> List[Dict[str, str]]:
        """Return list of supported languages."""
        return [
            {
                "code": engine.language_code,
                "name": engine.language_name,
                "spacy_model": engine.spacy_model_name,
            }
            for engine in self._engines.values()
        ]


_registry_instance: Optional[LanguageRegistry] = None


def get_language_registry() -> LanguageRegistry:
    """Singleton getter for LanguageRegistry."""
    global _registry_instance
    if _registry_instance is None:
        _registry_instance = LanguageRegistry()
    return _registry_instance
