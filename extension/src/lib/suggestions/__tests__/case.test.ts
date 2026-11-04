import { describe, expect, it } from 'vitest';
import { matchCase, replacementFor } from '../case';
import { resolveSuggestions } from '../resolve';
import { MockChecker } from '@/lib/checker/mock-checker';
import type { GrammarSuggestion } from '@/types';

const check = async (text: string) =>
  (await new MockChecker().check(text, { language: 'auto' } as never)).suggestions.map((s) => [
    s.original,
    s.replacement,
    s.startIndex,
  ]);

describe('matchCase', () => {
  it('capital first letter, all capitals, lowercase', () => {
    expect(matchCase('Tu as fais', 'tu as fait')).toBe('Tu as fait');
    expect(matchCase('TU AS FAIS', 'tu as fait')).toBe('TU AS FAIT');
    expect(matchCase('tu as fais', 'tu as fait')).toBe('tu as fait');
    expect(matchCase('C est', "c'est")).toBe("C'est");
    expect(matchCase('École', 'écoles')).toBe('Écoles');
  });

  it('leaves replacements with their own capitals and non-letters alone', () => {
    expect(matchCase('paris', 'Paris')).toBe('Paris');
    expect(matchCase('Je', 'J’ai')).toBe('J’ai');
    expect(matchCase(' ,', ',')).toBe(',');
    expect(matchCase('A', 'à')).toBe('À'); // one capital letter: first letter only
  });

  it('a case correction stays a case correction', () => {
    expect(replacementFor('Le', 'le')).toBe('le');
    expect(replacementFor('Mon amis', 'mes amis')).toBe('Mes amis');
  });
});

describe('MockChecker: case-insensitive rules (US-12)', () => {
  it('finds "Tu as fais" at the start of a sentence and keeps the capital', async () => {
    expect(await check('Tu as fais une remarque.')).toEqual([['Tu as fais', 'Tu as fait', 0]]);
  });

  it('works for text and regex rules, in capitals and in the middle of a sentence', async () => {
    expect(await check('Hier tu as fais ça. TU AS FAIS ÇA. C est vrai, d accord ?')).toEqual([
      ['tu as fais', 'tu as fait', 5],
      ['TU AS FAIS', 'TU AS FAIT', 20],
      ['C est', "C'est", 35],
      ['d accord', "d'accord", 47],
    ]);
  });

  it('matches whole words only', async () => {
    expect(await check('Les pommes mangées.')).toEqual([]);
    expect(await check('Nous allons Mangé.')).toEqual([['Mangé', 'Manger', 12]]);
  });
});

describe('resolveSuggestions: case', () => {
  const s = (original: string, replacement: string, startIndex: number): GrammarSuggestion => ({
    id: original,
    original,
    replacement,
    explanation: '',
    type: 'grammar',
    startIndex,
    endIndex: startIndex + original.length,
  });

  it('finds a lowercase original (from an AI) in capitalised text and adapts the replacement', () => {
    const out = resolveSuggestions('Mon amis arrive.', [s('mon amis', 'mes amis', 0)]);
    expect(out.map((x) => [x.original, x.replacement, x.startIndex])).toEqual([['Mon amis', 'Mes amis', 0]]);
  });

  it('keeps a capitalisation fix from the AI', () => {
    const out = resolveSuggestions('Il vit à paris.', [s('paris', 'Paris', 9)]);
    expect(out.map((x) => x.replacement)).toEqual(['Paris']);
  });
});
