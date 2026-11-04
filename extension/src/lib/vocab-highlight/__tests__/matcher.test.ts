import { describe, expect, it } from 'vitest';
import type { VocabEntry } from '@/types';
import { buildMatcher, findMatches, highlightForms } from '../matcher';

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

const words = (text: string, entries: VocabEntry[]) => {
  const matcher = buildMatcher(entries);
  return matcher ? findMatches(text, matcher).map((m) => `${text.slice(m.start, m.end)}:${m.status}`) : [];
};

describe('highlightForms', () => {
  it('adds regular plurals and feminines, not verb conjugations', () => {
    expect(highlightForms(entry('maison', { pos: 'nom' }))).toEqual(['maison', 'maisons']);
    expect(highlightForms(entry('bateau', { pos: 'nom' }))).toEqual(['bateau', 'bateaux']);
    expect(highlightForms(entry('prix', { pos: 'nom' }))).toEqual(['prix']);
    expect(highlightForms(entry('grand', { pos: 'adjectif' }))).toEqual(['grand', 'grands', 'grande', 'grandes']);
    expect(highlightForms(entry('manger', { pos: 'verbe', word: 'mangeons' }))).toEqual(['manger', 'mangeons']);
    expect(highlightForms(entry('pomme de terre', { pos: 'nom' }))).toEqual(['pomme de terre']);
    expect(highlightForms(entry('y'))).toEqual([]);
  });
});

describe('buildMatcher / findMatches', () => {
  it('skips known and spelling-only entries', () => {
    expect(buildMatcher([entry('ami', { status: 'known' }), entry('zut', { saved: false, ignoreSpelling: true })])).toBeNull();
  });

  it('matches whole words, any case, after an elided article', () => {
    const list = [entry('école', { pos: 'nom' }), entry('être', { pos: 'verbe', status: 'learning' })];
    expect(words("L'École et les écoles. Peut-être une écolière, ÊTRE ou ne pas être.", list)).toEqual([
      'École:new',
      'écoles:new',
      'ÊTRE:learning',
      'être:learning',
    ]);
    expect(words('l’école', list)).toEqual(['école:new']);
  });

  it('prefers the longest phrase, across line breaks and curly apostrophes', () => {
    const list = [entry('pomme', { pos: 'nom' }), entry('pomme de terre', { status: 'learning' }), entry("aujourd'hui")];
    expect(words('Une pomme de\nterre, deux pommes, aujourd’hui.', list)).toEqual([
      'pomme de\nterre:learning',
      'pommes:new',
      'aujourd’hui:new',
    ]);
  });

  it('escapes regex characters and respects the limit', () => {
    const matcher = buildMatcher([entry('c++'), entry('a.b')])!;
    expect(findMatches('c++ et axb, a.b', matcher).map((m) => m.start)).toEqual([0, 12]);
    expect(findMatches('a.b a.b a.b', matcher, 2)).toHaveLength(2);
  });

  it('shows the less advanced status when two entries share a form', () => {
    const list = [entry('fils', { status: 'learning' }), entry('fil', { pos: 'nom', status: 'new' })];
    expect(words('les fils', list)).toEqual(['fils:new']);
  });
});
