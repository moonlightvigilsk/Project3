import { describe, it, expect } from 'vitest';
import { resolveSuggestions } from '../resolve';
import type { GrammarSuggestion } from '@/types';

function createSuggestion(
  partial: Partial<GrammarSuggestion> & { original: string; replacement: string; startIndex: number; endIndex: number }
): GrammarSuggestion {
  return {
    id: `test-${Math.random()}`,
    explanation: 'Test explanation',
    type: 'grammar',
    ...partial,
  };
}

describe('resolveSuggestions', () => {
  it('handles exact index matches correctly', () => {
    const text = 'Nous allons visiter Paris demain.';
    // "visiter" is at [12, 19]
    const suggestions = [
      createSuggestion({
        original: 'visiter',
        replacement: 'voir',
        startIndex: 12,
        endIndex: 19,
      }),
    ];

    const result = resolveSuggestions(text, suggestions);
    expect(result).toHaveLength(1);
    expect(result[0].startIndex).toBe(12);
    expect(result[0].endIndex).toBe(19);
    expect(text.substring(result[0].startIndex, result[0].endIndex)).toBe('visiter');
  });

  it('corrects index when LLM reports an index offset by +2 or -3 characters', () => {
    const text = 'Nous allons mangé au restaurant ce soir.';
    // "mangé" is actually at [12, 17]
    // Simulate LLM hallucinating indices: startIndex: 14 (+2 off), endIndex: 19
    const suggestions = [
      createSuggestion({
        original: 'mangé',
        replacement: 'manger',
        startIndex: 14,
        endIndex: 19,
      }),
    ];

    const result = resolveSuggestions(text, suggestions);
    expect(result).toHaveLength(1);
    expect(result[0].startIndex).toBe(12);
    expect(result[0].endIndex).toBe(17);
    expect(text.substring(result[0].startIndex, result[0].endIndex)).toBe('mangé');
  });

  it('handles French accented characters: é, è, ê, à, ç', () => {
    const text = 'Le garçon a répété sa leçon à côté de la fenêtre.';
    // "garçon" is at index 3..9
    // "répété" is at index 12..18
    // "leçon" is at index 22..27
    const suggestions = [
      createSuggestion({
        original: 'répété',
        replacement: 'recommencé',
        startIndex: 10, // slightly off
        endIndex: 16,
      }),
      createSuggestion({
        original: 'garçon',
        replacement: 'jeune homme',
        startIndex: 3,
        endIndex: 9,
      }),
    ];

    const result = resolveSuggestions(text, suggestions);
    expect(result).toHaveLength(2);
    // Should be sorted by startIndex ascending
    expect(result[0].original).toBe('garçon');
    expect(result[0].startIndex).toBe(3);
    expect(result[0].endIndex).toBe(9);

    expect(result[1].original).toBe('répété');
    expect(result[1].startIndex).toBe(12);
    expect(result[1].endIndex).toBe(18);
    expect(text.substring(result[1].startIndex, result[1].endIndex)).toBe('répété');
  });

  it('matches curly apostrophe ’ when suggestion uses straight apostrophe \'', () => {
    // Text on website has curly apostrophe: "C’est l’ami"
    const text = 'C’est l’ami fidèle de Pierre.';
    // Suggestion from model uses straight apostrophe "l'ami"
    const suggestions = [
      createSuggestion({
        original: "l'ami",
        replacement: 'le camarade',
        startIndex: 5,
        endIndex: 10,
      }),
    ];

    const result = resolveSuggestions(text, suggestions);
    expect(result).toHaveLength(1);
    expect(result[0].startIndex).toBe(6);
    expect(result[0].endIndex).toBe(11);
    expect(text.substring(result[0].startIndex, result[0].endIndex)).toBe('l’ami');
  });

  it('selects the closest occurrence when original appears multiple times', () => {
    const text = 'Il a dit que c’est pas bien, mais c’est pas grave non plus.';
    // "c’est pas" appears twice:
    // First at index 13 ("c’est pas bien")
    // Second at index 35 ("c’est pas grave")
    const suggestionTargetingSecond = createSuggestion({
      original: "c'est pas",
      replacement: "ce n'est pas",
      startIndex: 32, // near the 2nd occurrence at 34
      endIndex: 41,
    });

    const result = resolveSuggestions(text, [suggestionTargetingSecond]);
    expect(result).toHaveLength(1);
    expect(result[0].startIndex).toBe(34);
    expect(result[0].endIndex).toBe(43);
    expect(text.substring(result[0].startIndex, result[0].endIndex)).toBe('c’est pas');
  });

  it('drops overlapping suggestions to prevent broken underlines', () => {
    const text = 'Nous avons fait une grosse erreur.';
    // "fait une" [11..19]
    // "une grosse" [16..26] -> overlaps with "fait une"
    const suggestions = [
      createSuggestion({
        original: 'fait une',
        replacement: 'commis une',
        startIndex: 11,
        endIndex: 19,
      }),
      createSuggestion({
        original: 'une grosse',
        replacement: 'une grande',
        startIndex: 16,
        endIndex: 26,
      }),
    ];

    const result = resolveSuggestions(text, suggestions);
    expect(result).toHaveLength(1);
    expect(result[0].original).toBe('fait une');
  });

  it('drops suggestions where original equals replacement', () => {
    const text = 'Bonjour le monde.';
    const suggestions = [
      createSuggestion({
        original: 'monde',
        replacement: 'monde',
        startIndex: 11,
        endIndex: 16,
      }),
    ];

    const result = resolveSuggestions(text, suggestions);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when text or suggestions are empty', () => {
    expect(resolveSuggestions('', [])).toEqual([]);
    expect(resolveSuggestions('Quelque chose', [])).toEqual([]);
  });
});

describe('whitespace-only corrections (found in US-11)', () => {
  it('keeps " ," -> "," and double spaces, drops identical replacements', () => {
    const text = 'D accord , nous  allons.';
    const s = (original: string, replacement: string, startIndex: number) => ({
      id: original,
      original,
      replacement,
      explanation: '',
      type: 'punctuation' as const,
      startIndex,
      endIndex: startIndex + original.length,
    });
    const out = resolveSuggestions(text, [s(' ,', ',', 8), s('  ', ' ', 15), s('nous', 'nous', 11)]);
    expect(out.map((x) => [x.original, x.startIndex])).toEqual([
      [' ,', 8],
      ['  ', 15],
    ]);
  });
});
