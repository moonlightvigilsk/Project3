from typing import List
from spacy.tokens import Doc
from app.services.spacy_engine.matchers.base import BaseRuleMatcher
from app.services.spacy_engine.models import PatternMatchResult

AUX_LEMMAS = {"avoir", "être"}
AUX_PRES_FORMS = {
    "ai", "as", "a", "avons", "avez", "ont",
    "suis", "es", "est", "sommes", "êtes", "sont",
}
PARTICIPLE_ENDINGS = (
    "é", "ée", "és", "ées",
    "i", "is", "it",
    "u", "ue", "ues", "us",
    "ert", "erts", "mis", "fait", "faits", "dit", "dits", "écrit", "écrits", "pris", "mort", "morts", "né", "nés",
)


class PasseComposeMatcher(BaseRuleMatcher):
    """Detects 'avoir / être (présent) + participe passé' (Passé composé)."""

    @property
    def rule_id(self) -> str:
        return "passe_compose"

    @property
    def rule_name(self) -> str:
        return "Passé composé (avoir/être + participe passé)"

    def match(self, doc: Doc) -> List[PatternMatchResult]:
        matches: List[PatternMatchResult] = []

        for i, token in enumerate(doc):
            # Check if this token acts as an auxiliary (avoir / être in present)
            is_aux = (
                token.lemma_ in AUX_LEMMAS or token.text.lower() in AUX_PRES_FORMS
            ) and (token.pos_ in ("AUX", "VERB") or token.text.lower() in AUX_PRES_FORMS)

            if is_aux:
                # Look ahead 1-3 tokens for the past participle
                participle_token = None
                for j in range(i + 1, min(i + 4, len(doc))):
                    cand = doc[j]
                    cand_lower = cand.text.lower()

                    # Valid participle if:
                    # 1. Morphologically tagged as Participle
                    # 2. Or ends with common French past participle suffix and is VERB, ADJ, or NOUN (e.g. partis, fait)
                    is_part = (
                        cand.morph.get("VerbForm") == ["Part"]
                        or (
                            cand.pos_ in ("VERB", "ADJ", "NOUN")
                            and cand_lower.endswith(PARTICIPLE_ENDINGS)
                        )
                    )

                    if is_part and cand.pos_ != "PUNCT":
                        participle_token = cand
                        break

                if participle_token:
                    start_tok = token
                    end_tok = participle_token
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
                            notes=f"Auxiliaire ({token.text}) + Participe ({participle_token.text})",
                        )
                    )

        return matches
