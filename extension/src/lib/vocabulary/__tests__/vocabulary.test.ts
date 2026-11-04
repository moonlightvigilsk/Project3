import { describe, expect, it } from 'vitest';
import {
  clearFlag,
  emptyVocabulary,
  ignoredSpellings,
  migrateLegacy,
  parseBookmarkSubtitle,
  parseVocabulary,
  savedEntries,
  spellingEntries,
  toBackendVocabulary,
  updateEntry,
  upsertEntry,
  vocabDraftFromLookup,
  vocabId,
  VOCABULARY_KEY,
} from '../model';
import type { LookupResult } from '@/lib/dictionary/types';

const T0 = Date.UTC(2026, 0, 1);

describe('migrateLegacy', () => {
  it('turns the old dictionary into entries ignored by the spell check', () => {
    const state = migrateLegacy(['textchecker', 'Grammarly', '', 42, 'textchecker'], undefined, T0);
    expect(Object.keys(state.entries).sort()).toEqual(['grammarly', 'textchecker']);
    expect(state.entries.grammarly).toMatchObject({
      word: 'Grammarly',
      lemma: 'Grammarly',
      ignoreSpelling: true,
      saved: false,
      status: 'new',
      reviewCount: 0,
      definitions: [],
      note: '',
      createdAt: T0,
      updatedAt: T0,
    });
  });

  it('turns ☆ word bookmarks into saved entries and ignores other bookmarks', () => {
    const bookmarks = [
      { id: 'word:manger', kind: 'word', title: 'manger', subtitle: 'verbe · /mɑ̃.ʒe/ · Mâcher et avaler un aliment.', url: 'https://fr.wiktionary.org/wiki/manger', createdAt: 5 },
      { id: 'grammar:x', kind: 'grammar', title: 'Subjonctif' },
      { id: 'resource:y', kind: 'resource', title: 'Le Robert', url: 'https://x' },
      { id: 'word:bad', kind: 'word', title: '   ' },
    ];
    const state = migrateLegacy(undefined, bookmarks, T0);
    expect(Object.keys(state.entries)).toEqual(['manger']);
    expect(state.entries.manger).toMatchObject({
      lemma: 'manger',
      pos: 'verbe',
      ipa: 'mɑ̃.ʒe',
      definitions: ['Mâcher et avaler un aliment.'],
      saved: true,
      ignoreSpelling: false,
      sourceUrl: null, // the bookmark URL was the dictionary page
      createdAt: 5,
    });
  });

  it('merges a word found in both into one entry with both flags', () => {
    const state = migrateLegacy(['maison'], [{ id: 'word:maison', kind: 'word', title: 'maison', createdAt: 1 }], T0);
    expect(Object.keys(state.entries)).toEqual(['maison']);
    expect(state.entries.maison).toMatchObject({ saved: true, ignoreSpelling: true, createdAt: 1 });
  });

  it('copes with missing or malformed legacy data', () => {
    expect(migrateLegacy(undefined, undefined, T0)).toEqual(emptyVocabulary());
    expect(migrateLegacy('oops', { kind: 'word' }, T0)).toEqual(emptyVocabulary());
  });
});

describe('parseBookmarkSubtitle', () => {
  it('splits part of speech, IPA and definition', () => {
    expect(parseBookmarkSubtitle('nom · /me.zɔ̃/ · Bâtiment · logement')).toEqual({
      pos: 'nom',
      ipa: 'me.zɔ̃',
      definition: 'Bâtiment · logement',
    });
    expect(parseBookmarkSubtitle('/a.mi/')).toEqual({ pos: null, ipa: 'a.mi', definition: null });
    expect(parseBookmarkSubtitle(undefined)).toEqual({ pos: null, ipa: null, definition: null });
    expect(parseBookmarkSubtitle('Une phrase entière')).toEqual({ pos: null, ipa: null, definition: 'Une phrase entière' });
  });
});

