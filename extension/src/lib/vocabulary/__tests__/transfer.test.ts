import { describe, expect, it } from 'vitest';
import type { VocabEntry } from '@/types';
import { emptyVocabulary } from '../model';
import {
  CSV_HEADER,
  ankiBack,
  ankiFront,
  exportFileName,
  mergeEntries,
  mergeImport,
  parseImport,
  toAnkiTsv,
  toCsv,
  toJsonBackup,
} from '../transfer';
import { VocabularyStore, type VocabularyStorage } from '../store';

function entry(lemma: string, extra: Partial<VocabEntry> = {}): VocabEntry {
  return {
    id: lemma.toLowerCase(),
    word: lemma,
    lemma,
    pos: null,
    gender: null,
    ipa: null,
    definitions: [],
    note: '',
    contextSentence: null,
    sourceUrl: null,
    sourceTitle: null,
    status: 'new',
    saved: true,
    ignoreSpelling: false,
    createdAt: 1000,
    updatedAt: 1000,
    reviewCount: 0,
    dueAt: 0,
    ease: 2.5,
    intervalDays: 0,
    ...extra,
  };
}

const manger = entry('manger', {
  word: 'mangeons',
  pos: 'verbe',
  ipa: 'mɑ̃.ʒe',
  definitions: ['Mâcher et avaler.', 'Prendre un repas.'],
  contextSentence: 'Nous "mangeons" ensemble.',
  status: 'learning',
  note: 'ăn\nbữa',
  createdAt: new Date(2026, 10, 4, 9, 5).getTime(),
});

/** Minimal RFC 4180 reader, to check what a spreadsheet would read. */
function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(field), (field = '');
    else if (c === '\r' && text[i + 1] === '\n') {
      row.push(field), rows.push(row), (row = []), (field = ''), i++;
    } else field += c;
  }
  return rows;
}

