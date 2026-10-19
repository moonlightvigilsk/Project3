from typing import List
from spacy.tokens import Doc
from app.services.spacy_engine.matchers.base import BaseRuleMatcher
from app.services.spacy_engine.models import PatternMatchResult

CND_STEMS = ("voudr", "pourr", "aimer", "aur", "ser", "ir", "fer", "devr", "saur", "faudr")
CND_ENDINGS = ("ais", "ait", "ions", "iez", "aient")


class ConditionnelMatcher(BaseRuleMatcher):
    """Detects verbs in Conditionnel présent."""

    @property
    def rule_id(self) -> str:
        return "conditionnel_present"

    @property
    def rule_name(self) -> str:
        return "Conditionnel présent"

    def match(self, doc: Doc) -> List[PatternMatchResult]:
        matches: List[PatternMatchResult] = []

        for token in doc:
            if token.pos_ not in ("VERB", "AUX"):
                continue

            tok_lower = token.text.lower()
            is_cnd_morph = token.morph.get("Mood") == ["Cnd"]
            is_cnd_stem = any(tok_lower.startswith(stem) for stem in CND_STEMS) and tok_lower.endswith(CND_ENDINGS)

            if is_cnd_morph or is_cnd_stem:
                matches.append(
                    PatternMatchResult(
                        rule_id=self.rule_id,
                        rule_name=self.rule_name,
                        matched_text=token.text,
                        start_char=token.idx,
                        end_char=token.idx + len(token.text),
                        matched_token_indices=[token.i],
                        confidence=0.95,
                        notes=f"Verbe au conditionnel: {token.text} (lemme: {token.lemma_})",
                    )
                )

        return matches
