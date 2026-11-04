import type { GrammarSuggestion } from '@/types';
import { replacementFor } from './case';

/**
 * Normalizes text to handle apostrophes, quotes, unicode NFC form, and line breaks.
 */
function normalizeForSearch(str: string): string {
  return str
    .normalize('NFC')
    .replace(/[’‘ʻ`]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/\r\n/g, '\n');
}

/**
 * Escapes regex special characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a flexible regex from an original string to tolerate apostrophe variations and whitespace differences.
 */
function buildFlexibleRegex(str: string): RegExp {
  const normalized = normalizeForSearch(str);
  // Replace straight apostrophe with a character class matching any apostrophe
  let pattern = escapeRegex(normalized).replace(/'/g, "['’‘ʻ`]");
  // Replace spaces with flexible whitespace
  pattern = pattern.replace(/\s+/g, '\\s+');
  // Case-insensitive (US-12): "tu as fais" from a rule or an AI must find "Tu as fais".
  return new RegExp(pattern, 'giu');
}

/**
 * Resolves raw grammar/spelling suggestions against the actual text.
 * Handles:
 * 1. Exact index matches
 * 2. LLM off-by-N character index errors by finding closest occurrence
 * 3. Unicode, curly apostrophe (’ vs '), and whitespace normalization
 * 4. Deduplication, filtering trivial replacements (original === replacement),
 *    and overlapping suggestion conflicts
 * 5. Sorting in ascending order of startIndex
 */
export function resolveSuggestions(
  text: string,
  rawSuggestions: GrammarSuggestion[]
): GrammarSuggestion[] {
  if (!text || !rawSuggestions || rawSuggestions.length === 0) {
    return [];
  }

  const resolved: GrammarSuggestion[] = [];

  for (const raw of rawSuggestions) {
    if (!raw.original) {
      continue;
    }
    // Whitespace-only originals (double space) are kept only at their exact position:
    // searching the text for "  " elsewhere would underline an unrelated place.
    const whitespaceOnly = raw.original.trim() === '';
    if (whitespaceOnly && text.substring(raw.startIndex, raw.endIndex) !== raw.original) {
      continue;
    }

    // Skip suggestions where original text equals replacement. Compared as is: a change
    // of spaces only (" ," -> ",", "  " -> " ") is a real punctuation correction.
    if (raw.original === raw.replacement) {
      continue;
    }

    const originalLen = raw.original.length;
    let finalStart = -1;
    let finalEnd = -1;
    let resolvedOriginal = raw.original;

    // 1. Direct check: does text at given indices match exactly?
    if (
      raw.startIndex >= 0 &&
      raw.endIndex <= text.length &&
      raw.startIndex < raw.endIndex &&
      text.substring(raw.startIndex, raw.endIndex) === raw.original
    ) {
      finalStart = raw.startIndex;
      finalEnd = raw.endIndex;
    } else {
      // 2. Exact substring search: find all occurrences of raw.original
      const matches: number[] = [];
      let searchIdx = 0;
      while (searchIdx < text.length) {
        const idx = text.indexOf(raw.original, searchIdx);
        if (idx === -1) break;
        matches.push(idx);
        searchIdx = idx + 1;
      }

      if (matches.length > 0) {
        // Find the occurrence closest to raw.startIndex
        let bestIdx = matches[0];
        let minDiff = Math.abs(bestIdx - raw.startIndex);

        for (let i = 1; i < matches.length; i++) {
          const diff = Math.abs(matches[i] - raw.startIndex);
          if (diff < minDiff) {
            minDiff = diff;
            bestIdx = matches[i];
          }
        }

        finalStart = bestIdx;
        finalEnd = bestIdx + originalLen;
      } else {
        // 3. Normalized / flexible search (apostrophes, unicode, spaces)
        try {
          const flexRegex = buildFlexibleRegex(raw.original);
          const flexMatches: { start: number; end: number; matchedText: string }[] = [];
          let match: RegExpExecArray | null;

          while ((match = flexRegex.exec(text)) !== null) {
            flexMatches.push({
              start: match.index,
              end: match.index + match[0].length,
              matchedText: match[0],
            });
            if (match.index === flexRegex.lastIndex) {
              flexRegex.lastIndex++;
            }
          }

          if (flexMatches.length > 0) {
            let bestMatch = flexMatches[0];
            let minDiff = Math.abs(bestMatch.start - raw.startIndex);

            for (let i = 1; i < flexMatches.length; i++) {
              const diff = Math.abs(flexMatches[i].start - raw.startIndex);
              if (diff < minDiff) {
                minDiff = diff;
                bestMatch = flexMatches[i];
              }
            }

            finalStart = bestMatch.start;
            finalEnd = bestMatch.end;
            resolvedOriginal = bestMatch.matchedText;
          }
        } catch {
          // Fallback if regex construction fails
        }
      }
    }

    // 4. If still not found, log warning and discard
    if (finalStart === -1 || finalEnd === -1) {
      console.warn(
        `[resolveSuggestions] Discarded suggestion "${raw.original}" - could not match in text:`,
        text.substring(0, 50) + (text.length > 50 ? '...' : '')
      );
      continue;
    }

    // US-12: keep the capitals of the corrected text ("Tu as fais" -> "Tu as fait").
    const replacement = replacementFor(resolvedOriginal, raw.replacement);
    if (replacement === resolvedOriginal) continue;
    resolved.push({
      ...raw,
      original: resolvedOriginal,
      replacement,
      startIndex: finalStart,
      endIndex: finalEnd,
    });
  }

  // 5. Sort by startIndex ascending, then by length descending for ties
  resolved.sort((a, b) => {
    if (a.startIndex !== b.startIndex) {
      return a.startIndex - b.startIndex;
    }
    return (b.endIndex - b.startIndex) - (a.endIndex - a.startIndex);
  });

  // 6. De-duplicate and eliminate overlaps
  const nonOverlapping: GrammarSuggestion[] = [];
  let lastEnd = -1;

  for (const suggestion of resolved) {
    // If the suggestion starts before the previous suggestion ends, they overlap
    if (suggestion.startIndex < lastEnd) {
      console.warn(
        `[resolveSuggestions] Dropping overlapping suggestion "${suggestion.original}" [${suggestion.startIndex}, ${suggestion.endIndex}] overlapping with previous up to ${lastEnd}`
      );
      continue;
    }

    nonOverlapping.push(suggestion);
    lastEnd = suggestion.endIndex;
  }

  return nonOverlapping;
}