describe('toCsv', () => {
  it('uses the backend columns, quotes every field, ends lines with CRLF', () => {
    const csv = toCsv([manger]);
    expect(csv.startsWith('﻿"Lemma","Từ gốc","Loại từ (POS)"')).toBe(true);
    const rows = readCsv(csv.slice(1));
    expect(rows[0]).toEqual([...CSV_HEADER]);
    expect(rows[1]).toEqual([
      'manger',
      'mangeons',
      'verbe',
      'learning',
      '1',
      'Mâcher et avaler.; Prendre un repas.',
      '',
      'Nous "mangeons" ensemble.',
      '2026-11-04 09:05',
    ]);
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('neutralises spreadsheet formulas', () => {
    const rows = readCsv(toCsv([entry('x', { definitions: ['=HYPERLINK("http://evil")'] })]).slice(1));
    expect(rows[1][5]).toBe('\'=HYPERLINK("http://evil")');
  });
});

describe('Anki export', () => {
  it('front = word + IPA (+ form met), back = meaning + sentence + note, HTML-escaped', () => {
    expect(ankiFront(manger)).toBe('<b>manger</b> /mɑ̃.ʒe/<br><i>mangeons</i>');
    expect(ankiBack(manger)).toBe(
      '<small>verbe</small><br><ol><li>Mâcher et avaler.</li><li>Prendre un repas.</li></ol><br>' +
        '<i>« Nous &quot;mangeons&quot; ensemble. »</i><br><small>ăn<br>bữa</small>'
    );
    expect(ankiFront(entry('<b>x</b>'))).toBe('<b>&lt;b&gt;x&lt;/b&gt;</b>');
  });

  it('is one note per line with Anki file headers and a status tag', () => {
    const lines = toAnkiTsv([manger, entry('ami')]).trimEnd().split('\n');
    expect(lines.slice(0, 4)).toEqual(['#separator:tab', '#html:true', '#columns:Front\tBack\tTags', '#tags column:3']);
    expect(lines).toHaveLength(6);
    expect(lines[4].split('\t')).toHaveLength(3);
    expect(lines[4].split('\t')[2]).toBe('textchecker textchecker::learning');
  });
});

describe('JSON backup / parseImport', () => {
  it('round-trips the export', () => {
    const json = toJsonBackup([manger, entry('ami')], 0);
    const { entries, skipped } = parseImport(JSON.parse(json));
    expect(skipped).toBe(0);
    expect(entries).toEqual([manger, entry('ami')]);
  });

  it('accepts a plain list or the old inline object, skips invalid items', () => {
    expect(parseImport([{ word: 'chat' }, { nope: 1 }, 'x']).entries.map((e) => e.id)).toEqual(['chat']);
    expect(parseImport([{ word: 'chat' }, { nope: 1 }]).skipped).toBe(1);
    expect(parseImport({ version: 1, entries: { a: { word: 'Ami' } } }).entries[0].id).toBe('ami');
    expect(() => parseImport({ hello: 'world' })).toThrow();
    expect(() => parseImport('text')).toThrow();
  });

  it('imports words as saved (unless only ignored for spelling), keeps only http(s) links, cuts long texts', () => {
    const [e] = parseImport([{ word: 'chat', sourceUrl: 'javascript:alert(1)', note: 'x'.repeat(9000) }]).entries;
    expect(e.saved).toBe(true);
    expect(e.sourceUrl).toBeNull();
    expect(e.note).toHaveLength(5000);
    expect(parseImport([{ word: 'a', sourceUrl: 'https://ok.example/' }]).entries[0].sourceUrl).toBe('https://ok.example/');
    expect(parseImport([{ word: 'zut', ignoreSpelling: true }]).entries[0]).toMatchObject({ saved: false, ignoreSpelling: true });
  });
});

describe('mergeEntries / mergeImport', () => {
  const mine = entry('maison', {
    status: 'known',
    note: 'nhà',
    definitions: ['Bâtiment.'],
    contextSentence: 'Ma maison.',
    sourceUrl: 'https://a.example/',
    reviewCount: 4,
    createdAt: 100,
    updatedAt: 500,
  });

  it('newer wins for status and occurrence, gaps are filled, notes combined', () => {
    const theirs = entry('Maison', {
      status: 'learning',
      ipa: 'mɛ.zɔ̃',
      note: 'ngôi nhà',
      contextSentence: 'Une maison.',
      sourceUrl: 'https://b.example/',
      sourceTitle: 'B',
      reviewCount: 1,
      createdAt: 300,
      updatedAt: 900,
      ignoreSpelling: true,
    });
    const m = mergeEntries(mine, theirs);
    expect(m).toMatchObject({
      id: 'maison',
      status: 'learning',
      ipa: 'mɛ.zɔ̃',
      definitions: ['Bâtiment.'],
      note: 'nhà\nngôi nhà',
      contextSentence: 'Une maison.',
      sourceUrl: 'https://b.example/',
      sourceTitle: 'B',
      reviewCount: 4,
      createdAt: 100,
      updatedAt: 900,
      saved: true,
      ignoreSpelling: true,
    });
    // Older import: our data stays, a note already contained is not repeated.
    const old = mergeEntries(mine, { ...theirs, updatedAt: 200, note: 'nhà' });
    expect(old).toMatchObject({ status: 'known', note: 'nhà', contextSentence: 'Ma maison.', sourceTitle: null });
  });

  it('adds new words, merges same-lemma words (also within the file), reports what changed', () => {
    const state = emptyVocabulary();
    state.entries.maison = mine;
    const result = mergeImport(
      state,
      [mine, entry('chat', { createdAt: 0, updatedAt: 0 }), entry('Chat', { note: 'mèo', updatedAt: 0, createdAt: 0 })],
      7000
    );
    expect(result).toEqual({ added: 1, merged: 1, changed: ['chat'] }); // re-importing "maison" changes nothing
    expect(state.entries.chat).toMatchObject({ note: 'mèo', createdAt: 7000 });
    expect(Object.keys(state.entries)).toHaveLength(2);
  });
});

describe('VocabularyStore.importEntries', () => {
  it('merges into storage in one write and validates the payload', async () => {
    const data: Record<string, unknown> = {};
    const storage: VocabularyStorage = {
      get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]])),
      set: async (items) => void Object.assign(data, items),
      remove: async (keys) => keys.forEach((k) => delete data[k]),
      getLegacyDictionary: async () => [],
    };
    const store = new VocabularyStore(storage, () => 5);
    await store.apply({ op: 'save', draft: { word: 'ami', note: 'bạn' } });
    const summary = await store.importEntries({ entries: [{ word: 'ami', note: 'friend', updatedAt: 9 }, { word: 'chat' }, 42] });
    expect(summary).toMatchObject({ added: 1, merged: 1, skipped: 1 });
    expect(data['vocab:ami']).toMatchObject({ note: 'bạn\nfriend', saved: true });
    expect(data['vocab:chat']).toMatchObject({ saved: true, createdAt: 5 });
    await expect(store.importEntries({ nothing: true })).rejects.toThrow();
  });
});

describe('exportFileName', () => {
  it('follows the backend pattern', () => {
    expect(exportFileName('vocab_export', new Date(2026, 10, 4, 15, 42, 7).getTime(), 'csv')).toBe(
      'vocab_export_20261104_154207.csv'
    );
  });
});
