import { describe, expect, it } from 'vitest';
import {
  addAttempt,
  attemptFromResult,
  errorSegments,
  errorSuggestionType,
  historyRules,
  locateSpan,
  MAX_PRACTICE_HISTORY,
  parseHistory,
  parsePracticeResponse,
  type PracticeAttempt,
} from '../practice';
import { submitPractice, type FetchFn } from '../backend';

/** Backend reply for "Tu va partir demain." (rule check only: LLM unavailable). */
const RULES_ONLY = {
  is_correct: false,
  uses_target_construct: true,
  score: 60,
  status: 'minor_issues',
  errors: [
    { span: 'va', type: 'conjugation', explanation_vi: 'Động từ phụ chia chưa chuẩn.', suggestion: 'Cần chia đúng ngôi' },
    { span: 'Tu va partir demain.', type: 'missing_construct', explanation_vi: 'x', suggestion: 'Sujet + aller' },
  ],
  corrected_sentence: null,
  short_comment: 'Đánh giá bởi bộ luật hình thức (LLM hiện không khả dụng).',
  diff_tokens: [],
  rule_check: { subject_token: 'tu', auxiliary_token: 'va', infinitive_token: 'partir', pattern_matched: true },
  llm_unavailable: true,
};

describe('locateSpan', () => {
  it('finds a span case-insensitively, not the whole sentence', () => {
    expect(locateSpan('Tu va partir.', 'VA')).toEqual({ start: 3, end: 5 });
    expect(locateSpan('Tu va partir.', 'Tu va partir.')).toBeNull();
    expect(locateSpan('Tu va partir.', 'absent')).toBeNull();
    expect(locateSpan('Tu va partir.', ' ')).toBeNull();
  });
});

describe('parsePracticeResponse', () => {
  it('reads a rule-check-only reply: no AI feedback, errors located', () => {
    const r = parsePracticeResponse(RULES_ONLY, 'Tu va partir demain.', 'futur_proche')!;
    expect(r.isCorrect).toBe(false);
    expect(r.usesConstruct).toBe(true);
    expect(r.aiFeedback).toBe(false);
    expect(r.errors[0]).toMatchObject({ span: 'va', type: 'conjugation', start: 3, end: 5 });
    expect(r.errors[1]).toMatchObject({ start: null, end: null });
    expect(r.check).toEqual({ subject: 'tu', auxiliary: 'va', infinitive: 'partir' });
    expect(r.corrected).toBeNull();
  });

  it('counts only a real model as AI feedback, hides a correction equal to the sentence', () => {
    const base = { ...RULES_ONLY, llm_unavailable: false, corrected_sentence: 'Tu vas partir demain.' };
    expect(parsePracticeResponse({ ...base, llm_provider: 'mock' }, 'Tu va partir demain.', 'x')!.aiFeedback).toBe(false);
    const ai = parsePracticeResponse({ ...base, llm_provider: 'openai' }, 'Tu va partir demain.', 'x')!;
    expect(ai.aiFeedback).toBe(true);
    expect(ai.corrected).toBe('Tu vas partir demain.');
    expect(parsePracticeResponse({ ...base, corrected_sentence: 'Ok.' }, 'Ok.', 'x')!.corrected).toBeNull();
  });

  it('rejects other replies', () => {
    expect(parsePracticeResponse({ detail: 'x' }, 's', 'r')).toBeNull();
    expect(parsePracticeResponse(null, 's', 'r')).toBeNull();
  });
});

describe('errorSegments', () => {
  it('cuts the sentence around located errors, overlaps keep the first', () => {
    const r = parsePracticeResponse(
      { ...RULES_ONLY, errors: [{ span: 'partir', type: 'infinitive' }, { span: 'va', type: 'conjugation' }, { span: 'va partir', type: 'x' }] },
      'Tu va partir demain.',
      'r'
    )!;
    expect(errorSegments(r.sentence, r.errors).map((s) => [s.text, s.error?.type ?? null])).toEqual([
      ['Tu ', null],
      ['va', 'conjugation'],
      [' ', null],
      ['partir', 'infinitive'],
      [' demain.', null],
    ]);
  });

  it('maps error types to the grammar check colours', () => {
    expect(errorSuggestionType('spelling')).toBe('spelling');
    expect(errorSuggestionType('conjugation')).toBe('grammar');
  });
});

describe('history', () => {
  const req = { sentence: 'Tu va partir demain.', ruleId: 'futur_proche', ruleName: 'Futur proche', sourceUrl: 'https://ex.fr/a', sourceTitle: 'A' };
  const result = parsePracticeResponse(RULES_ONLY, req.sentence, req.ruleId)!;

  it('keeps sentence, rule, result and source page', () => {
    const a = attemptFromResult(result, req, 1000);
    expect(a).toMatchObject({
      createdAt: 1000,
      ruleId: 'futur_proche',
      ruleName: 'Futur proche',
      sentence: 'Tu va partir demain.',
      isCorrect: false,
      usesConstruct: true,
      sourceUrl: 'https://ex.fr/a',
      sourceTitle: 'A',
      aiFeedback: false,
    });
    expect(a.errors[0]).toEqual({ span: 'va', type: 'conjugation', suggestion: 'Cần chia đúng ngôi' });
  });

  it('adds newest first, caps, drops malformed items, lists structures for the filter', () => {
    let h: PracticeAttempt[] = [];
    for (let i = 0; i < MAX_PRACTICE_HISTORY + 3; i++) h = addAttempt(h, attemptFromResult(result, req, i));
    expect(h).toHaveLength(MAX_PRACTICE_HISTORY);
    expect(h[0].createdAt).toBe(MAX_PRACTICE_HISTORY + 2);
    expect(parseHistory([h[0], { id: 1 }, null, 'x'])).toEqual([h[0]]);
    expect(parseHistory('x')).toEqual([]);
    const other = attemptFromResult(result, { ...req, ruleId: 'negation', ruleName: 'Négation' }, 5);
    expect(historyRules([h[0], h[1], other])).toEqual([
      { id: 'futur_proche', name: 'Futur proche', count: 2 },
      { id: 'negation', name: 'Négation', count: 1 },
    ]);
  });
});

describe('submitPractice', () => {
  const req = { sentence: '  Tu va\n partir demain. ', ruleId: 'futur_proche', ruleName: 'Futur proche', sourceUrl: null, sourceTitle: null };

  it('posts user_sentence and target_rule_id', async () => {
    let body = '';
    const fetchFn: FetchFn = async (url, init) => {
      expect(url).toBe('http://b/api/practice/submit');
      body = String(init?.body);
      return new Response(JSON.stringify(RULES_ONLY));
    };
    const reply = await submitPractice('http://b', req, fetchFn);
    expect(JSON.parse(body)).toEqual({ user_sentence: 'Tu va partir demain.', target_rule_id: 'futur_proche', target_rule_name: 'Futur proche' });
    expect(reply.status).toBe('ok');
  });

  it('reports a stopped backend and errors', async () => {
    expect(await submitPractice('http://b', req, async () => Promise.reject(new TypeError('x')))).toEqual({ status: 'unreachable', backendUrl: 'http://b' });
    expect(await submitPractice('http://b', req, async () => new Response('{"detail":"boom"}', { status: 500 }))).toMatchObject({
      status: 'error',
      httpStatus: 500,
      message: 'boom',
    });
  });
});
