import logging
from typing import Optional, Tuple
from spacy.tokens import Doc
from app.services.spacy_engine.engine import get_grammar_engine
from app.services.grammar_catalog.catalog import get_rule_by_id
from app.schemas.llm import RuleCheckResult

logger = logging.getLogger(__name__)

ALLER_PRES_SUBJECT_MAP = {
    # 1st singular
    ("je", "vais"): True,
    ("j'", "vais"): True,
    ("moi", "vais"): True,
    # 2nd singular
    ("tu", "vas"): True,
    # 3rd singular
    ("il", "va"): True,
    ("elle", "va"): True,
    ("on", "va"): True,
    # 1st plural
    ("nous", "allons"): True,
    # 2nd plural
    ("vous", "allez"): True,
    # 3rd plural
    ("ils", "vont"): True,
    ("elles", "vont"): True,
}


def check_verb_subject_agreement(doc: Doc, aller_token) -> Tuple[bool, Optional[str]]:
    """Verify if 'aller' matches its grammatical subject in person and number."""
    subject_text = None
    aller_text = aller_token.text.lower()

    # Search for nsubj among children or preceding tokens
    for child in aller_token.children:
        if child.dep_ in ("nsubj", "nsubj:pass"):
            subject_text = child.text.lower()
            break

    if not subject_text:
        # Check token immediately before (allowing clitics/adverbs)
        for i in range(aller_token.i - 1, -1, -1):
            cand = doc[i]
            if cand.dep_ in ("nsubj", "nsubj:pass") or cand.pos_ in ("PRON", "NOUN", "PROPN"):
                subject_text = cand.text.lower()
                break

    if not subject_text:
        # Default True if impersonal or imperative/subject not found
        return True, None

    # Clean pronoun apostrophe e.g. j'
    norm_sub = subject_text.replace("’", "'")

    # 1. Direct table match
    if (norm_sub, aller_text) in ALLER_PRES_SUBJECT_MAP:
        return True, subject_text

    # 2. Check spaCy morphology agreement if pronoun or noun
    sub_num = None
    sub_per = None
    for token in doc:
        if token.text.lower() == subject_text:
            num = token.morph.get("Number")
            per = token.morph.get("Person")
            if num:
                sub_num = num[0]
            if per:
                sub_per = per[0]
            break

    aller_num = aller_token.morph.get("Number")
    aller_per = aller_token.morph.get("Person")

    # If subject is 1st person and verb is not 1st person -> Mismatch
    if norm_sub in ("je", "j'", "moi") and aller_text != "vais":
        return False, subject_text
    if norm_sub in ("tu", "toi") and aller_text != "vas":
        return False, subject_text
    if norm_sub in ("il", "elle", "on") and aller_text != "va":
        return False, subject_text
    if norm_sub in ("nous",) and aller_text != "allons":
        return False, subject_text
    if norm_sub in ("vous",) and aller_text != "allez":
        return False, subject_text
    if norm_sub in ("ils", "elles") and aller_text != "vont":
        return False, subject_text

    # Noun subjects (singular -> va, plural -> vont)
    if sub_num == "Sing" and aller_text not in ("va", "vais", "vas"):
        return False, subject_text
    if sub_num == "Plur" and aller_text not in ("vont", "allons", "allez"):
        return False, subject_text

    return True, subject_text


def verify_sentence_by_rules(sentence_text: str, target_rule_id: str) -> RuleCheckResult:
    """Step (a) in grading pipeline:
    Check deterministically with spaCy fr_core_news_md:
    1. Does sentence contain the target construct (DependencyMatcher)?
    2. Is the auxiliary conjugated correctly with the subject?
    3. Is the main verb in infinitive form?
    """
    engine = get_grammar_engine()
    doc = engine.nlp(sentence_text.strip())
    rule_meta = get_rule_by_id(target_rule_id)
    rule_name = rule_meta.name if rule_meta else target_rule_id

    # 1. DependencyMatcher check
    pattern_matched, match_res = engine.check_target_rule(sentence_text, target_rule_id)

    auxiliary_correct = False
    main_verb_infinitive = False
    subject_token = None
    auxiliary_token = None
    infinitive_token = None
    matched_span = match_res.matched_text if match_res else None
    notes = match_res.notes if match_res else None

    # Detect aller token
    aller_tok = None
    for token in doc:
        if token.lemma_ == "aller" or token.text.lower() in ("vais", "vas", "va", "allons", "allez", "vont", "allait", "alle"):
            aller_tok = token
            break

    if aller_tok:
        auxiliary_token = aller_tok.text
        # Check subject agreement
        is_agreed, sub = check_verb_subject_agreement(doc, aller_tok)
        auxiliary_correct = is_agreed
        subject_token = sub

        # Check main verb infinitive
        # Search for any verb with VerbForm=Inf following or as child
        for child in aller_tok.children:
            vf = child.morph.get("VerbForm")
            if (vf and "Inf" in vf) or (child.pos_ == "VERB" and child.text.lower().endswith(("er", "ir", "re")) and not child.text.lower().endswith(("ez", "ons", "ent", "ais", "ait"))):
                main_verb_infinitive = True
                infinitive_token = child.text
                break

        if not main_verb_infinitive:
            for j in range(aller_tok.i + 1, min(aller_tok.i + 5, len(doc))):
                cand = doc[j]
                vf = cand.morph.get("VerbForm")
                if (vf and "Inf" in vf) or (cand.pos_ == "VERB" and cand.text.lower().endswith(("er", "ir", "re")) and not cand.text.lower().endswith(("ez", "ons", "ent", "ais", "ait"))):
                    main_verb_infinitive = True
                    infinitive_token = cand.text
                    break
    else:
        auxiliary_correct = False
        main_verb_infinitive = False

    return RuleCheckResult(
        target_rule_id=target_rule_id,
        target_rule_name=rule_name,
        pattern_matched=pattern_matched,
        auxiliary_correct=auxiliary_correct,
        main_verb_infinitive=main_verb_infinitive,
        subject_token=subject_token,
        auxiliary_token=auxiliary_token,
        infinitive_token=infinitive_token,
        matched_span=matched_span,
        rule_notes=notes,
    )
