from typing import List
from spacy.tokens import Doc
from app.services.spacy_engine.matchers.base import BaseRuleMatcher
from app.services.spacy_engine.models import PatternMatchResult

ALLER_PRES_FORMS = {"vais", "vas", "va", "allons", "allez", "vont"}


class FuturProcheMatcher(BaseRuleMatcher):
    """Detects 'aller (présent) + infinitif' (Futur proche)."""

    @property
    def rule_id(self) -> str:
        return "futur_proche"

    @property
    def rule_name(self) -> str:
        return "Futur proche (aller + infinitif)"

    def match(self, doc: Doc) -> List[PatternMatchResult]:
        matches: List[PatternMatchResult] = []

        for i, token in enumerate(doc):
            is_aller = token.lemma_ == "aller" or token.text.lower() in ALLER_PRES_FORMS
            is_pres = (
                token.morph.get("Tense") == ["Pres"]
                or token.text.lower() in ALLER_PRES_FORMS
            )

            if is_aller and is_pres:
                # Look for associated infinitive
                inf_token = None

                # 1. Check dependency tree children
                for child in token.children:
                    if child.morph.get("VerbForm") == ["Inf"] or (
                        child.pos_ == "VERB"
                        and child.text.lower().endswith(("er", "ir", "re"))
                    ):
                        inf_token = child
                        break

                # 2. If not found in children, check linear window (1-4 tokens ahead)
                if not inf_token:
                    for j in range(i + 1, min(i + 5, len(doc))):
                        candidate = doc[j]
                        if candidate.morph.get("VerbForm") == ["Inf"] or (
                            candidate.pos_ == "VERB"
                            and candidate.text.lower().endswith(("er", "ir", "re"))
                        ):
                            inf_token = candidate
                            break

                if inf_token and inf_token.i > token.i:
                    start_tok = token
                    end_tok = inf_token
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
                            confidence=0.95,
                            notes=f"Aller ({token.text}) + Infinitif ({inf_token.text})",
                        )
                    )

        return matches
