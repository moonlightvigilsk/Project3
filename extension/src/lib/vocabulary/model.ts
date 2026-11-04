import type { VocabEntry, VocabStatus } from '@/types';
import type { LookupResult } from '@/lib/dictionary/types';

/**
 * Pure operations on the vocabulary notebook (US-05). No browser APIs here, so the
 * migration and merge rules are unit-tested; storage lives in store.ts / client.ts.
 */

/**
 * storage.local layout (version 2):
 * - `vocabulary`: small meta record (VocabularyMeta) with the index of ids,
 * - `vocab:<id>`: one key per entry,
 * so saving a word, a note or a flashcard answer only writes that entry plus the index.
 * Version 1 (US-05 first cut) kept every entry inline under `vocabulary.entries`.
 */
export const VOCABULARY_KEY = 'vocabulary';
export const VOCABULARY_VERSION = 2;
export const ENTRY_PREFIX = 'vocab:';

export function entryKey(id: string): string {
  return ENTRY_PREFIX + id;
}

export interface VocabularyMeta {
  version: 2;
  /** id -> updatedAt of every entry. */
  index: Record<string, number>;
  /** Words of the old storage.sync `dictionary` already imported (never re-imported). */
  importedLegacy: string[];
  /** Incremented on every write by the background, to recognise its own changes. */
  rev: number;
}

/** In-memory notebook, as read by the UI. */
export interface VocabularyState {
  version: number;
  entries: Record<string, VocabEntry>;
}

export function emptyMeta(): VocabularyMeta {
  return { version: 2, index: {}, importedLegacy: [], rev: 0 };
}

/** Version 2 meta record, or null for anything else (missing, version 1, malformed). */
export function parseMeta(stored: unknown): VocabularyMeta | null {
  if (!stored || typeof stored !== 'object') return null;
  const v = stored as Partial<VocabularyMeta>;
  if (v.version !== 2 || !v.index || typeof v.index !== 'object') return null;
  const index: Record<string, number> = {};
  for (const [id, at] of Object.entries(v.index)) index[id] = typeof at === 'number' ? at : 0;
  return {
    version: 2,
    index,
    importedLegacy: Array.isArray(v.importedLegacy) ? v.importedLegacy.filter((w): w is string => typeof w === 'string') : [],
    rev: typeof v.rev === 'number' ? v.rev : 0,
  };
}

/** Builds the notebook from the meta record and the `vocab:<id>` values read for it. */
export function assembleVocabulary(meta: VocabularyMeta, items: Record<string, unknown>): VocabularyState {
  const state = emptyVocabulary();
  for (const id of Object.keys(meta.index)) {
    const entry = sanitizeEntry(items[entryKey(id)]);
    if (entry) state.entries[entry.id] = entry;
  }
  return state;
}

/** Fields a caller may provide when saving or updating a word. */
export interface VocabDraft {
  word: string;
  lemma?: string | null;
  pos?: string | null;
  gender?: VocabEntry['gender'];
  ipa?: string | null;
  definitions?: string[];
  note?: string;
  contextSentence?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  status?: VocabStatus;
  saved?: boolean;
  ignoreSpelling?: boolean;
}

const STATUSES: readonly VocabStatus[] = ['new', 'learning', 'known'];

export function vocabId(lemmaOrWord: string): string {
  return lemmaOrWord.normalize('NFC').trim().toLowerCase();
}

export function emptyVocabulary(): VocabularyState {
  return { version: VOCABULARY_VERSION, entries: {} };
}

/**
 * Reads a version 1 value (`{ version: 1, entries: {...} }`) defensively: anything
 * malformed is dropped, never thrown on. Used to convert it to version 2.
 */
