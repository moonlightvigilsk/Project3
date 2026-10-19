from typing import List
from spacy.tokens import Doc
from app.services.spacy_engine.matchers.base import BaseRuleMatcher
from app.services.spacy_engine.models import PatternMatchResult

IMPARFAIT_ENDINGS = ("ais", "ait", "ions", "iez", "aient")
SUBJECT_PRONOUNS = {"je", "j'", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles"}
PRESENT_IRREGULAR_EXCLUSIONS = {"fait", "sait", "doit", "voit", "veut", "peut", "croit", "met", "plaît"}
CONDITIONAL_STEMS = ("ser", "aur", "ir", "fer", "devr", "voudr", "pourr", "saur", "faudr", "aimer")


class ImparfaitMatcher(BaseRuleMatcher):
    """Detects verbs in Imparfait de l'indicatif."""

    @property
    def rule_id(self) -> str:
        return "imparfait"

    @property
    def rule_name(self) -> str:
        return "Imparfait de l'indicatif"

    def match(self, doc: Doc) -> List[PatternMatchResult]:
        matches: List[PatternMatchResult] = []

        for token in doc:
            tok_lower = token.text.lower()

            # Must not be conditionnel
            if token.morph.get("Mood") == ["Cnd"]:
                continue
            if any(tok_lower.startswith(stem) for stem in CONDITIONAL_STEMS) and tok_lower.endswith(IMPARFAIT_ENDINGS):
                continue
            if tok_lower in PRESENT_IRREGULAR_EXCLUSIONS:
                continue

            # Check 1: Explicit morphological tag
            is_imp_morph = token.morph.get("Tense") == ["Imp"]

            # Check 2: Inflectional ending and verbal context
            is_verb_context = token.pos_ in ("VERB", "AUX") or token.dep_ == "ROOT"
            has_subject_preceding = False

            if token.i > 0:
                prev_tok = doc[token.i - 1].text.lower()
                if prev_tok in SUBJECT_PRONOUNS:
                    has_subject_preceding = True

            for child in token.children:
                if child.dep_ in ("nsubj", "nsubj:pass") or child.text.lower() in SUBJECT_PRONOUNS:
                    has_subject_preceding = True
                    break

            is_imp_ending = tok_lower.endswith(IMPARFAIT_ENDINGS) and (is_verb_context or has_subject_preceding)

            if is_imp_morph or is_imp_ending:
                matches.append(
                    PatternMatchResult(
                        rule_id=self.rule_id,
                        rule_name=self.rule_name,
                        matched_text=token.text,
                        start_char=token.idx,
                        end_char=token.idx + len(token.text),
                        matched_token_indices=[token.i],
                        confidence=0.9,
                        notes=f"Verbe à l'imparfait: {token.text} (lemme: {token.lemma_})",
                    )
                )

        return matches
