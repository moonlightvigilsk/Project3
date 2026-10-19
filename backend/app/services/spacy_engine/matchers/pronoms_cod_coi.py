from typing import List
from spacy.tokens import Doc
from app.services.spacy_engine.matchers.base import BaseRuleMatcher
from app.services.spacy_engine.models import PatternMatchResult

CLITIC_PRONOUNS = {"le", "la", "les", "l'", "lui", "leur", "y", "en", "me", "m'", "te", "t'", "se", "s'"}


class PronomsCodCoiMatcher(BaseRuleMatcher):
    """Detects COD/COI clitic object pronouns placed before verbs."""

    @property
    def rule_id(self) -> str:
        return "pronoms_cod_coi"

    @property
    def rule_name(self) -> str:
        return "Pronoms compléments COD & COI"

    def match(self, doc: Doc) -> List[PatternMatchResult]:
        matches: List[PatternMatchResult] = []

        for i, token in enumerate(doc):
            tok_lower = token.text.lower()

            if tok_lower in CLITIC_PRONOUNS:
                # Distinguish pronoun from article (le, la, les as DET)
                if token.pos_ == "DET":
                    continue

                # Must precede a verb/aux within 1-2 positions (allowing chained pronouns: "Je le lui donne")
                verb_target = None
                for j in range(i + 1, min(i + 3, len(doc))):
                    cand = doc[j]
                    if cand.pos_ in ("VERB", "AUX"):
                        verb_target = cand
                        break

                if verb_target:
                    start_tok = token
                    end_tok = verb_target
                    span_text = doc[start_tok.i : end_tok.i + 1].text
                    matched_indices = list(range(start_tok.i, end_tok.i + 1))

                    matches.append(
                        PatternMatchResult(
                            rule_id=self.rule_id,
                            rule_name=self.rule_name,
                            matched_text=span_text,
                            start_char=start_tok.idx,
                            end_char=end_tok.idx + len(end_tok.text),
                            matched_token_indices=matched_indices,
                            confidence=0.92,
                            notes=f"Pronom ({token.text}) placé devant le verbe ({verb_target.text})",
                        )
                    )

        return matches
