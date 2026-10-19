from typing import List
from spacy.tokens import Doc
from app.services.spacy_engine.matchers.base import BaseRuleMatcher
from app.services.spacy_engine.models import PatternMatchResult

SUBJ_FORMS = {
    "fasse", "fasses", "fassions", "fassiez", "fassent",
    "soit", "sois", "soyons", "soyez", "soient",
    "ait", "aies", "ayons", "ayez", "aient",
    "puisse", "puisses", "puissions", "puissiez", "puissent",
    "vienne", "viennes", "venions", "veniez", "viennent",
    "sache", "saches", "sachions", "sachiez", "sachent",
    "veuille", "veuilles", "voulions", "vouliez", "veuillent",
    "aille", "ailles", "allions", "alliez", "aillent",
}

SUBJ_TRIGGER_VERBS = {
    "falloir", "souhaiter", "vouloir", "douter", "craindre",
    "aimer", "exiger", "préférer", "demander", "ordonner",
}


class SubjonctifMatcher(BaseRuleMatcher):
    """Detects verbs in Subjonctif présent and subjunctive trigger clauses."""

    @property
    def rule_id(self) -> str:
        return "subjonctif_present"

    @property
    def rule_name(self) -> str:
        return "Subjonctif présent"

    def match(self, doc: Doc) -> List[PatternMatchResult]:
        matches: List[PatternMatchResult] = []

        for token in doc:
            if token.pos_ not in ("VERB", "AUX"):
                continue

            tok_lower = token.text.lower()
            is_subj_morph = token.morph.get("Mood") == ["Sub"]
            is_subj_form = tok_lower in SUBJ_FORMS

            # Check if this verb is governed by a subjunctive trigger clause (e.g. que + souhaiter/falloir)
            is_subj_clause = False
            has_que = False
            for j in range(max(0, token.i - 5), token.i):
                if doc[j].text.lower() in ("que", "qu'"):
                    has_que = True
                    break

            if has_que:
                # Triggered if head is a subjunctive trigger verb (e.g. souhaiter, falloir)
                if token.head.lemma_ in SUBJ_TRIGGER_VERBS or token.dep_ == "ccomp":
                    is_subj_clause = True

            if is_subj_morph or is_subj_form or is_subj_clause:
                # Find leading 'que' or 'qu\'' for clear span highlight
                start_tok = token
                for j in range(max(0, token.i - 5), token.i):
                    if doc[j].text.lower() in ("que", "qu'"):
                        start_tok = doc[j]
                        break

                span_text = doc[start_tok.i : token.i + 1].text
                matched_indices = list(range(start_tok.i, token.i + 1))

                matches.append(
                    PatternMatchResult(
                        rule_id=self.rule_id,
                        rule_name=self.rule_name,
                        matched_text=span_text,
                        start_char=start_tok.idx,
                        end_char=token.idx + len(token.text),
                        matched_token_indices=matched_indices,
                        confidence=0.95,
                        notes=f"Subjonctif ({token.text}) déclenché dans la proposition",
                    )
                )

        return matches
