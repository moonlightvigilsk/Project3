import {
  DEFAULT_BACKEND_URL,
  type AnalyzeGrammarReply,
  type BackendCheckReply,
  type DetectedStructure,
  type GrammarAnalysis,
  type GrammarSpan,
} from './types';
import { parseRule, type GrammarRuleDetail, type GrammarRuleReply } from './rule';
import { MAX_PRACTICE_CHARS, parsePracticeResponse, type PracticeReply, type PracticeRequest, type PracticeResult } from './practice';

/**
 * Client of the grammar backend (US-17), used by the background script. The background
 * has host permission for every URL, so its requests to the local backend are not
 * subject to CORS (the backend also accepts extension origins, see backend config).
 */

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** Longest text the backend accepts (`AnalyzeSentenceRequest.sentence`). */
export const MAX_ANALYZE_CHARS = 2000;
const TIMEOUT_MS = 15_000;

/**
 * Levels of the catalog shipped with the backend (backend/app/services/grammar_catalog),
 * used when the rule list cannot be read.
 */
const KNOWN_LEVELS: Record<string, string> = {
  futur_proche: 'A1-A2',
  aller_infinitif: 'A1-A2',
  passe_compose: 'A2',
  imparfait: 'A2-B1',
  negation: 'A1-A2',
  pronoms_cod_coi: 'A2-B1',
  conditionnel_present: 'B1',
  subjonctif_present: 'B1-B2',
};

/**
 * Base URL typed in the options ("127.0.0.1:8000/", "http://host:8000/api") as
 * "http://host:8000". Null when it is not an http(s) URL.
 */
export function normalizeBackendUrl(raw: string | null | undefined): string | null {
  let value = (raw ?? '').trim();
  if (!value) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `http://${value}`;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  const path = url.pathname.replace(/\/+$/, '').replace(/\/api$/i, '');
  return `${url.protocol}//${url.host}${path}`;
}

/** Backend URL from settings, or the default one. */
export function backendUrlOrDefault(raw: string | null | undefined): string {
  return normalizeBackendUrl(raw) ?? DEFAULT_BACKEND_URL;
}

/** Text sent for analysis: whitespace collapsed, trimmed, at most MAX_ANALYZE_CHARS. */
export function normalizeSentence(text: string): string {
  return text.replace(/[\s  ]+/g, ' ').trim().slice(0, MAX_ANALYZE_CHARS).trim();
}

interface RawMatch {
  rule_id?: unknown;
  rule_name?: unknown;
  matched_text?: unknown;
  start_char?: unknown;
  end_char?: unknown;
}

export interface RuleInfo {
  name: string;
  level: string | null;
}

/** Span of a backend match in `sentence`; offsets are checked against the matched text. */
function spanOf(sentence: string, m: RawMatch): GrammarSpan | null {
  const text = typeof m.matched_text === 'string' ? m.matched_text : '';
  const start = typeof m.start_char === 'number' ? m.start_char : -1;
  const end = typeof m.end_char === 'number' ? m.end_char : -1;
  if (start >= 0 && end > start && end <= sentence.length && (!text || sentence.slice(start, end) === text)) {
    return { start, end, text: sentence.slice(start, end) };
  }
  // Offsets that do not fit (another normalization on the backend side): find the text.
  if (text) {
    const i = sentence.indexOf(text);
    if (i >= 0) return { start: i, end: i + text.length, text };
  }
  return null;
}

/**
 * Groups the backend matches by rule: one structure per rule with all its spans, in
 * order of first appearance. Matches without a usable span are dropped.
 */
export function buildAnalysis(sentence: string, raw: unknown, rules: Map<string, RuleInfo> = new Map()): GrammarAnalysis {
  const matches = raw && typeof raw === 'object' && Array.isArray((raw as { matches?: unknown }).matches)
    ? ((raw as { matches: unknown[] }).matches.filter((m) => m && typeof m === 'object') as RawMatch[])
    : [];
  const byRule = new Map<string, DetectedStructure>();
  for (const m of matches) {
    if (typeof m.rule_id !== 'string' || !m.rule_id) continue;
    const span = spanOf(sentence, m);
    if (!span) continue;
    const id = m.rule_id === 'aller_infinitif' ? 'futur_proche' : m.rule_id;
    let structure = byRule.get(id);
    if (!structure) {
      const info = rules.get(id) ?? rules.get(m.rule_id);
      structure = {
        ruleId: id,
        name: info?.name || (typeof m.rule_name === 'string' && m.rule_name) || id,
        level: info?.level ?? KNOWN_LEVELS[id] ?? null,
        spans: [],
      };
      byRule.set(id, structure);
    }
    if (!structure.spans.some((s) => s.start === span.start && s.end === span.end)) structure.spans.push(span);
  }
  const structures = [...byRule.values()];
  for (const s of structures) s.spans.sort((a, b) => a.start - b.start || a.end - b.end);
  structures.sort((a, b) => a.spans[0].start - b.spans[0].start);
  return { sentence, structures };
}

