import type { VocabEntry } from '@/types';

/**
 * Finding saved words in page text (US-09). Pure functions, unit-tested; the DOM side
 * is highlighter.ts.
 */

/** Statuses highlighted on pages: known words are not. */
export type HighlightStatus = 'new' | 'learning';

const MIN_FORM_LENGTH = 2;

/** Key used to compare a form met in the page with the stored forms. */
export function formKey(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/’/g, "'").replace(/\s+/g, ' ').trim();
}

/**
 * Forms looked for on pages: the lemma, the form met when saved, and the regular
 * plural / feminine of nouns and adjectives (maison → maisons, grand → grande(s),
 * bateau → bateaux). Verbs only match the lemma and the saved form: conjugations
 * are not generated.
 */
export function highlightForms(entry: Pick<VocabEntry, 'lemma' | 'word' | 'pos'>): string[] {
  const lemma = formKey(entry.lemma);
  const forms = new Set([lemma, formKey(entry.word)]);
  const pos = (entry.pos ?? '').toLowerCase();
  const singleWord = !/[\s']/.test(lemma);
  if (singleWord && [...lemma].length >= MIN_FORM_LENGTH && !pos.startsWith('verbe') && !pos.startsWith('adverbe') && /\p{L}$/u.test(lemma)) {
    if (/(au|eu)$/.test(lemma)) forms.add(lemma + 'x');
    else if (!/[sxz]$/.test(lemma)) forms.add(lemma + 's');
    if (pos.startsWith('adjectif') && !lemma.endsWith('e')) {
      forms.add(lemma + 'e');
      forms.add(lemma + 'es');
    }
  }
  return [...forms].filter((f) => [...f].length >= MIN_FORM_LENGTH);
}

export interface VocabMatcher {
  regex: RegExp;
  statusOf(match: string): HighlightStatus | undefined;
  size: number;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matcher for the saved words not yet known; null when there is nothing to look for. */
export function buildMatcher(entries: readonly VocabEntry[]): VocabMatcher | null {
  const statuses = new Map<string, HighlightStatus>();
  for (const e of entries) {
    if (!e.saved || e.status === 'known') continue;
    for (const form of highlightForms(e)) {
      // A form shared by two entries shows the less advanced status.
      if (statuses.get(form) !== 'new') statuses.set(form, e.status);
    }
  }
  if (statuses.size === 0) return null;
  // Longest first, so "pomme de terre" wins over "pomme".
  const alternatives = [...statuses.keys()]
    .sort((a, b) => b.length - a.length)
    .map((f) => escapeRegex(f).replace(/ /g, '\\s+').replace(/'/g, "['’]"));
  // Whole words only: not inside "peut-être" for "être", nor "maisonnette" for "maison".
  const regex = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_-])(?:${alternatives.join('|')})(?![\\p{L}\\p{M}\\p{N}_-])`, 'giu');
  return { regex, statusOf: (match) => statuses.get(formKey(match)), size: statuses.size };
}

export interface TextMatch {
  start: number;
  end: number;
  status: HighlightStatus;
}

/** Saved words in `text`, in order, at most `limit`. */
export function findMatches(text: string, matcher: VocabMatcher, limit = Infinity): TextMatch[] {
  const out: TextMatch[] = [];
  const regex = matcher.regex;
  regex.lastIndex = 0;
  for (let m = regex.exec(text); m && out.length < limit; m = regex.exec(text)) {
    const status = matcher.statusOf(m[0]);
    if (status) out.push({ start: m.index, end: m.index + m[0].length, status });
  }
  return out;
}
