import json
import logging
import re
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
import httpx

logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "dict_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Curated local definitions for frequent French words to ensure instantaneous offline lookup
LOCAL_FRENCH_DICTIONARY: Dict[str, Dict[str, Any]] = {
    "visiter": {
        "pos": "VERB",
        "definition": "Aller voir un lieu, un monument ou une personne par curiosité, intérêt ou amitié.",
        "definition_vi": "Đến thăm, tham quan (một địa điểm, di tích hoặc người quen).",
        "ipa": "/vi.zi.te/",
    },
    "ami": {
        "pos": "NOUN",
        "definition": "Personne avec laquelle on est lié par une affection réciproque.",
        "definition_vi": "Bạn bè, người bạn thân thiết.",
        "ipa": "/a.mi/",
    },
    "partir": {
        "pos": "VERB",
        "definition": "Quitter un lieu pour aller ailleurs; se mettre en route.",
        "definition_vi": "Rời đi, khởi hành, bắt đầu chuyến đi.",
        "ipa": "/paʁ.tiʁ/",
    },
    "aller": {
        "pos": "VERB",
        "definition": "Se déplacer d'un point vers un autre; servir de semi-auxiliaire du futur proche.",
        "definition_vi": "Đi, di chuyển; trợ động từ cho thì tương lai gần.",
        "ipa": "/a.le/",
    },
    "manger": {
        "pos": "VERB",
        "definition": "Avaler pour se nourrir un aliment solide ou consistant.",
        "definition_vi": "Ăn (thức ăn).",
        "ipa": "/mɑ̃.ʒe/",
    },
    "apprendre": {
        "pos": "VERB",
        "definition": "Acquérir la connaissance d'une matière, d'un art, d'une langue.",
        "definition_vi": "Học tập, tiếp thu kiến thức.",
        "ipa": "/a.pʁɑ̃dʁ/",
    },
    "comprendre": {
        "pos": "VERB",
        "definition": "Saisir par l'esprit, se rendre compte de la signification.",
        "definition_vi": "Hiểu, nắm bắt ý nghĩa.",
        "ipa": "/kɔ̃.pʁɑ̃dʁ/",
    },
    "voyager": {
        "pos": "VERB",
        "definition": "Faire un voyage, se rendre dans des contrées lointaines.",
        "definition_vi": "Du lịch, đi xa.",
        "ipa": "/vwa.ja.ʒe/",
    },
    "lire": {
        "pos": "VERB",
        "definition": "Prendre connaissance du contenu d'un écrit.",
        "definition_vi": "Đọc (sách báo, văn bản).",
        "ipa": "/liʁ/",
    },
    "livre": {
        "pos": "NOUN",
        "definition": "Volume imprimé ou manuscrit relié ou broché.",
        "definition_vi": "Cuốn sách, tác phẩm.",
        "ipa": "/livʁ/",
    },
    "demain": {
        "pos": "ADV",
        "definition": "Le jour qui suit immédiatement aujourd'hui.",
        "definition_vi": "Ngày mai.",
        "ipa": "/də.mɛ̃/",
    },
    "hier": {
        "pos": "ADV",
        "definition": "Le jour qui a précédé immédiatement aujourd'hui.",
        "definition_vi": "Hôm qua.",
        "ipa": "/jɛʁ/",
    },
    "maison": {
        "pos": "NOUN",
        "definition": "Bâtiment servant de logis, d'habitation.",
        "definition_vi": "Ngôi nhà, nhà ở.",
        "ipa": "/mɛ.zɔ̃/",
    },
    "temps": {
        "pos": "NOUN",
        "definition": "Durée indéfinie où se déroulent les événements; état de l'atmosphère.",
        "definition_vi": "Thời gian; thời tiết.",
        "ipa": "/tɑ̃/",
    },
    "beau": {
        "pos": "ADJ",
        "definition": "Qui suscite un plaisir esthétique ou moral; agréable.",
        "definition_vi": "Đẹp, rực rỡ, tốt lành.",
        "ipa": "/bo/",
    },
}