/** Rule list of `GET /api/grammar/rules` as id -> name and level. */
export function parseRules(raw: unknown): Map<string, RuleInfo> {
  const map = new Map<string, RuleInfo>();
  if (!Array.isArray(raw)) return map;
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const { id, name, level } = r as { id?: unknown; name?: unknown; level?: unknown };
    if (typeof id !== 'string' || !id) continue;
    map.set(id, {
      name: typeof name === 'string' ? name : id,
      level: typeof level === 'string' && level.trim() ? level.trim() : null,
    });
  }
  return map;
}

async function withTimeout(fetchFn: FetchFn, url: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal, credentials: 'omit' });
  } finally {
    clearTimeout(timer);
  }
}

/** Error text of a FastAPI reply (`{ detail }`), or the start of the body. */
async function errorMessage(response: Response): Promise<string> {
  const body = await response.text().catch(() => '');
  try {
    const detail = (JSON.parse(body) as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (detail) return JSON.stringify(detail).slice(0, 200);
  } catch {
    // not JSON
  }
  return body.slice(0, 200) || response.statusText || `HTTP ${response.status}`;
}

/** Rule names and levels; cached per backend URL for the life of the service worker. */
export class RuleCatalog {
  private cache = new Map<string, { at: number; rules: Map<string, RuleInfo> }>();
  constructor(
    private readonly fetchFn: FetchFn,
    private readonly ttlMs = 10 * 60_000
  ) {}

  async get(baseUrl: string): Promise<Map<string, RuleInfo>> {
    const hit = this.cache.get(baseUrl);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.rules;
    try {
      const response = await withTimeout(this.fetchFn, `${baseUrl}/api/grammar/rules`, {}, 5_000);
      if (!response.ok) return hit?.rules ?? new Map();
      const rules = parseRules(await response.json());
      this.cache.set(baseUrl, { at: Date.now(), rules });
      return rules;
    } catch {
      return hit?.rules ?? new Map();
    }
  }
}

/** `POST /api/grammar/analyze` for one sentence. Never throws. */
export async function analyzeWithBackend(
  baseUrl: string,
  sentence: string,
  fetchFn: FetchFn,
  catalog?: RuleCatalog
): Promise<AnalyzeGrammarReply> {
  const rulesPromise = catalog ? catalog.get(baseUrl) : Promise.resolve(new Map<string, RuleInfo>());
  let response: Response;
  try {
    response = await withTimeout(fetchFn, `${baseUrl}/api/grammar/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentence }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { status: 'error', backendUrl: baseUrl, httpStatus: null, message: 'timeout' };
    }
    return { status: 'unreachable', backendUrl: baseUrl };
  }
  if (!response.ok) {
    return { status: 'error', backendUrl: baseUrl, httpStatus: response.status, message: await errorMessage(response) };
  }
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return { status: 'error', backendUrl: baseUrl, httpStatus: response.status, message: 'invalid JSON' };
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { matches?: unknown }).matches)) {
    return { status: 'error', backendUrl: baseUrl, httpStatus: response.status, message: 'not a grammar analysis' };
  }
  return { status: 'ok', analysis: buildAnalysis(sentence, raw, await rulesPromise) };
}

/** Options "Test connection": reads the rule list. Never throws. */
export async function checkBackend(baseUrl: string, fetchFn: FetchFn): Promise<BackendCheckReply> {
  let response: Response;
  try {
    response = await withTimeout(fetchFn, `${baseUrl}/api/grammar/rules`, {}, 5_000);
  } catch {
    return { status: 'unreachable' };
  }
  if (!response.ok) return { status: 'error', httpStatus: response.status, message: await errorMessage(response) };
  try {
    const raw = await response.json();
    if (!Array.isArray(raw)) throw new Error('not a list');
    return { status: 'ok', rules: parseRules(raw).size };
  } catch {
    return { status: 'error', httpStatus: response.status, message: 'not a grammar backend' };
  }
}

export interface CacheArea {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
}

/**
 * Analyses by sentence (US-17 "cache theo câu"): in memory, and in an optional storage
 * area (storage.session in the background, so a restarted service worker keeps them).
 * Only successful analyses are kept; at most `max` sentences, the oldest dropped first.
 */
export class AnalysisCache {
  private memory = new Map<string, GrammarAnalysis>();
  private loaded: Promise<void> | null = null;
  static readonly STORAGE_KEY = 'grammarAnalysisCache';

  constructor(
    private readonly area: CacheArea | null = null,
    private readonly max = 100
  ) {}

  static key(baseUrl: string, sentence: string): string {
    return `${baseUrl}\n${sentence}`;
  }

  private load(): Promise<void> {
    this.loaded ??= (async () => {
      if (!this.area) return;
      try {
        const stored = await this.area.get(AnalysisCache.STORAGE_KEY);
        if (!Array.isArray(stored)) return;
        for (const item of stored) {
          if (Array.isArray(item) && typeof item[0] === 'string' && item[1] && typeof item[1] === 'object') {
            if (!this.memory.has(item[0])) this.memory.set(item[0], item[1] as GrammarAnalysis);
          }
        }
      } catch {
        // storage not available: memory only
      }
    })();
    return this.loaded;
  }

  async get(baseUrl: string, sentence: string): Promise<GrammarAnalysis | null> {
    await this.load();
    const key = AnalysisCache.key(baseUrl, sentence);
    const hit = this.memory.get(key);
    if (!hit) return null;
    this.memory.delete(key); // most recently used last
    this.memory.set(key, hit);
    return hit;
  }

  async set(baseUrl: string, sentence: string, analysis: GrammarAnalysis): Promise<void> {
    await this.load();
    const key = AnalysisCache.key(baseUrl, sentence);
    this.memory.delete(key);
    this.memory.set(key, analysis);
    while (this.memory.size > this.max) this.memory.delete(this.memory.keys().next().value as string);
    if (!this.area) return;
    try {
      await this.area.set(AnalysisCache.STORAGE_KEY, [...this.memory.entries()]);
    } catch {
      // quota or no storage: memory only
    }
  }
}

// --- Grammar card of one rule (US-18) ------------------------------------------

/** `GET /api/grammar/rules/{id}`. Never throws. */
export async function fetchRule(baseUrl: string, ruleId: string, fetchFn: FetchFn): Promise<GrammarRuleReply> {
  let response: Response;
  try {
    response = await withTimeout(fetchFn, `${baseUrl}/api/grammar/rules/${encodeURIComponent(ruleId)}`, {}, 10_000);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { status: 'error', backendUrl: baseUrl, httpStatus: null, message: 'timeout' };
    }
    return { status: 'unreachable', backendUrl: baseUrl };
  }
  if (response.status === 404) return { status: 'not_found', ruleId };
  if (!response.ok) {
    return { status: 'error', backendUrl: baseUrl, httpStatus: response.status, message: await errorMessage(response) };
  }
  let rule: GrammarRuleDetail | null = null;
  try {
    rule = parseRule(await response.json());
  } catch {
    // not JSON
  }
  if (!rule) return { status: 'error', backendUrl: baseUrl, httpStatus: response.status, message: 'not a grammar rule' };
  return { status: 'ok', rule };
}

/** Rule cards by backend and id, for the life of the service worker (the catalog rarely changes). */
export class RuleDetailCache {
  private cache = new Map<string, { at: number; rule: GrammarRuleDetail }>();
  constructor(private readonly ttlMs = 30 * 60_000) {}

  get(baseUrl: string, ruleId: string): GrammarRuleDetail | null {
    const hit = this.cache.get(`${baseUrl}\n${ruleId}`);
    return hit && Date.now() - hit.at < this.ttlMs ? hit.rule : null;
  }

  set(baseUrl: string, ruleId: string, rule: GrammarRuleDetail) {
    this.cache.set(`${baseUrl}\n${ruleId}`, { at: Date.now(), rule });
  }
}

// --- Practice (US-19) -------------------------------------------------------------

/** `POST /api/practice/submit`. Never throws. The backend also stores the attempt (SQLite). */
export async function submitPractice(baseUrl: string, req: PracticeRequest, fetchFn: FetchFn): Promise<PracticeReply> {
  const sentence = req.sentence.replace(/\s+/g, ' ').trim().slice(0, MAX_PRACTICE_CHARS);
  let response: Response;
  try {
    response = await withTimeout(
      fetchFn,
      `${baseUrl}/api/practice/submit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_sentence: sentence, target_rule_id: req.ruleId, target_rule_name: req.ruleName }),
      },
      // The backend may wait for its LLM (with retries).
      45_000
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { status: 'error', backendUrl: baseUrl, httpStatus: null, message: 'timeout' };
    }
    return { status: 'unreachable', backendUrl: baseUrl };
  }
  if (!response.ok) {
    return { status: 'error', backendUrl: baseUrl, httpStatus: response.status, message: await errorMessage(response) };
  }
  let result: PracticeResult | null = null;
  try {
    result = parsePracticeResponse(await response.json(), sentence, req.ruleId);
  } catch {
    // not JSON
  }
  if (!result) return { status: 'error', backendUrl: baseUrl, httpStatus: response.status, message: 'not a practice result' };
  return { status: 'ok', result };
}
