import type { VocabEntry, VocabStatus } from '@/types';
import { sanitizeEntry, vocabId, type VocabularyState } from './model';

/**
 * Export (CSV, Anki, JSON backup) and JSON import of the notebook (US-08).
 * Pure functions: the options page downloads the text, the background merges imports.
 */

// --- export ------------------------------------------------------------------

/** Same columns, in the same order, as the backend's GET /api/vocabulary/export/csv. */
export const CSV_HEADER = [
  'Lemma',
  'Từ gốc',
  'Loại từ (POS)',
  'Trạng thái',
  'Số lần gặp',
  'Nghĩa tiếng Pháp',
  'Nghĩa tiếng Việt',
  'Câu ngữ cảnh',
  'Ngày thêm',
] as const;

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-11-04 15:42" in local time, the backend's `%Y-%m-%d %H:%M`. */
export function formatCsvDate(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * One CSV field, always quoted (the backend uses csv.QUOTE_ALL). A value that a
 * spreadsheet would run as a formula (= + - @ at the start) gets a leading apostrophe.
 */
function csvField(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * CSV with the backend's columns. `Số lần gặp` (times met) is not tracked by the
 * extension: 1. `Nghĩa tiếng Việt` stays empty. Lines end with CRLF like Python's csv.
 * Starts with a UTF-8 BOM so Excel shows the accents.
 */
export function toCsv(entries: readonly VocabEntry[]): string {
  const rows = [CSV_HEADER.map(csvField).join(',')];
  for (const e of entries) {
    rows.push(
      [
        e.lemma,
        e.word,
        e.pos ?? '',
        e.status,
        1,
        e.definitions.join('; '),
        '',
        e.contextSentence ?? '',
        formatCsvDate(e.createdAt),
      ]
        .map(csvField)
        .join(',')
    );
  }
  return '﻿' + rows.join('\r\n') + '\r\n';
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** Tabs and line breaks would split an Anki field or note. */
const oneLine = (html: string) => html.replace(/[\t\r\n]+/g, ' ');

/** Front of an Anki card: word + IPA (and the form met when it differs). */
export function ankiFront(e: VocabEntry): string {
  let front = `<b>${escapeHtml(e.lemma)}</b>`;
  if (e.ipa) front += ` /${escapeHtml(e.ipa)}/`;
  if (e.word.toLowerCase() !== e.lemma.toLowerCase()) front += `<br><i>${escapeHtml(e.word)}</i>`;
  return oneLine(front);
}

/** Back of an Anki card: definitions + the sentence where the word was met (+ the note). */
export function ankiBack(e: VocabEntry): string {
  const parts: string[] = [];
  const grammar = [e.pos, e.gender === 'mf' ? 'm/f' : e.gender].filter(Boolean).join(', ');
  if (grammar) parts.push(`<small>${escapeHtml(grammar)}</small>`);
  if (e.definitions.length === 1) parts.push(escapeHtml(e.definitions[0]));
  else if (e.definitions.length > 1) parts.push(`<ol>${e.definitions.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ol>`);
  if (e.contextSentence) parts.push(`<i>« ${escapeHtml(e.contextSentence)} »</i>`);
  if (e.note.trim()) parts.push(`<small>${escapeHtml(e.note.trim()).replace(/\r?\n/g, '<br>')}</small>`);
  return oneLine(parts.join('<br>'));
}

/**
 * Anki "Import File" text: tab-separated Front / Back / Tags, with the file headers
 * Anki (2.1.55+) reads, so no import option has to be set by hand.
 */
export function toAnkiTsv(entries: readonly VocabEntry[]): string {
  const lines = ['#separator:tab', '#html:true', '#columns:Front\tBack\tTags', '#tags column:3'];
  for (const e of entries) {
    lines.push([ankiFront(e), ankiBack(e), `textchecker textchecker::${e.status}`].join('\t'));
  }
  return lines.join('\n') + '\n';
}

export const BACKUP_FORMAT = 'textchecker-vocabulary';

/** Full backup, the format read back by the import. */
export function toJsonBackup(entries: readonly VocabEntry[], now: number): string {
  return JSON.stringify({ format: BACKUP_FORMAT, version: 1, exportedAt: new Date(now).toISOString(), entries }, null, 2);
}

/** "vocab_export_20261104_154200" (the backend's file name pattern). */
export function exportFileName(prefix: string, now: number, extension: string): string {
  const d = new Date(now);
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${prefix}_${stamp}.${extension}`;
}

// --- import ------------------------------------------------------------------

/** Largest file the import accepts. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ENTRIES = 20000;
const MAX_TEXT = 2000;
const MAX_NOTE = 5000;
const MAX_DEFINITIONS = 10;

const cut = (s: string | null, max: number) => (s && s.length > max ? s.slice(0, max) : s);
const httpUrl = (s: string | null) => (s && /^https?:\/\//i.test(s) ? cut(s, MAX_TEXT) : null);

/**
 * Entries of an imported JSON value: our backup (`{ format, entries: [...] }`), a plain
 * array, or an object of entries (`{ entries: { id: entry } }`, the old inline layout).
 * Invalid items are counted in `skipped`; long texts are cut; only http(s) source URLs
 * are kept. An item that is neither saved nor ignored for spelling is imported as saved.
 * Throws when the value has no entries at all.
 */
export function parseImport(value: unknown): { entries: VocabEntry[]; skipped: number } {
  let raw: unknown = value;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    raw = (raw as { entries?: unknown }).entries;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) raw = Object.values(raw);
  }
  if (!Array.isArray(raw)) throw new Error('No vocabulary entries in this file');
  const entries: VocabEntry[] = [];
  let skipped = 0;
  for (const item of raw.slice(0, MAX_IMPORT_ENTRIES)) {
    const e = sanitizeEntry(item);
    if (!e) {
      skipped++;
      continue;
    }
    entries.push({
      ...e,
      word: cut(e.word, 200)!,
      lemma: cut(e.lemma, 200)!,
      id: vocabId(cut(e.lemma, 200)!),
      pos: cut(e.pos, 100),
      ipa: cut(e.ipa, 200),
      definitions: e.definitions.slice(0, MAX_DEFINITIONS).map((d) => cut(d, MAX_TEXT)!),
      note: cut(e.note, MAX_NOTE)!,
      contextSentence: cut(e.contextSentence, MAX_TEXT),
      sourceUrl: httpUrl(e.sourceUrl),
      sourceTitle: cut(e.sourceTitle, 500),
      saved: e.saved || !e.ignoreSpelling,
      createdAt: e.createdAt || e.updatedAt,
    });
  }
  skipped += Math.max(0, raw.length - MAX_IMPORT_ENTRIES);
  return { entries, skipped };
}

export interface ImportSummary {
  added: number;
  merged: number;
  skipped: number;
  /** Ids written (for the store). */
  changed: string[];
}

const noteLines = (note: string) =>
  note
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

/** Combines two notes: one is kept when it already has every line of the other, else both. */
function mergeNotes(a: string, b: string): string {
  const x = noteLines(a);
  const y = noteLines(b);
  if (x.every((l) => y.includes(l))) return b;
  if (y.every((l) => x.includes(l))) return a;
  return `${a.trimEnd()}\n${b.trim()}`;
}

/**
 * Merges two entries with the same lemma. The more recently updated one wins for
 * status and the place the word was met (sentence, URL, title kept together); empty
 * fields are filled from the other; notes are combined; flags are OR-ed; the earliest
 * creation, the latest update and the highest review count are kept.
 */
export function mergeEntries(a: VocabEntry, b: VocabEntry): VocabEntry {
  const [newer, older] = b.updatedAt > a.updatedAt ? [b, a] : [a, b];
  const fill = <T>(x: T | null, y: T | null) => x ?? y;
  const occurrence = newer.contextSentence || newer.sourceUrl ? newer : older;
  const created = [a.createdAt, b.createdAt].filter((t) => t > 0);
  return {
    id: a.id,
    word: newer.word,
    lemma: newer.lemma,
    pos: fill(newer.pos, older.pos),
    gender: fill(newer.gender, older.gender),
    ipa: fill(newer.ipa, older.ipa),
    definitions: newer.definitions.length > 0 ? newer.definitions : older.definitions,
    note: mergeNotes(older.note, newer.note),
    contextSentence: occurrence.contextSentence,
    sourceUrl: occurrence.sourceUrl,
    sourceTitle: occurrence.sourceTitle,
    status: newer.status,
    saved: a.saved || b.saved,
    ignoreSpelling: a.ignoreSpelling || b.ignoreSpelling,
    createdAt: created.length > 0 ? Math.min(...created) : 0,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    reviewCount: Math.max(a.reviewCount, b.reviewCount),
    // Flashcard schedule follows the status (US-10).
    dueAt: newer.dueAt,
    ease: newer.ease,
    intervalDays: newer.intervalDays,
  };
}

function sameEntry(a: VocabEntry, b: VocabEntry): boolean {
  return (Object.keys(b) as (keyof VocabEntry)[]).every((k) =>
    Array.isArray(a[k]) ? JSON.stringify(a[k]) === JSON.stringify(b[k]) : a[k] === b[k]
  );
}

/**
 * Adds imported entries to the notebook; an entry whose lemma is already there is
 * merged with it (mergeEntries). Entries without dates get `now`.
 */
export function mergeImport(
  state: VocabularyState,
  imported: readonly VocabEntry[],
  now: number
): Omit<ImportSummary, 'skipped'> {
  let added = 0;
  let merged = 0;
  const changed = new Set<string>();
  const counted = new Set<string>();
  for (const raw of imported) {
    const entry: VocabEntry = {
      ...raw,
      createdAt: raw.createdAt || now,
      updatedAt: raw.updatedAt || raw.createdAt || now,
    };
    const prev = state.entries[entry.id];
    const next = prev ? mergeEntries(prev, entry) : entry;
    if (!counted.has(entry.id)) {
      counted.add(entry.id);
      if (prev) merged++;
      else added++;
    }
    if (prev && sameEntry(prev, next)) continue;
    state.entries[entry.id] = next;
    changed.add(entry.id);
  }
  return { added, merged, changed: [...changed] };
}
