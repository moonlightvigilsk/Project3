/**
 * Keyboard navigation between grammar suggestions (US-16): the shortcut opens the error at
 * or after the caret, and each further press moves to the next one (wrapping around).
 */
export interface Located {
  startIndex: number;
  endIndex: number;
}

/** Index of the suggestion to open first: the one containing the caret, else the next one, else the first. */
export function suggestionAtCaret(suggestions: readonly Located[], caret: number | null): number {
  if (suggestions.length === 0) return -1;
  const order = sortedIndexes(suggestions);
  if (caret === null) return order[0];
  const inside = order.find((i) => suggestions[i].startIndex <= caret && caret <= suggestions[i].endIndex);
  if (inside !== undefined) return inside;
  const after = order.find((i) => suggestions[i].startIndex >= caret);
  return after ?? order[0];
}

/** Index of the suggestion after `current` in text order, wrapping to the first. */
export function nextSuggestion(suggestions: readonly Located[], current: Located | null): number {
  if (suggestions.length === 0) return -1;
  const order = sortedIndexes(suggestions);
  if (!current) return order[0];
  const next = order.find((i) => {
    const s = suggestions[i];
    return s.startIndex > current.startIndex || (s.startIndex === current.startIndex && s.endIndex > current.endIndex);
  });
  return next ?? order[0];
}

function sortedIndexes(suggestions: readonly Located[]): number[] {
  return suggestions
    .map((_, i) => i)
    .sort((a, b) => suggestions[a].startIndex - suggestions[b].startIndex || suggestions[a].endIndex - suggestions[b].endIndex);
}
