import type { VocabEntry } from '@/types';
import {
  assembleVocabulary,
  emptyVocabulary,
  entryKey,
  parseMeta,
  VOCABULARY_KEY,
  type VocabDraft,
  type VocabularyState,
} from './model';
import type { VocabCommand } from './store';
import type { ImportSummary } from './transfer';
import type { ReviewGrade } from './review';

/**
 * Vocabulary access for content scripts and extension pages (US-05).
 * Reads go straight to storage.local; writes are sent to the background script,
 * which owns the notebook and applies them one at a time (store.ts).
 */

export const VOCAB_COMMAND = 'VOCAB_COMMAND';
export const VOCAB_ENSURE = 'VOCAB_ENSURE';
export const VOCAB_IMPORT = 'VOCAB_IMPORT';

/** US-08: merges parsed JSON (backup or list of entries) into the notebook. */
export async function importVocabulary(value: unknown): Promise<ImportSummary> {
  const reply = (await browser.runtime.sendMessage({ type: VOCAB_IMPORT, payload: value })) as
    | { success: boolean; summary?: ImportSummary; error?: string }
    | undefined;
  if (!reply?.success || !reply.summary) throw new Error(reply?.error ?? 'Import failed');
  return reply.summary;
}

async function send(command: VocabCommand): Promise<VocabEntry | null> {
  const reply = (await browser.runtime.sendMessage({ type: VOCAB_COMMAND, payload: command })) as
    | { success: boolean; entry?: VocabEntry | null; error?: string }
    | undefined;
  if (!reply?.success) throw new Error(reply?.error ?? 'Vocabulary update failed');
  return reply.entry ?? null;
}

async function readMeta() {
  return parseMeta((await browser.storage.local.get(VOCABULARY_KEY))[VOCABULARY_KEY]);
}

/** Current notebook; asks the background to migrate/convert first when needed. */
export async function getVocabulary(): Promise<VocabularyState> {
  let meta = await readMeta();
  if (!meta) {
    await browser.runtime.sendMessage({ type: VOCAB_ENSURE });
    meta = await readMeta();
    if (!meta) return emptyVocabulary();
  }
  const keys = Object.keys(meta.index).map(entryKey);
  const items = keys.length > 0 ? await browser.storage.local.get(keys) : {};
  return assembleVocabulary(meta, items);
}

/** One entry, read directly (no full notebook read). */
export async function getVocabEntry(id: string): Promise<VocabEntry | null> {
  const meta = await readMeta();
  if (!meta) return (await getVocabulary()).entries[id] ?? null;
  if (!(id in meta.index)) return null;
  const items = await browser.storage.local.get(entryKey(id));
  return assembleVocabulary({ ...meta, index: { [id]: 0 } }, items).entries[id] ?? null;
}

/**
 * Calls back with the notebook after every change. The background always rewrites the
 * meta record last, so watching that key is enough.
 */
export function watchVocabulary(callback: (state: VocabularyState) => void): () => void {
  let latest = 0;
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area !== 'local' || !changes[VOCABULARY_KEY]) return;
    const call = ++latest;
    void getVocabulary().then((state) => {
      if (call === latest) callback(state); // drop out-of-order reads
    });
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

export const saveWord = (draft: VocabDraft) => send({ op: 'save', draft });
export const unsaveWord = (id: string) => send({ op: 'unsave', id });
export const ignoreSpelling = (word: string) => send({ op: 'ignoreSpelling', word });
export const unignoreSpelling = (id: string) => send({ op: 'unignoreSpelling', id });
export const updateVocabEntry = (id: string, patch: Extract<VocabCommand, { op: 'update' }>['patch']) =>
  send({ op: 'update', id, patch });
export const reviewWord = (id: string, grade: ReviewGrade) => send({ op: 'review', id, grade });
export const removeVocabEntry =(id: string) => send({ op: 'remove', id });