describe('upsertEntry / clearFlag / updateEntry', () => {
  it('keys entries by normalized lemma and keeps learning data on update', () => {
    const state = emptyVocabulary();
    upsertEntry(state, { word: 'mangeons', lemma: 'Manger', pos: 'verbe', saved: true }, T0);
    updateEntry(state, 'manger', { status: 'learning', reviewCount: 3, note: 'irrégulier ?' }, T0 + 1);
    const again = upsertEntry(state, { word: 'mange', lemma: 'manger', ipa: 'mɑ̃.ʒe', definitions: ['Mâcher.'] }, T0 + 2);
    expect(again).toMatchObject({
      id: 'manger',
      word: 'mange',
      pos: 'verbe', // kept: not in the draft
      ipa: 'mɑ̃.ʒe', // filled
      status: 'learning',
      reviewCount: 3,
      note: 'irrégulier ?',
      saved: true,
      createdAt: T0,
      updatedAt: T0 + 2,
    });
    expect(vocabId(' Pomme de terre ')).toBe('pomme de terre');
    expect(vocabId('été')).toBe('été'); // NFD input -> NFC id
  });

  it('deletes an entry only when it is neither saved nor ignored', () => {
    const state = emptyVocabulary();
    upsertEntry(state, { word: 'maison', saved: true, ignoreSpelling: true }, T0);
    expect(clearFlag(state, 'maison', 'saved', T0)).toMatchObject({ saved: false, ignoreSpelling: true });
    expect(clearFlag(state, 'maison', 'ignoreSpelling', T0)).toBeNull();
    expect(state.entries.maison).toBeUndefined();
    expect(clearFlag(state, 'absent', 'saved', T0)).toBeNull();
  });

  it('rejects invalid updates', () => {
    const state = emptyVocabulary();
    upsertEntry(state, { word: 'ami', saved: true }, T0);
    updateEntry(state, 'ami', { status: 'bogus' as never, reviewCount: -4 }, T0);
    expect(state.entries.ami).toMatchObject({ status: 'new', reviewCount: 0 });
    expect(updateEntry(state, 'absent', { note: 'x' }, T0)).toBeNull();
  });

  it('lists ignored spellings (word and lemma) and saved words', () => {
    const state = emptyVocabulary();
    upsertEntry(state, { word: 'Grammarly', ignoreSpelling: true }, T0);
    upsertEntry(state, { word: 'mangeons', lemma: 'manger', saved: true }, T0 + 1);
    upsertEntry(state, { word: 'ami', saved: true }, T0 + 2);
    expect([...ignoredSpellings(state)]).toEqual(['grammarly']);
    expect(savedEntries(state).map((e) => e.id)).toEqual(['ami', 'manger']);
    expect(spellingEntries(state).map((e) => e.word)).toEqual(['Grammarly']);
  });
});

describe('parseVocabulary', () => {
  it('drops malformed entries and repairs fields', () => {
    const state = parseVocabulary({
      version: 1,
      entries: {
        a: { word: 'ami', status: 'weird', definitions: ['x', 3], reviewCount: 2.7, saved: true },
        b: { word: '' },
        c: null,
        d: 'nope',
      },
    });
    expect(Object.keys(state!.entries)).toEqual(['ami']);
    expect(state!.entries.ami).toMatchObject({ status: 'new', definitions: ['x'], reviewCount: 2, lemma: 'ami' });
    expect(parseVocabulary(undefined)).toBeNull();
    expect(parseVocabulary({ entries: 'x' })).toEqual(emptyVocabulary());
  });
});

describe('vocabDraftFromLookup / toBackendVocabulary', () => {
  const result: LookupResult = {
    word: 'mangeons',
    lemma: 'manger',
    ipa: 'mɑ̃.ʒɔ̃',
    formOf: { lemma: 'manger', description: 'Première personne du pluriel…' },
    entries: [
      {
        pos: 'verbe',
        isInflection: false,
        gender: null,
        ipa: 'mɑ̃.ʒe',
        senses: [{ definition: 'a' }, { definition: 'b' }, { definition: 'c' }, { definition: 'd' }],
      },
    ],
    english: [],
    audio: null,
    sourceUrl: 'https://fr.wiktionary.org/wiki/manger',
  };

  it("uses the lemma's data, not the inflected form's IPA", () => {
    expect(vocabDraftFromLookup(result, { url: 'https://site/page', title: 'Page' })).toEqual({
      word: 'mangeons',
      lemma: 'manger',
      pos: 'verbe',
      gender: null,
      ipa: 'mɑ̃.ʒe',
      definitions: ['a', 'b', 'c'],
      sourceUrl: 'https://site/page',
      sourceTitle: 'Page',
    });
  });

  it('maps to the backend vocabulary_items columns', () => {
    const state = emptyVocabulary();
    const entry = upsertEntry(state, { ...vocabDraftFromLookup(result, { url: null, title: null }), saved: true }, T0);
    expect(toBackendVocabulary(entry)).toEqual({
      lemma: 'manger',
      surface_form: 'mangeons',
      pos: 'verbe',
      definition: 'a; b; c',
      definition_source: 'wiktionary',
      status: 'new',
      context_sentence: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
  });
});

