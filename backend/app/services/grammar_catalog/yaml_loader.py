import logging
from pathlib import Path
from typing import Dict, Any, List
import yaml

from app.services.grammar_catalog.catalog import GrammarRuleMetadata

logger = logging.getLogger(__name__)

# Directory pointing to /grammar/fr
GRAMMAR_DIR = Path(__file__).resolve().parent.parent.parent.parent / "grammar" / "fr"


def load_yaml_rules() -> Dict[str, GrammarRuleMetadata]:
    """Load all *.yaml grammar rules from grammar/fr/ directory."""
    rules: Dict[str, GrammarRuleMetadata] = {}
    if not GRAMMAR_DIR.exists():
        return rules

    for file_path in GRAMMAR_DIR.glob("*.yaml"):
        try:
            content = file_path.read_text(encoding="utf-8")
            data = yaml.safe_load(content)
            if not isinstance(data, dict):
                continue

            rule_id = data.get("id") or file_path.stem

            # Flatten examples if list of dict
            examples_raw = data.get("examples_correct", [])
            examples_list = []
            for ex in examples_raw:
                if isinstance(ex, dict):
                    examples_list.append(ex.get("text", ""))
                elif isinstance(ex, str):
                    examples_list.append(ex)

            desc = data.get("description_vi") or data.get("description_en") or data.get("description", "")

            rule_meta = GrammarRuleMetadata(
                id=rule_id,
                name=data.get("name", rule_id),
                category=data.get("category", "Général"),
                level=data.get("level", "A1"),
                formula=data.get("formula", ""),
                description=desc,
                description_vi=data.get("description_vi"),
                description_en=data.get("description_en"),
                key_points=data.get("key_points", []),
                conjugation_table=data.get("conjugation_table", {}),
                examples=examples_list,
                examples_correct=data.get("examples_correct", []),
                examples_incorrect=data.get("examples_incorrect", []),
                keywords=data.get("keywords", []),
                spacy_pattern=data.get("spacy_pattern"),
                spacy_observation=data.get("spacy_observation"),
            )
            rules[rule_id] = rule_meta
            # Also register alias if applicable
            if rule_id == "aller_infinitif":
                rules["futur_proche"] = rule_meta.model_copy(update={"id": "futur_proche"})
            elif rule_id == "futur_proche":
                rules["aller_infinitif"] = rule_meta.model_copy(update={"id": "aller_infinitif"})
        except Exception as e:
            logger.warning(f"Failed to load grammar rule YAML from {file_path}: {e}")

    return rules
