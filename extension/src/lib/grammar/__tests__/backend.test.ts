import { describe, expect, it, vi } from 'vitest';
import {
  AnalysisCache,
  analyzeWithBackend,
  backendUrlOrDefault,
  buildAnalysis,
  checkBackend,
  normalizeBackendUrl,
  normalizeSentence,
  parseRules,
  RuleCatalog,
  type FetchFn,
} from '../backend';
import { sentenceSegments, spansOf } from '../segments';
import type { GrammarAnalysis } from '../types';

const SENTENCE = 'Demain, je ne vais pas le faire.';

/** Backend reply as produced by FrenchGrammarEngine.analyze_sentence. */
const RAW = {
  text: SENTENCE,
  tokens: [],
  matches: [
    { rule_id: 'negation', rule_name: 'Négation', matched_text: 'ne vais pas', start_char: 11, end_char: 22, matched_token_indices: [3, 4, 5] },
    { rule_id: 'futur_proche', rule_name: 'Futur proche', matched_text: 'vais pas le faire', start_char: 14, end_char: 31, matched_token_indices: [4, 7] },
    { rule_id: 'pronoms_cod_coi', rule_name: 'Pronoms', matched_text: 'le', start_char: 23, end_char: 25, matched_token_indices: [6] },
  ],
  matched_rule_ids: ['futur_proche', 'negation', 'pronoms_cod_coi'],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('normalizeBackendUrl', () => {
  it('accepts host:port, trailing slashes and an /api suffix', () => {
    expect(normalizeBackendUrl('http://127.0.0.1:8000')).toBe('http://127.0.0.1:8000');
    expect(normalizeBackendUrl(' 127.0.0.1:8000/ ')).toBe('http://127.0.0.1:8000');
    expect(normalizeBackendUrl('http://localhost:8000/api/')).toBe('http://localhost:8000');
    expect(normalizeBackendUrl('https://example.org/tools/api')).toBe('https://example.org/tools');
  });

  it('rejects other schemes, credentials and garbage', () => {
    expect(normalizeBackendUrl('')).toBeNull();
    expect(normalizeBackendUrl('ftp://host')).toBeNull();
    expect(normalizeBackendUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeBackendUrl('http://user:pw@host')).toBeNull();
    expect(normalizeBackendUrl('http://')).toBeNull();
    expect(backendUrlOrDefault('nope://x')).toBe('http://127.0.0.1:8000');
  });
});

describe('normalizeSentence', () => {
  it('collapses whitespace (also non-breaking) and trims', () => {
    expect(normalizeSentence('  Je\n vais partir.  ')).toBe('Je vais partir.');
    expect(normalizeSentence('a'.repeat(2500)).length).toBe(2000);
  });
});

describe('buildAnalysis', () => {
  it('keeps one structure per rule, in order of appearance, with levels from the catalog', () => {
    const rules = parseRules([{ id: 'negation', name: 'Négation (ne ... pas)', level: 'A1-A2' }]);
    const a = buildAnalysis(SENTENCE, RAW, rules);
    expect(a.structures.map((s) => s.ruleId)).toEqual(['negation', 'futur_proche', 'pronoms_cod_coi']);
    expect(a.structures[0]).toMatchObject({ name: 'Négation (ne ... pas)', level: 'A1-A2' });
    // Not in the rule list: backend name, level of the shipped catalog.
    expect(a.structures[1]).toMatchObject({ name: 'Futur proche', level: 'A1-A2' });
    expect(a.structures[2].level).toBe('A2-B1');
    expect(a.structures[2].spans).toEqual([{ start: 23, end: 25, text: 'le' }]);
  });

  it('groups several matches of a rule and drops duplicates', () => {
    const s = 'Il ne mange pas et ne boit pas.';
    const raw = {
      matches: [
        { rule_id: 'negation', matched_text: 'ne boit pas', start_char: 19, end_char: 30 },
        { rule_id: 'negation', matched_text: 'ne mange pas', start_char: 3, end_char: 15 },
        { rule_id: 'negation', matched_text: 'ne mange pas', start_char: 3, end_char: 15 },
      ],
    };
    const [neg] = buildAnalysis(s, raw).structures;
    expect(neg.spans.map((x) => x.text)).toEqual(['ne mange pas', 'ne boit pas']);
  });

  it('repairs offsets that do not fit the sentence, drops unusable matches', () => {
    const s = 'Je vais partir.';
    const raw = {
      matches: [
        { rule_id: 'aller_infinitif', matched_text: 'vais partir', start_char: 40, end_char: 51 },
        { rule_id: 'imparfait', matched_text: 'absent', start_char: 90, end_char: 96 },
        { rule_id: 7, matched_text: 'Je' },
        null,
      ],
    };
    const a = buildAnalysis(s, raw);
    expect(a.structures).toHaveLength(1);
    // aller_infinitif is the catalog alias of futur_proche.
    expect(a.structures[0]).toMatchObject({ ruleId: 'futur_proche', spans: [{ start: 3, end: 14, text: 'vais partir' }] });
  });

  it('handles a reply without matches', () => {
    expect(buildAnalysis('x', { matches: [] }).structures).toEqual([]);
    expect(buildAnalysis('x', null).structures).toEqual([]);
  });
});

describe('analyzeWithBackend', () => {
  it('posts the sentence and returns the analysis', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchFn: FetchFn = async (url, init) => {
      calls.push({ url, init });
      return url.endsWith('/rules') ? json([{ id: 'negation', name: 'Négation', level: 'A1' }]) : json(RAW);
    };
    const reply = await analyzeWithBackend('http://127.0.0.1:8000', SENTENCE, fetchFn, new RuleCatalog(fetchFn));
    expect(reply.status).toBe('ok');
    if (reply.status !== 'ok') return;
    expect(reply.analysis.structures[0].level).toBe('A1');
    const post = calls.find((c) => c.url === 'http://127.0.0.1:8000/api/grammar/analyze')!;
    expect(post.init?.method).toBe('POST');
    expect(JSON.parse(String(post.init?.body))).toEqual({ sentence: SENTENCE });
    expect(post.init?.credentials).toBe('omit');
  });

  it('still answers when the rule list fails', async () => {
    const fetchFn: FetchFn = async (url) => (url.endsWith('/rules') ? json({ detail: 'x' }, 500) : json(RAW));
    const reply = await analyzeWithBackend('http://b', SENTENCE, fetchFn, new RuleCatalog(fetchFn));
    expect(reply.status).toBe('ok');
  });

  it('reports a backend that is not running', async () => {
    const fetchFn: FetchFn = async () => {
      throw new TypeError('Failed to fetch');
    };
    expect(await analyzeWithBackend('http://127.0.0.1:8000', SENTENCE, fetchFn)).toEqual({
      status: 'unreachable',
      backendUrl: 'http://127.0.0.1:8000',
    });
  });

  it('reports HTTP errors with the FastAPI detail, and replies that are not an analysis', async () => {
    const e500 = await analyzeWithBackend('http://b', SENTENCE, async () => json({ detail: "Can't find model 'fr_core_news_md'" }, 500));
    expect(e500).toEqual({ status: 'error', backendUrl: 'http://b', httpStatus: 500, message: "Can't find model 'fr_core_news_md'" });
    const other = await analyzeWithBackend('http://b', SENTENCE, async () => json({ hello: 'world' }));
    expect(other).toMatchObject({ status: 'error', message: 'not a grammar analysis' });
    const html = await analyzeWithBackend('http://b', SENTENCE, async () => new Response('<html>', { status: 200 }));
    expect(html).toMatchObject({ status: 'error', message: 'invalid JSON' });
  });

  it('times out', async () => {
    vi.useFakeTimers();
    try {
      const fetchFn: FetchFn = (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      const pending = analyzeWithBackend('http://b', SENTENCE, fetchFn);
      await vi.advanceTimersByTimeAsync(16_000);
      expect(await pending).toMatchObject({ status: 'error', message: 'timeout' });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('checkBackend', () => {
  it('counts the rules of a grammar backend', async () => {
    expect(await checkBackend('http://b', async () => json([{ id: 'a' }, { id: 'b' }]))).toEqual({ status: 'ok', rules: 2 });
  });
  it('tells unreachable from wrong servers', async () => {
    expect(await checkBackend('http://b', async () => Promise.reject(new TypeError('x')))).toEqual({ status: 'unreachable' });
    expect(await checkBackend('http://b', async () => json({ detail: 'Not Found' }, 404))).toEqual({
      status: 'error',
      httpStatus: 404,
      message: 'Not Found',
    });
    expect(await checkBackend('http://b', async () => json({ a: 1 }))).toMatchObject({ status: 'error', message: 'not a grammar backend' });
  });
});

describe('RuleCatalog', () => {
  it('reads the rule list once per backend', async () => {
    const fetchFn = vi.fn(async () => json([{ id: 'negation', name: 'N', level: 'A1' }]));
    const catalog = new RuleCatalog(fetchFn);
    await catalog.get('http://a');
    await catalog.get('http://a');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect((await catalog.get('http://a')).get('negation')).toEqual({ name: 'N', level: 'A1' });
  });
});

describe('AnalysisCache', () => {
  const analysis = (sentence: string): GrammarAnalysis => ({ sentence, structures: [] });

  it('keys by backend and sentence, drops the least recently used', async () => {
    const cache = new AnalysisCache(null, 2);
    await cache.set('http://a', 'un', analysis('un'));
    await cache.set('http://a', 'deux', analysis('deux'));
    expect(await cache.get('http://b', 'un')).toBeNull();
    expect(await cache.get('http://a', 'un')).toEqual(analysis('un')); // "un" used: "deux" is now the oldest
    await cache.set('http://a', 'trois', analysis('trois'));
    expect(await cache.get('http://a', 'deux')).toBeNull();
    expect(await cache.get('http://a', 'un')).not.toBeNull();
  });

  it('survives a restart through its storage area', async () => {
    const store = new Map<string, unknown>();
    const area = { get: async (k: string) => store.get(k), set: async (k: string, v: unknown) => void store.set(k, v) };
    await new AnalysisCache(area).set('http://a', 'phrase', analysis('phrase'));
    expect(await new AnalysisCache(area).get('http://a', 'phrase')).toEqual(analysis('phrase'));
  });

  it('ignores a broken storage area', async () => {
    const area = { get: async () => 'garbage', set: async () => Promise.reject(new Error('quota')) };
    const cache = new AnalysisCache(area);
    await cache.set('http://a', 'x', analysis('x'));
    expect(await cache.get('http://a', 'x')).toEqual(analysis('x'));
  });
});

describe('sentenceSegments', () => {
  it('cuts the sentence at overlapping spans of several structures', () => {
    const { structures } = buildAnalysis(SENTENCE, RAW);
    const segs = sentenceSegments(SENTENCE, structures);
    expect(segs.map((s) => s.text).join('')).toBe(SENTENCE);
    expect(segs).toEqual([
      { text: 'Demain, je ', ruleIds: [] },
      { text: 'ne ', ruleIds: ['negation'] },
      { text: 'vais pas', ruleIds: ['negation', 'futur_proche'] },
      { text: ' ', ruleIds: ['futur_proche'] },
      { text: 'le', ruleIds: ['futur_proche', 'pronoms_cod_coi'] },
      { text: ' faire', ruleIds: ['futur_proche'] },
      { text: '.', ruleIds: [] },
    ]);
  });

  it('lists the spans of one structure or of all', () => {
    const { structures } = buildAnalysis(SENTENCE, RAW);
    expect(spansOf(structures, 'pronoms_cod_coi').map((s) => s.text)).toEqual(['le']);
    expect(spansOf(structures, null)).toHaveLength(3);
  });
});
