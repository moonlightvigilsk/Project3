from typing import List, Optional
from spacy.tokens import Doc
from app.services.spacy_engine.matchers.base import BaseRuleMatcher
from app.services.spacy_engine.models import PatternMatchResult

ALLER_PRES_FORMS = {"vais", "vas", "va", "allons", "allez", "vont"}


class FuturProcheMatcher(BaseRuleMatcher):
    """Detects 'aller (présent) + infinitif' (Futur proche).
    
    Based on empirical spaCy 'fr_core_news_md' observations:
    - Aller in present indicative (dep=ROOT/aux, lemma='aller', Tense=Pres, VerbForm=Fin)
    - Directly linked infinitive verb via dep='xcomp' with VerbForm=Inf
    - Fallback: linear window where intervening words are adverbs/pronouns,
      STRICTLY requiring VerbForm=Inf (excluding finite verbs like 'a' in 'vais à').
    """

    @property
    def rule_id(self) -> str:
        return "futur_proche"

    @property
    def rule_name(self) -> str:
        return "Futur proche (aller + infinitif)"

    def match(self, doc: Doc) -> List[PatternMatchResult]:
        matches: List[PatternMatchResult] = []

        for i, token in enumerate(doc):
            # Check if token is aller conjugated in present indicative
            is_aller = token.lemma_ == "aller" or token.text.lower() in ALLER_PRES_FORMS
            tense = token.morph.get("Tense")
            verb_form = token.morph.get("VerbForm")

            is_pres = (
                ("Pres" in tense if tense else False)
                or token.text.lower() in ALLER_PRES_FORMS
            )
            # Must not be imparfait (e.g. allait) or subjunctive/participle
            if tense and "Imp" in tense:
                continue

            if not (is_aller and is_pres):
                continue

            inf_token = None

            # 1. Primary Strategy: Check dependency tree children for xcomp with VerbForm=Inf
            for child in token.children:
                child_vf = child.morph.get("VerbForm")
                if child.dep_ in ("xcomp", "obj", "dep") and child_vf and "Inf" in child_vf:
                    inf_token = child
                    break
                # If child is VERB and has VerbForm=Inf regardless of dep
                if child_vf and "Inf" in child_vf:
                    inf_token = child
                    break

            # 2. Fallback: Check right siblings or children of children (e.g. negation or clitics)
            if not inf_token:
                for j in range(i + 1, min(i + 5, len(doc))):
                    candidate = doc[j]
                    cand_vf = candidate.morph.get("VerbForm")
                    # STRICT check: must have VerbForm=Inf.
                    # Do NOT accept if candidate has VerbForm=Fin (e.g., 'a' in 'Je vais à Hanoi' parsed as AUX VerbForm=Fin)
                    if cand_vf and "Inf" in cand_vf:
                        inf_token = candidate
                        break
                    # If candidate is a preposition (à, de, pour) and not infinitive, do not jump over unless followed by Inf
                    if candidate.pos_ == "ADP" and j + 1 < len(doc):
                        next_cand = doc[j + 1]
                        next_vf = next_cand.morph.get("VerbForm")
                        if next_vf and "Inf" in next_vf:
                            inf_token = next_cand
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
                        confidence=0.98,
                        notes=f"Aller ({token.text}) + Infinitif ({inf_token.text})",
                    )
                )

        return matches
