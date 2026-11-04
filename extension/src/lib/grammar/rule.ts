import type { UILanguage } from '@/types';
import type { GrammarCard } from '@/lib/chat/types';
import { isTrustedSourceUrl } from '@/lib/chat/prompts';

/**
 * Grammar card of one rule (US-18), read from the backend catalog
 * (`GET /api/grammar/rules/{id}`, backend/app/services/grammar_catalog).
 */

export interface RuleExample {
  text: string;
  /** Short French note of the catalog ("vais (aller, présent) + visiter (infinitif)"). */
  note: string | null;
}

export interface RuleLink {
  title: string;
  url: string;
}

export interface GrammarRuleDetail {
  id: string;
  name: string;
  level: string | null;
  category: string | null;
  formula: string;
  /** Explanation per language; the catalog has French for every rule, Vietnamese/English for some. */
  descriptions: Partial<Record<UILanguage, string>>;
  /** Key points of the catalog (French). */
  keyPoints: string[];
  /** Conjugation table as lines ("je : vais + infinitif"). */
  patterns: string[];
  examples: RuleExample[];
  /** "Read more" pages, trusted sites only. */
  links: RuleLink[];
}

export type GrammarRuleReply =
  | { status: 'ok'; rule: GrammarRuleDetail }
  | { status: 'not_found'; ruleId: string }
  | { status: 'unreachable'; backendUrl: string }
  | { status: 'error'; backendUrl: string; httpStatus: number | null; message: string };

/** Content script -> background: `{ ruleId }`. Reply `{ success, reply: GrammarRuleReply }`. */
export const GRAMMAR_RULE = 'GRAMMAR_RULE';

/** Examples shown at first, and added by each "More examples". */
export const EXAMPLES_PER_PAGE = 3;

/**
 * Wiktionary entry of each rule of the catalog, used when the catalog gives no link
 * (YAML `links:` wins).
 */
const DEFAULT_LINKS: Record<string, RuleLink> = {
  futur_proche: { title: 'Wiktionnaire : futur proche', url: 'https://fr.wiktionary.org/wiki/futur_proche' },
  aller_infinitif: { title: 'Wiktionnaire : futur proche', url: 'https://fr.wiktionary.org/wiki/futur_proche' },
  passe_compose: { title: 'Wiktionnaire : passé composé', url: 'https://fr.wiktionary.org/wiki/pass%C3%A9_compos%C3%A9' },
  imparfait: { title: 'Wiktionnaire : imparfait', url: 'https://fr.wiktionary.org/wiki/imparfait' },
  negation: { title: 'Wiktionnaire : négation', url: 'https://fr.wiktionary.org/wiki/n%C3%A9gation' },
  pronoms_cod_coi: { title: 'Wiktionnaire : pronom personnel', url: 'https://fr.wiktionary.org/wiki/pronom_personnel' },
  conditionnel_present: { title: 'Wiktionnaire : conditionnel', url: 'https://fr.wiktionary.org/wiki/conditionnel' },
  subjonctif_present: { title: 'Wiktionnaire : subjonctif', url: 'https://fr.wiktionary.org/wiki/subjonctif' },
};

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function strings(v: unknown, max = 12): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, max) : [];
}

/** "je": "vais + infinitif" -> "je : vais + infinitif"; nested tables are flattened. */
function tableLines(table: unknown, prefix = ''): string[] {
  if (!table || typeof table !== 'object' || Array.isArray(table)) return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(table as Record<string, unknown>)) {
    const label = `${prefix}${key.replace(/_/g, ' ')}`;
    if (typeof value === 'string' && value.trim()) out.push(`${label} : ${value.trim()}`);
    else if (value && typeof value === 'object') out.push(...tableLines(value, `${label} › `));
  }
  return out.slice(0, 10);
}

function examplesOf(raw: Record<string, unknown>): RuleExample[] {
  const out: RuleExample[] = [];
  const seen = new Set<string>();
  const add = (text: string, note: string | null) => {
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return;
    seen.add(key);
    out.push({ text, note: note || null });
  };
  if (Array.isArray(raw.examples_correct)) {
    for (const e of raw.examples_correct) {
      if (typeof e === 'string') add(str(e), null);
      else if (e && typeof e === 'object') add(str((e as { text?: unknown }).text), str((e as { note?: unknown }).note));
    }
  }
  for (const text of strings(raw.examples, 30)) add(text, null);
  return out;
}

function linksOf(raw: Record<string, unknown>, id: string): RuleLink[] {
  const out: RuleLink[] = [];
  if (Array.isArray(raw.links)) {
    for (const l of raw.links) {
      if (!l || typeof l !== 'object') continue;
      const url = str((l as { url?: unknown }).url);
      if (!url || !isTrustedSourceUrl(url) || out.some((x) => x.url === url)) continue;
      out.push({ title: str((l as { title?: unknown }).title) || new URL(url).hostname, url });
    }
  }
  if (out.length === 0 && DEFAULT_LINKS[id]) out.push(DEFAULT_LINKS[id]);
  return out.slice(0, 3);
}

/** Backend rule -> card data. Null when it is not a rule. */
export function parseRule(raw: unknown): GrammarRuleDetail | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  const name = str(r.name);
  if (!id || !name) return null;
  const vi = str(r.description_vi);
  const en = str(r.description_en);
  // `description` is French in the built-in catalog; rules loaded from YAML copy vi/en there.
  const generic = str(r.description);
  const fr = generic && generic !== vi && generic !== en ? generic : '';
  const descriptions: GrammarRuleDetail['descriptions'] = {};
  if (vi) descriptions.vi = vi;
  if (en) descriptions.en = en;
  if (fr) descriptions.fr = fr;
  return {
    id,
    name,
    level: str(r.level) || null,
    category: str(r.category) || null,
    formula: str(r.formula),
    descriptions,
    keyPoints: strings(r.key_points, 8),
    patterns: tableLines(r.conjugation_table),
    examples: examplesOf(r),
    links: linksOf(r, id),
  };
}

/**
 * Explanation in the interface language. Missing languages fall back to English, then
 * French, then Vietnamese (the AC: no French text yet -> English).
 */
export function explanationFor(rule: GrammarRuleDetail, lang: UILanguage): { text: string; lang: UILanguage } | null {
  const order: UILanguage[] = [lang, 'en', 'fr', 'vi'];
  for (const l of order) {
    const text = rule.descriptions[l];
    if (text) return { text, lang: l };
  }
  return null;
}

/** Catalog examples without the page sentence (it is shown first, as the context example). */
export function catalogExamples(rule: GrammarRuleDetail, contextSentence: string | null): RuleExample[] {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const context = contextSentence ? norm(contextSentence) : null;
  return rule.examples.filter((e) => norm(e.text) !== context);
}

/** Grammar card for the bookmarks (☆), so the side panel can show it again. */
export function ruleToGrammarCard(rule: GrammarRuleDetail, lang: UILanguage): GrammarCard {
  const explanation = explanationFor(rule, lang);
  return {
    id: rule.id,
    title: rule.name,
    form: rule.formula,
    patterns: rule.patterns.slice(0, 6),
    uses: [...(explanation ? [explanation.text] : []), ...rule.keyPoints].slice(0, 6),
    examples: rule.examples.slice(0, EXAMPLES_PER_PAGE).map((e) => e.text),
    source: rule.links[0] ? { title: rule.links[0].title, url: rule.links[0].url } : null,
  };
}
