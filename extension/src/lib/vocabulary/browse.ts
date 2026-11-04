import type { VocabEntry, VocabStatus } from '@/types';

/**
 * Search, filter and sort of the saved words (US-07), shared by the popup and the
 * options page. Pure functions, unit-tested.
 */

export type StatusFilter = VocabStatus | 'all';
export type VocabSort = 'recent' | 'alpha' | 'status';

export const VOCAB_STATUSES: readonly VocabStatus[] = ['new', 'learning', 'known'];

/** Lowercase without accents or ligatures, so "ecole" finds "école" and "coeur" finds "cœur". */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .replace(/[’`]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 0: the word or lemma starts with the query, 1: contains it, 2: another field
 * (definitions, note, sentence, page title) contains it; null: no match.
 */
export function matchRank(entry: VocabEntry, query: string): number | null {
  const q = foldText(query);
  if (!q) return 0;
  const heads = [entry.lemma, entry.word].map(foldText);
  if (heads.some((h) => h.startsWith(q))) return 0;
  if (heads.some((h) => h.includes(q))) return 1;
  const other = [...entry.definitions, entry.note, entry.contextSentence ?? '', entry.sourceTitle ?? '']
    .map(foldText)
    .join('\n');
  return other.includes(q) ? 2 : null;
}

const STATUS_ORDER: Record<VocabStatus, number> = { new: 0, learning: 1, known: 2 };
const byLemma = (a: VocabEntry, b: VocabEntry) =>
  a.lemma.localeCompare(b.lemma, 'fr', { sensitivity: 'base' }) || a.id.localeCompare(b.id);
/** "Recently added": a status or note change does not move a word to the top. */
const byRecent = (a: VocabEntry, b: VocabEntry) => b.createdAt - a.createdAt || byLemma(a, b);

const SORTS: Record<VocabSort, (a: VocabEntry, b: VocabEntry) => number> = {
  recent: byRecent,
  alpha: byLemma,
  status: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || byLemma(a, b),
};

export interface BrowseOptions {
  query?: string;
  status?: StatusFilter;
  sort?: VocabSort;
}

/** Entries matching the query and status; with a query, best matches come first. */
export function browseVocabulary(entries: readonly VocabEntry[], options: BrowseOptions = {}): VocabEntry[] {
  const { query = '', status = 'all', sort = 'recent' } = options;
  const compare = SORTS[sort];
  const ranked: { entry: VocabEntry; rank: number }[] = [];
  for (const entry of entries) {
    if (status !== 'all' && entry.status !== status) continue;
    const rank = matchRank(entry, query);
    if (rank !== null) ranked.push({ entry, rank });
  }
  ranked.sort((a, b) => a.rank - b.rank || compare(a.entry, b.entry));
  return ranked.map((r) => r.entry);
}

/** Number of entries per status, plus the total (for the filter chips). */
export function countByStatus(entries: readonly VocabEntry[]): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = { all: entries.length, new: 0, learning: 0, known: 0 };
  for (const e of entries) counts[e.status]++;
  return counts;
}

export function isStatusFilter(value: unknown): value is StatusFilter {
  return value === 'all' || VOCAB_STATUSES.includes(value as VocabStatus);
}

export function isVocabSort(value: unknown): value is VocabSort {
  return typeof value === 'string' && value in SORTS;
}