def _cache_path(key: str) -> Path:
    safe_key = re.sub(r"[^\w\-]", "_", key.lower())
    return CACHE_DIR / f"{safe_key}.json"


def _read_disk_cache(key: str) -> Optional[Dict[str, Any]]:
    path = _cache_path(key)
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return None
    return None


def _write_disk_cache(key: str, data: Dict[str, Any]) -> None:
    try:
        path = _cache_path(key)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        logger.warning(f"Failed to write dictionary disk cache for {key}: {e}")


def _parse_wiktionary_extract(extract: str) -> Optional[str]:
    """Extract clean concise first French definition from Wiktionary explaintext."""
    if not extract:
        return None
    lines = extract.split("\n")
    found_verb_or_noun = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("===") and any(pos in stripped for pos in ("Verbe", "Nom", "Adjectif", "Adverbe")):
            found_verb_or_noun = True
            continue
        if found_verb_or_noun and stripped and not stripped.startswith("=") and not stripped.startswith("=== "):
            # If line is a numbered definition: e.g. "1. ..." or "# ..."
            clean_def = re.sub(r"^(\d+\.|\#)\s*", "", stripped).strip()
            if len(clean_def) > 10 and not clean_def.startswith("Du latin") and not clean_def.startswith("Voir"):
                return clean_def
    return None


async def lookup_wiktionary_api(word: str) -> Optional[str]:
    """Query French Wiktionary Action API with User-Agent."""
    url = "https://fr.wiktionary.org/w/api.php"
    params = {
        "action": "query",
        "titles": word,
        "prop": "extracts",
        "explaintext": "true",
        "format": "json",
    }
    headers = {"User-Agent": "FrenchLearningTool/1.0 (educational tool)"}
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url, params=params, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                pages = data.get("query", {}).get("pages", {})
                for page_id, page_info in pages.items():
                    if page_id != "-1":
                        extract = page_info.get("extract", "")
                        clean_def = _parse_wiktionary_extract(extract)
                        if clean_def:
                            return clean_def
    except Exception as e:
        logger.debug(f"Wiktionary online lookup failed for '{word}': {e}")
    return None


async def lookup_definition(word: str, lemma: str, pos: Optional[str] = None) -> Dict[str, Any]:
    """Lookup definition using multi-tier strategy:
    1. Disk cache
    2. Curated local dictionary (instant, reliable)
    3. French Wiktionary API (cached upon success)
    4. Fallback default
    """
    lookup_key = (lemma or word).lower().strip()

    # 1. Disk Cache
    cached = _read_disk_cache(lookup_key)
    if cached:
        return cached

    # 2. Local Curated Dictionary
    if lookup_key in LOCAL_FRENCH_DICTIONARY:
        data = {
            "lemma": lookup_key,
            "word": word,
            "pos": LOCAL_FRENCH_DICTIONARY[lookup_key].get("pos", pos),
            "definition": LOCAL_FRENCH_DICTIONARY[lookup_key]["definition"],
            "definition_vi": LOCAL_FRENCH_DICTIONARY[lookup_key].get("definition_vi"),
            "ipa": LOCAL_FRENCH_DICTIONARY[lookup_key].get("ipa"),
            "source": "local_dictionary",
        }
        _write_disk_cache(lookup_key, data)
        return data

    # 3. Wiktionary API
    online_def = await lookup_wiktionary_api(lookup_key)
    if online_def:
        data = {
            "lemma": lookup_key,
            "word": word,
            "pos": pos,
            "definition": online_def,
            "definition_vi": None,
            "ipa": None,
            "source": "wiktionary_fr",
        }
        _write_disk_cache(lookup_key, data)
        return data

    # 4. Fallback
    data = {
        "lemma": lookup_key,
        "word": word,
        "pos": pos,
        "definition": f"Définition pour le lemme '{lookup_key}'.",
        "definition_vi": None,
        "ipa": None,
        "source": "fallback",
    }
    _write_disk_cache(lookup_key, data)
    return data
