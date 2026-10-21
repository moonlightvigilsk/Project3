import hashlib
import json
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any

from app.services.spacy_engine.loader import get_nlp
from app.services.spacy_engine.models import TokenAnalysis

logger = logging.getLogger(__name__)

# Persistent cache directory
CACHE_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "nlp_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# In-memory cache (LRU up to 1024 entries)
_memory_cache: Dict[str, List[dict]] = {}
_MAX_MEMORY_CACHE = 1024


def compute_sentence_hash(text: str) -> str:
    """Compute deterministic SHA-256 hash for a given French sentence."""
    normalized = " ".join(text.strip().split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _load_from_disk(cache_key: str) -> Optional[List[dict]]:
    cache_file = CACHE_DIR / f"{cache_key}.json"
    if cache_file.exists():
        try:
            return json.loads(cache_file.read_text(encoding="utf-8"))
        except Exception as e:
            logger.warning(f"Error reading disk cache {cache_key}: {e}")
    return None


def _save_to_disk(cache_key: str, data: List[dict]) -> None:
    cache_file = CACHE_DIR / f"{cache_key}.json"
    try:
        cache_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        logger.warning(f"Error saving disk cache {cache_key}: {e}")


def analyze_tokens(text: str) -> List[TokenAnalysis]:
    """Tokenize and parse a French sentence with spaCy 'fr_core_news_md'.
    
    Returns token list with (text, lemma, pos, morph, dep, head_text).
    Cached by sentence hash (in-memory + disk).
    """
    clean_text = text.strip()
    if not clean_text:
        return []

    cache_key = compute_sentence_hash(clean_text)

    # 1. In-memory check
    if cache_key in _memory_cache:
        return [TokenAnalysis(**item) for item in _memory_cache[cache_key]]

    # 2. Disk cache check
    disk_data = _load_from_disk(cache_key)
    if disk_data is not None:
        _memory_cache[cache_key] = disk_data
        return [TokenAnalysis(**item) for item in disk_data]

    # 3. Process with spaCy fr_core_news_md
    nlp = get_nlp()
    doc = nlp(clean_text)

    tokens: List[TokenAnalysis] = []
    for token in doc:
        tokens.append(
            TokenAnalysis(
                index=token.i,
                text=token.text,
                lemma=token.lemma_,
                pos=token.pos_,
                dep=token.dep_,
                morph=dict(token.morph.to_dict()),
                head_text=token.head.text,
                is_stop=token.is_stop,
            )
        )

    # Cache result
    serialized = [t.model_dump() for t in tokens]
    if len(_memory_cache) >= _MAX_MEMORY_CACHE:
        oldest = next(iter(_memory_cache))
        del _memory_cache[oldest]
    _memory_cache[cache_key] = serialized
    _save_to_disk(cache_key, serialized)

    return tokens
