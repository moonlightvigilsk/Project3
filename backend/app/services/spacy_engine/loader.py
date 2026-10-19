import logging
from typing import Optional
import spacy
from spacy.language import Language

logger = logging.getLogger(__name__)

_nlp_instance: Optional[Language] = None


def get_nlp(model_name: str = "fr_core_news_md") -> Language:
    """Return a singleton spaCy French language pipeline.

    Falls back to blank French model with sentencizer if full model is unavailable.
    """
    global _nlp_instance
    if _nlp_instance is not None:
        return _nlp_instance

    try:
        logger.info(f"Loading spaCy model: {model_name}")
        _nlp_instance = spacy.load(model_name)
    except Exception as exc:
        logger.warning(
            f"Failed to load '{model_name}': {exc}. Attempting download or falling back to blank French."
        )
        try:
            spacy.cli.download(model_name)
            _nlp_instance = spacy.load(model_name)
        except Exception:
            _nlp_instance = spacy.blank("fr")
            if "sentencizer" not in _nlp_instance.pipe_names:
                _nlp_instance.add_pipe("sentencizer")

    return _nlp_instance
