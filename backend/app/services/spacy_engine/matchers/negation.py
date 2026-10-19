from typing import List
from spacy.tokens import Doc
from app.services.spacy_engine.matchers.base import BaseRuleMatcher
from app.services.spacy_engine.models import PatternMatchResult

NEG_WORDS = {"pas", "jamais", "rien", "plus", "aucun", "aucune", "personne", "point", "guère"}


class NegationMatcher(BaseRuleMatcher):
    """Detects standard negation (ne ... pas/jamais/rien/plus/aucun)."""

    @property
    def rule_id(self) -> str:
        return "negation"

    @property
    def rule_name(self) -> str:
        return "Négation (ne ... pas / jamais / rien / plus)"

    def match(self, doc: Doc) -> List[PatternMatchResult]:
        matches: List[PatternMatchResult] = []

        for i, token in enumerate(doc):
            tok_lower = token.text.lower()
            is_ne = tok_lower in ("ne", "n'") or token.morph.get("Polarity") == ["Neg"]

            if is_ne and tok_lower in ("ne", "n'"):
                # Search ahead within a window of 6 tokens for the complementary negation word
                neg_partner = None
                for j in range(i + 1, min(i + 7, len(doc))):
                    cand = doc[j]
                    if cand.text.lower() in NEG_WORDS or (
                        cand.morph.get("Polarity") == ["Neg"] and cand.text.lower() not in ("ne", "n'")
                    ):
                        neg_partner = cand
                        break

                if neg_partner:
                    start_tok = token
                    end_tok = neg_partner
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
                            confidence=0.98,
                            notes=f"Structure négative: {token.text} ... {neg_partner.text}",
                        )
                    )

        return matches
