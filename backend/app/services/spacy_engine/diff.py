import difflib
from typing import List, Dict, Optional, Any
from pydantic import BaseModel


class DiffToken(BaseModel):
    """Token representation of an inline difference between user sentence and correction."""

    type: str  # "same" | "replaced" | "added" | "removed"
    text: Optional[str] = None
    original: Optional[str] = None
    replacement: Optional[str] = None


def compute_sentence_diff(user_sentence: str, corrected_sentence: Optional[str]) -> List[DiffToken]:
    """Calculate word-level diff between learner input and teacher correction."""
    if not corrected_sentence or user_sentence.strip() == corrected_sentence.strip():
        return [DiffToken(type="same", text=w) for w in user_sentence.strip().split()]

    w1 = user_sentence.strip().split()
    w2 = corrected_sentence.strip().split()
    matcher = difflib.SequenceMatcher(None, w1, w2)
    diffs: List[DiffToken] = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for w in w1[i1:i2]:
                diffs.append(DiffToken(type="same", text=w))
        elif tag == "replace":
            diffs.append(
                DiffToken(
                    type="replaced",
                    original=" ".join(w1[i1:i2]),
                    replacement=" ".join(w2[j1:j2]),
                )
            )
        elif tag == "delete":
            diffs.append(DiffToken(type="removed", text=" ".join(w1[i1:i2])))
        elif tag == "insert":
            diffs.append(DiffToken(type="added", text=" ".join(w2[j1:j2])))

    return diffs