export function parseVocabulary(stored: unknown): VocabularyState | null {
  if (!stored || typeof stored !== 'object' || !('entries' in stored)) return null;
  const raw = (stored as { entries?: unknown }).entries;
  const state = emptyVocabulary();
  if (raw && typeof raw === 'object') {
    for (const value of Object.values(raw as Record<string, unknown>)) {
      const entry = sanitizeEntry(value);
      if (entry) state.entries[entry.id] = entry;
    }
  }
  return state;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export function sanitizeEntry(value: unknown): VocabEntry | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<Record<keyof VocabEntry, unknown>>;
  const word = str(v.word);
  if (!word) return null;
  const lemma = str(v.lemma) ?? word;
  const createdAt = num(v.createdAt, 0);
  return {
    id: vocabId(lemma),
    word,
    lemma,
    pos: str(v.pos),
    gender: v.gender === 'm' || v.gender === 'f' || v.gender === 'mf' ? v.gender : null,
    ipa: str(v.ipa),
    definitions: Array.isArray(v.definitions) ? v.definitions.filter((d): d is string => typeof d === 'string') : [],
    note: typeof v.note === 'string' ? v.note : '',
    contextSentence: str(v.contextSentence),
    sourceUrl: str(v.sourceUrl),
    sourceTitle: str(v.sourceTitle),
    status: STATUSES.includes(v.status as VocabStatus) ? (v.status as VocabStatus) : 'new',
    saved: v.saved === true,
    ignoreSpelling: v.ignoreSpelling === true,
    createdAt,
    updatedAt: num(v.updatedAt, createdAt),
    reviewCount: Math.max(0, Math.floor(num(v.reviewCount, 0))),
    dueAt: Math.max(0, num(v.dueAt, 0)),
    ease: Math.min(MAX_EASE, Math.max(MIN_EASE, num(v.ease, DEFAULT_EASE))),
    intervalDays: Math.max(0, num(v.intervalDays, 0)),
  };
}

/** SM-2 ease factor bounds (US-10). */
export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.5;

/**
 * Adds or updates a word. On an existing entry: learning data (status, reviewCount,
 * createdAt) is kept, empty fields are filled from the draft, flags given in the draft
 * are applied, and fields the draft sets explicitly win.
 */
export function upsertEntry(state: VocabularyState, draft: VocabDraft, now: number): VocabEntry {
  const word = draft.word.normalize('NFC').trim();
  const lemma = (draft.lemma ?? '').normalize('NFC').trim() || word;
  const id = vocabId(lemma);
  const prev = state.entries[id];
  const pick = <T>(next: T | undefined, old: T | undefined, fallback: T): T =>
    next !== undefined && next !== null && next !== '' && !(Array.isArray(next) && next.length === 0)
      ? next
      : (old ?? fallback);

  // Where the word was met is one occurrence: the newest one replaces sentence, URL and
  // title together, so a new URL is never paired with an older page's sentence.
  const newOccurrence = !!draft.sourceUrl?.trim() || !!draft.contextSentence?.trim();
  const occurrence = newOccurrence
    ? {
        contextSentence: draft.contextSentence?.trim() || null,
        sourceUrl: draft.sourceUrl?.trim() || null,
        sourceTitle: draft.sourceTitle?.trim() || null,
      }
    : {
        contextSentence: prev?.contextSentence ?? null,
        sourceUrl: prev?.sourceUrl ?? null,
        sourceTitle: prev?.sourceTitle ?? null,
      };

  const entry: VocabEntry = {
    id,
    word: prev && !draft.word.trim() ? prev.word : word,
    lemma,
    pos: pick(draft.pos, prev?.pos, null),
    gender: pick(draft.gender, prev?.gender, null),
    ipa: pick(draft.ipa, prev?.ipa, null),
    definitions: pick(draft.definitions, prev?.definitions, []),
    note: draft.note ?? prev?.note ?? '',
    ...occurrence,
    status: draft.status ?? prev?.status ?? 'new',
    saved: draft.saved ?? prev?.saved ?? false,
    ignoreSpelling: draft.ignoreSpelling ?? prev?.ignoreSpelling ?? false,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    reviewCount: prev?.reviewCount ?? 0,
    dueAt: prev?.dueAt ?? 0,
    ease: prev?.ease ?? DEFAULT_EASE,
    intervalDays: prev?.intervalDays ?? 0,
  };
  state.entries[id] = entry;
  return entry;
}

