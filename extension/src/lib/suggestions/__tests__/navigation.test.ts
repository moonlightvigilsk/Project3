import { describe, expect, it } from 'vitest';
import { nextSuggestion, suggestionAtCaret } from '../navigation';

// Deliberately not in text order.
const list = [
  { startIndex: 30, endIndex: 35 },
  { startIndex: 3, endIndex: 7 },
  { startIndex: 15, endIndex: 20 },
];

describe('suggestionAtCaret', () => {
  it('picks the error containing the caret', () => {
    expect(suggestionAtCaret(list, 17)).toBe(2);
    expect(suggestionAtCaret(list, 7)).toBe(1); // caret right after the word
  });
  it('else the next error after the caret, else the first one', () => {
    expect(suggestionAtCaret(list, 10)).toBe(2);
    expect(suggestionAtCaret(list, 40)).toBe(1);
    expect(suggestionAtCaret(list, null)).toBe(1);
  });
  it('returns -1 without suggestions', () => {
    expect(suggestionAtCaret([], 0)).toBe(-1);
  });
});

describe('nextSuggestion', () => {
  it('goes through the errors in text order and wraps around', () => {
    expect(nextSuggestion(list, list[1])).toBe(2);
    expect(nextSuggestion(list, list[2])).toBe(0);
    expect(nextSuggestion(list, list[0])).toBe(1);
    expect(nextSuggestion(list, null)).toBe(1);
  });
  it('handles errors starting at the same place', () => {
    const same = [
      { startIndex: 5, endIndex: 9 },
      { startIndex: 5, endIndex: 12 },
    ];
    expect(nextSuggestion(same, same[0])).toBe(1);
    expect(nextSuggestion(same, same[1])).toBe(0);
  });
});
