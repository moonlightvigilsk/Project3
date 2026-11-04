import type { SuggestionType } from '@/types';

/**
 * "Write a sentence" (US-19): the learner writes a sentence with the structure of the
 * grammar card; the backend grades it (`POST /api/practice/submit`: spaCy check of the
 * structure, then the backend's LLM, which may be unavailable or a mock).
 */

export interface PracticeError {
  /** Wrong part of the sentence, as given by the backend. */
  span: string;
  /** "conjugation", "infinitive", "missing_construct", "spelling"... */
  type: string;
  /** Vietnamese explanation of the backend. */
  explanation: string;
  suggestion: string;
  /** Place of `span` in the sentence; null when not found or when it is the whole sentence. */
  start: number | null;
  end: number | null;
}

export interface PracticeResult {
  sentence: string;
  ruleId: string;
  isCorrect: boolean;
  usesConstruct: boolean;
  errors: PracticeError[];
  /** Null when the backend has no correction (or the sentence is already right). */
  corrected: string | null;
  comment: string;
  /** Feedback written by a real model; false for the rule check alone or the mock provider. */
  aiFeedback: boolean;
  /** Facts of the structure check, to explain errors in the interface language. */
  check: { subject: string | null; auxiliary: string | null; infinitive: string | null };
}

export type PracticeReply =
  | { status: 'ok'; result: PracticeResult }
  | { status: 'unreachable'; backendUrl: string }
  | { status: 'error'; backendUrl: string; httpStatus: number | null; message: string };

/** Content script -> background. Payload `PracticeRequest`, reply `{ success, reply: PracticeReply }`. */
export const PRACTICE_SUBMIT = 'PRACTICE_SUBMIT';

export interface PracticeRequest {
  sentence: string;
  ruleId: string;
  ruleName: string;
  /** Page the learner was reading (saved with the attempt). */
  sourceUrl: string | null;
  sourceTitle: string | null;
}

/** Longest sentence the backend accepts. */
export const MAX_PRACTICE_CHARS = 1000;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Place of `span` in `sentence` (case-insensitive), not counting spans covering the whole sentence. */
export function locateSpan(sentence: string, span: string): { start: number; end: number } | null {
  const s = span.trim();
  if (!s || s.length >= sentence.trim().length) return null;
  const i = sentence.toLowerCase().indexOf(s.toLowerCase());
  return i >= 0 ? { start: i, end: i + s.length } : null;
}

/** Backend reply -> result. Null when it is not a practice result. */
export function parsePracticeResponse(raw: unknown, sentence: string, ruleId: string): PracticeResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.is_correct !== 'boolean') return null;
  const errors: PracticeError[] = [];
  if (Array.isArray(r.errors)) {
    for (const e of r.errors) {
      if (!e || typeof e !== 'object') continue;
      const x = e as Record<string, unknown>;
      const span = str(x.span);
      const where = locateSpan(sentence, span);
      errors.push({
        span,
        type: str(x.type) || 'grammar',
        explanation: str(x.explanation_vi),
        suggestion: str(x.suggestion),
        start: where?.start ?? null,
        end: where?.end ?? null,
      });
    }
  }
  const check = (r.rule_check && typeof r.rule_check === 'object' ? r.rule_check : {}) as Record<string, unknown>;
  const corrected = str(r.corrected_sentence);
  const provider = str(r.llm_provider);
  return {
    sentence,
    ruleId,
    isCorrect: r.is_correct,
    usesConstruct: r.uses_target_construct === true,
    errors,
    corrected: corrected && corrected !== sentence.trim() ? corrected : null,
    comment: str(r.short_comment),
    aiFeedback: r.llm_unavailable !== true && !!provider && provider !== 'mock',
    check: {
      subject: str(check.subject_token) || null,
      auxiliary: str(check.auxiliary_token) || null,
      infinitive: str(check.infinitive_token) || null,
    },
  };
}

/** Underline colour family of an error, as in the grammar check (getSuggestionColor). */
export function errorSuggestionType(type: string): SuggestionType {
  if (type === 'spelling' || type === 'punctuation' || type === 'style') return type;
  return 'grammar';
}

/** Sentence cut into plain text and error spans (overlaps: the first error wins). */
export function errorSegments(sentence: string, errors: PracticeError[]): { text: string; error: PracticeError | null }[] {
  const located = errors
    .filter((e): e is PracticeError & { start: number; end: number } => e.start !== null && e.end !== null)
    .sort((a, b) => a.start - b.start);
  const out: { text: string; error: PracticeError | null }[] = [];
  let at = 0;
  for (const e of located) {
    if (e.start < at) continue;
    if (e.start > at) out.push({ text: sentence.slice(at, e.start), error: null });
    out.push({ text: sentence.slice(e.start, e.end), error: e });
    at = e.end;
  }
  if (at < sentence.length) out.push({ text: sentence.slice(at), error: null });
  return out;
}

// --- history (storage.local) ----------------------------------------------------

/** One attempt, as kept in the practice history (popup "Practice history"). */
export interface PracticeAttempt {
  id: string;
  createdAt: number;
  ruleId: string;
  ruleName: string;
  sentence: string;
  isCorrect: boolean;
  usesConstruct: boolean;
  corrected: string | null;
  comment: string;
  errors: { span: string; type: string; suggestion: string }[];
  aiFeedback: boolean;
  sourceUrl: string | null;
  sourceTitle: string | null;
}

export const PRACTICE_HISTORY_KEY = 'practiceHistory';
export const MAX_PRACTICE_HISTORY = 500;

export function attemptFromResult(result: PracticeResult, req: PracticeRequest, now = Date.now()): PracticeAttempt {
  return {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    ruleId: req.ruleId,
    ruleName: req.ruleName,
    sentence: result.sentence,
    isCorrect: result.isCorrect,
    usesConstruct: result.usesConstruct,
    corrected: result.corrected,
    comment: result.comment,
    errors: result.errors.map((e) => ({ span: e.span, type: e.type, suggestion: e.suggestion })),
    aiFeedback: result.aiFeedback,
    sourceUrl: req.sourceUrl,
    sourceTitle: req.sourceTitle,
  };
}

/** Stored history, newest first; anything malformed is dropped. */
export function parseHistory(stored: unknown): PracticeAttempt[] {
  if (!Array.isArray(stored)) return [];
  return stored.filter(
    (a): a is PracticeAttempt =>
      !!a && typeof a === 'object' && typeof a.id === 'string' && typeof a.sentence === 'string' && typeof a.ruleId === 'string' && typeof a.createdAt === 'number'
  );
}

/** History with `attempt` added first, capped. */
export function addAttempt(history: PracticeAttempt[], attempt: PracticeAttempt): PracticeAttempt[] {
  return [attempt, ...history.filter((a) => a.id !== attempt.id)].slice(0, MAX_PRACTICE_HISTORY);
}

/** Structures found in the history (for the filter), by name. */
export function historyRules(history: PracticeAttempt[]): { id: string; name: string; count: number }[] {
  const map = new Map<string, { id: string; name: string; count: number }>();
  for (const a of history) {
    const r = map.get(a.ruleId) ?? { id: a.ruleId, name: a.ruleName || a.ruleId, count: 0 };
    r.count++;
    map.set(a.ruleId, r);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