/**
 * Clears one use of an entry; the entry is deleted once it is neither saved nor
 * ignored for spelling. Returns the remaining entry, or null when deleted.
 */
export function clearFlag(
  state: VocabularyState,
  id: string,
  flag: 'saved' | 'ignoreSpelling',
  now: number
): VocabEntry | null {
  const prev = state.entries[id];
  if (!prev) return null;
  const next = { ...prev, [flag]: false, updatedAt: now };
  if (!next.saved && !next.ignoreSpelling) {
    delete state.entries[id];
    return null;
  }
  state.entries[id] = next;
  return next;
}

export function updateEntry(
  state: VocabularyState,
  id: string,
  patch: Partial<Pick<VocabEntry, 'note' | 'status' | 'contextSentence' | 'reviewCount'>>,
  now: number
): VocabEntry | null {
  const prev = state.entries[id];
  if (!prev) return null;
  const next: VocabEntry = { ...prev, updatedAt: now };
  if (typeof patch.note === 'string') next.note = patch.note;
  if (patch.status && STATUSES.includes(patch.status) && patch.status !== prev.status) {
    next.status = patch.status;
    // US-10: set back to "new" by hand = start learning again; back from "known" = review now.
    if (patch.status === 'new') Object.assign(next, { dueAt: 0, intervalDays: 0 });
    else if (prev.status === 'known') next.dueAt = 0;
  }
  if (patch.contextSentence !== undefined) next.contextSentence = str(patch.contextSentence);
  if (typeof patch.reviewCount === 'number') next.reviewCount = Math.max(0, Math.floor(patch.reviewCount));
  state.entries[id] = next;
  return next;
}

/** Lowercased words whose spelling errors are not reported. */
export function ignoredSpellings(state: VocabularyState): Set<string> {
  const out = new Set<string>();
  for (const e of Object.values(state.entries)) {
    if (!e.ignoreSpelling) continue;
    out.add(e.word.toLowerCase());
    out.add(e.id);
  }
  return out;
}

