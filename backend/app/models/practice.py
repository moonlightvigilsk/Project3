from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from app.core.database import Base


class PracticeSession(Base):
    """Record of a learner's active sentence production and evaluation."""

    __tablename__ = "practice_sessions"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(String(64), nullable=False, index=True)
    user_sentence = Column(Text, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    target_pattern_matched = Column(Boolean, nullable=False)
    score = Column(Integer, default=0)
    corrected_sentence = Column(Text, nullable=True)
    feedback_json = Column(Text, nullable=True)  # JSON-encoded feedback details
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
