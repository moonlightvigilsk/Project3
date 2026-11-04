import { describe, expect, it } from 'vitest';
import type { VocabEntry } from '@/types';
import { browseVocabulary, countByStatus, foldText, matchRank } from '../browse';

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
    createdAt: 0,
    updatedAt: 0,
    reviewCount: 0,
    dueAt: 0,
    ease: 2.5,
    intervalDays: 0,
    ...extra,
  };
}

const ecole = entry('école', { createdAt: 3, status: 'learning', definitions: ['Établissement d’enseignement.'] });
const coeur = entry('cœur', { createdAt: 1, status: 'known', note: 'tim' });
const manger = entry('manger', {
  word: 'mangeons',
  createdAt: 2,
  contextSentence: 'Nous mangeons à l’école.',
  sourceTitle: 'Le Monde',
});
const all = [coeur, manger, ecole];

describe('foldText', () => {
  it('ignores case, accents, ligatures and curly apostrophes', () => {
    expect(foldText('  École ')).toBe('ecole');
    expect(foldText('Cœur')).toBe('coeur');
    expect(foldText('l’ami')).toBe("l'ami");
  });
});

describe('matchRank', () => {
  it('ranks the headword before other fields', () => {
    expect(matchRank(ecole, 'eco')).toBe(0);
    expect(matchRank(ecole, 'col')).toBe(1);
    expect(matchRank(manger, 'mangeons')).toBe(0); // the form met in the text
    expect(matchRank(manger, 'ecole')).toBe(2); // context sentence
    expect(matchRank(coeur, 'TIM')).toBe(2); // note
    expect(matchRank(manger, 'monde')).toBe(2); // page title
    expect(matchRank(coeur, 'xyz')).toBeNull();
  });
});

describe('browseVocabulary', () => {
  it('sorts by date added (newest first) by default, status changes do not reorder', () => {
    const touched = { ...coeur, updatedAt: 99 };
    expect(browseVocabulary([touched, manger, ecole]).map((e) => e.lemma)).toEqual(['école', 'manger', 'cœur']);
  });

  it('sorts alphabetically (French order) and by status', () => {
    expect(browseVocabulary(all, { sort: 'alpha' }).map((e) => e.lemma)).toEqual(['cœur', 'école', 'manger']);
    expect(browseVocabulary(all, { sort: 'status' }).map((e) => e.lemma)).toEqual(['manger', 'école', 'cœur']);
  });

  it('filters by status', () => {
    expect(browseVocabulary(all, { status: 'known' }).map((e) => e.lemma)).toEqual(['cœur']);
    expect(browseVocabulary(all, { status: 'all' })).toHaveLength(3);
  });

  it('puts headword matches before matches in the sentence, whatever the sort', () => {
    expect(browseVocabulary(all, { query: 'école' }).map((e) => e.lemma)).toEqual(['école', 'manger']);
    expect(browseVocabulary(all, { query: 'ecole', sort: 'alpha', status: 'new' }).map((e) => e.lemma)).toEqual([
      'manger',
    ]);
  });
});

describe('countByStatus', () => {
  it('counts each status and the total', () => {
    expect(countByStatus(all)).toEqual({ all: 3, new: 1, learning: 1, known: 1 });
  });
});
