import type { VocabEntry } from '@/types';
import {
  clearFlag,
  emptyMeta,
  entryKey,
  ignoredSpellings,
  importLegacyDictionary,
  legacyDictionaryWords,
  migrateLegacy,
  assembleVocabulary,
  parseMeta,
  parseVocabulary,
  updateEntry,
  upsertEntry,
  VOCABULARY_KEY,
  type VocabDraft,
  type VocabularyMeta,
  type VocabularyState,
} from './model';
import { mergeImport, parseImport, type ImportSummary } from './transfer';
import { dueSummary, reviewEntry, type ReviewGrade } from './review';

/**
 * Background-only owner of the vocabulary notebook (US-05).
 * Every write goes through this single instance, one at a time, so concurrent
 * changes from several tabs cannot overwrite each other. Other contexts read
 * storage.local directly and send VOCAB_* messages to write (client.ts).
 */

export interface VocabularyStorage {
  /** storage.local get for several keys. */
  get(keys: string[]): Promise<Record<string, unknown>>;
  /** storage.local set (one call, one change event). */
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
  /** Legacy `dictionary` (string[]) in storage.sync. */
  getLegacyDictionary(): Promise<unknown>;
}

const BOOKMARKS_KEY = 'bookmarks';

export type VocabCommand =
  | { op: 'save'; draft: VocabDraft }
  | { op: 'unsave'; id: string }
  | { op: 'ignoreSpelling'; word: string }
  | { op: 'unignoreSpelling'; id: string }
  | { op: 'update'; id: string; patch: Parameters<typeof updateEntry>[2] }
  | { op: 'remove'; id: string }
  | { op: 'review'; id: string; grade: ReviewGrade };

interface Loaded {
  state: VocabularyState;
  meta: VocabularyMeta;
}

export class VocabularyStore {
  private loaded: Loaded | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly storage: VocabularyStorage,
    private readonly now: () => number = Date.now
  ) {}

  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Writes the given entries (null = delete) and the meta record in one change. */
  private async write(loaded: Loaded, changed: Iterable<string>) {
    const { state, meta } = loaded;
    const items: Record<string, unknown> = {};
    const removed: string[] = [];
    for (const id of new Set(changed)) {
      const entry = state.entries[id];
      if (entry) {
        items[entryKey(id)] = entry;
        meta.index[id] = entry.updatedAt;
      } else {
        removed.push(entryKey(id));
        delete meta.index[id];
      }
    }
    meta.rev += 1;
    if (removed.length > 0) await this.storage.remove(removed);
    items[VOCABULARY_KEY] = meta;
    await this.storage.set(items);
  }

  /** Loads the notebook: converts version 1, migrates earlier data, imports new legacy words. */
  private async load(): Promise<Loaded> {
    if (this.loaded) return this.loaded;
    const stored = (await this.storage.get([VOCABULARY_KEY]))[VOCABULARY_KEY];
    let loaded: Loaded;
    let changed: string[] = [];

    const meta = parseMeta(stored);
    if (meta) {
      const items = await this.storage.get(Object.keys(meta.index).map(entryKey));
      loaded = { state: assembleVocabulary(meta, items), meta };
    } else {
      const inline = parseVocabulary(stored);
      const dictionary = await this.storage.getLegacyDictionary();
      if (inline) {
        // Version 1: same entries, one key each now. Its migration already imported the dictionary.
        loaded = { state: inline, meta: { ...emptyMeta(), importedLegacy: legacyDictionaryWords(dictionary) } };
      } else {
        // First run: ☆ word bookmarks and the old dictionary.
        const bookmarks = (await this.storage.get([BOOKMARKS_KEY]))[BOOKMARKS_KEY];
        const state = migrateLegacy(dictionary, bookmarks, this.now());
        loaded = { state, meta: { ...emptyMeta(), importedLegacy: legacyDictionaryWords(dictionary) } };
        // Word bookmarks now live in the notebook; grammar cards and resources stay bookmarks.
        if (Array.isArray(bookmarks) && bookmarks.some((b) => b?.kind === 'word')) {
          await this.storage.set({ [BOOKMARKS_KEY]: bookmarks.filter((b) => b?.kind !== 'word') });
        }
      }
      changed = Object.keys(loaded.state.entries);
    }

    changed.push(...importLegacyDictionary(loaded.state, loaded.meta, await this.storage.getLegacyDictionary(), this.now()));
    if (changed.length > 0 || !meta) await this.write(loaded, changed);
    this.loaded = loaded;
    return loaded;
  }

  /** Makes sure the stored notebook exists (runs the migration once). */
  ensureReady(): Promise<void> {
    return this.serialize(async () => {
      await this.load();
    });
  }

  /** Lowercased words whose spelling errors must not be reported. */
  ignoredSpellings(): Promise<Set<string>> {
    return this.serialize(async () => ignoredSpellings((await this.load()).state));
  }

  /** The old storage.sync `dictionary` changed (another computer on an older version). */
  importLegacy(): Promise<void> {
    return this.serialize(async () => {
      const loaded = await this.load();
      const changed = importLegacyDictionary(loaded.state, loaded.meta, await this.storage.getLegacyDictionary(), this.now());
      if (changed.length > 0) await this.write(loaded, changed);
    });
  }

  /**
   * Called on storage changes: drops the in-memory copy unless the change is this
   * store's own write (same `rev`), e.g. after "clear data" or an import elsewhere.
   */
  onStorageChanged(newMeta: unknown) {
    const rev = parseMeta(newMeta)?.rev;
    if (this.loaded && rev === this.loaded.meta.rev) return;
    this.loaded = null;
  }

  /** US-08: merges a JSON import (validated again here, whatever the sender checked). */
  importEntries(value: unknown): Promise<ImportSummary> {
    return this.serialize(async () => {
      const { entries, skipped } = parseImport(value);
      const loaded = await this.load();
      const result = mergeImport(loaded.state, entries, this.now());
      if (result.changed.length > 0) await this.write(loaded, result.changed);
      return { ...result, skipped };
    });
  }

  apply(command: VocabCommand): Promise<VocabEntry | null> {
    return this.serialize(async () => {
      const loaded = await this.load();
      const { state } = loaded;
      const now = this.now();
      let result: VocabEntry | null;
      let id: string;
      switch (command.op) {
        case 'save':
          result = upsertEntry(state, { ...command.draft, saved: true }, now);
          id = result.id;
          break;
        case 'unsave':
          result = clearFlag(state, command.id, 'saved', now);
          id = command.id;
          break;
        case 'ignoreSpelling':
          result = upsertEntry(state, { word: command.word, ignoreSpelling: true }, now);
          id = result.id;
          break;
        case 'unignoreSpelling':
          result = clearFlag(state, command.id, 'ignoreSpelling', now);
          id = command.id;
          break;
        case 'update':
          result = updateEntry(state, command.id, command.patch, now);
          id = command.id;
          break;
        case 'remove':
          delete state.entries[command.id];
          result = null;
          id = command.id;
          break;
        case 'review':
          if (command.grade !== 'forgot' && command.grade !== 'remembered') throw new Error('Unknown grade');
          // A word removed meanwhile (another tab) is not recreated.
          if (!state.entries[command.id]) return null;
          result = reviewEntry(state, command.id, command.grade, now);
          id = command.id;
          break;
      }
      await this.write(loaded, [id]);
      return result;
    });
  }

  /** US-10: due words count for the badge, and when the next word becomes due. */
  dueSummary(): Promise<{ due: number; nextDueAt: number | null }> {
    return this.serialize(async () => dueSummary(Object.values((await this.load()).state.entries), this.now()));
  }
}