/** Saved words, most recently changed first. */
export function savedEntries(state: VocabularyState): VocabEntry[] {
  return Object.values(state.entries)
    .filter((e) => e.saved)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Words ignored for spelling, alphabetically. */
export function spellingEntries(state: VocabularyState): VocabEntry[] {
  return Object.values(state.entries)
    .filter((e) => e.ignoreSpelling)
    .sort((a, b) => a.word.localeCompare(b.word, 'fr'));
}

/**
 * Draft for a word saved from the lookup card. The notebook keeps the lemma, so the
 * lemma's own data is used (not the IPA of an inflected form such as "mangeons").
 */
export function vocabDraftFromLookup(
  result: LookupResult,
  page: { url: string | null; title: string | null }
): VocabDraft {
  const first = result.entries[0];
  return {
    word: result.word,
    lemma: result.lemma,
    pos: first?.pos ?? null,
    gender: first?.gender ?? null,
    ipa: first?.ipa ?? (result.formOf ? null : result.ipa),
    definitions: (first?.senses ?? []).slice(0, 3).map((s) => s.definition),
    sourceUrl: page.url,
    sourceTitle: page.title,
  };
}

// --- migration ---------------------------------------------------------------

/** Word bookmark as saved by the ☆ before US-05 (lib/bookmarks.ts). */
export interface LegacyWordBookmark {
  id: string;
  kind: string;
  title: string;
  subtitle?: string;
  url?: string;
  createdAt?: number;
}

/**
 * Splits a legacy bookmark subtitle "verbe · /mɑ̃.ʒe/ · Mâcher et avaler…" into
 * part of speech, IPA and first definition (each part optional).
 */
export function parseBookmarkSubtitle(subtitle: string | undefined): {
  pos: string | null;
  ipa: string | null;
  definition: string | null;
} {
  const parts = (subtitle ?? '').split(' · ').map((p) => p.trim()).filter(Boolean);
  let pos: string | null = null;
  let ipa: string | null = null;
  const rest: string[] = [];
  // fr.wiktionary part-of-speech labels are short lowercase phrases ("nom", "nom propre",
  // "locution nominale", "verbe pronominal"); definitions start with a capital or "(".
  const looksLikePos = (p: string) => /^\p{Ll}[\p{Ll}\s'’-]{0,29}$/u.test(p) && p.split(/\s+/).length <= 3;
  parts.forEach((part, i) => {
    const ipaMatch = /^\/(.+)\/$/.exec(part);
    if (ipaMatch && !ipa) ipa = ipaMatch[1];
    else if (i === 0 && parts.length > 1 && looksLikePos(part)) pos = part;
    else rest.push(part);
  });
  return { pos, ipa, definition: rest.join(' · ') || null };
}

/**
 * Builds the notebook from data of earlier versions:
 * - the `dictionary` string[] (storage.sync) -> entries with ignoreSpelling = true,
 * - ☆ word bookmarks (storage.local `bookmarks`, kind "word") -> saved entries.
 * A word present in both becomes one entry with both flags.
 */
export function migrateLegacy(dictionary: unknown, bookmarks: unknown, now: number): VocabularyState {
  const state = emptyVocabulary();
  if (Array.isArray(bookmarks)) {
    for (const b of bookmarks as LegacyWordBookmark[]) {
      if (!b || b.kind !== 'word' || typeof b.title !== 'string' || !b.title.trim()) continue;
      const { pos, ipa, definition } = parseBookmarkSubtitle(b.subtitle);
      const created = typeof b.createdAt === 'number' ? b.createdAt : now;
      // b.url is the Wiktionary page, not where the word was met: not kept as sourceUrl.
      upsertEntry(
        state,
        {
          word: b.title,
          lemma: b.title,
          pos,
          ipa,
          definitions: definition ? [definition] : [],
          saved: true,
        },
        created
      );
    }
  }
  if (Array.isArray(dictionary)) {
    for (const w of dictionary) {
      if (typeof w !== 'string' || !w.trim()) continue;
      upsertEntry(state, { word: w, ignoreSpelling: true }, now);
    }
  }
  return state;
}

/** Normalized words of a legacy `dictionary` value (anything else is ignored). */
export function legacyDictionaryWords(dictionary: unknown): string[] {
  if (!Array.isArray(dictionary)) return [];
  const out = new Set<string>();
  for (const w of dictionary) if (typeof w === 'string' && w.trim()) out.add(vocabId(w));
  return [...out];
}

/**
 * Imports words added to the old storage.sync `dictionary` since the last import, e.g. by
 * another computer still running a version before US-05. Each word is imported once:
 * a word the user later un-ignores here is not brought back. Returns the changed ids.
 */
export function importLegacyDictionary(
  state: VocabularyState,
  meta: VocabularyMeta,
  dictionary: unknown,
  now: number
): string[] {
  const done = new Set(meta.importedLegacy);
  const changed: string[] = [];
  for (const word of legacyDictionaryWords(dictionary)) {
    if (done.has(word)) continue;
    changed.push(upsertEntry(state, { word, ignoreSpelling: true }, now).id);
    meta.importedLegacy.push(word);
    done.add(word);
  }
  return changed;
}

/** Row for the backend `vocabulary_items` table (US-25 sync). */
export function toBackendVocabulary(entry: VocabEntry) {
  return {
    lemma: entry.lemma,
    surface_form: entry.word,
    pos: entry.pos,
    definition: entry.definitions.join('; ') || null,
    definition_source: 'wiktionary',
    status: entry.status,
    context_sentence: entry.contextSentence,
    created_at: new Date(entry.createdAt).toISOString(),
    updated_at: new Date(entry.updatedAt).toISOString(),
  };
}
