/**
 * Keeps the capitalisation of the text being corrected (US-12): rules are written in
 * lowercase ("tu as fais" -> "tu as fait") but must give "Tu as fait" at the start of
 * a sentence and "TU AS FAIT" in a title written in capitals.
 */

const hasLetters = (s: string) => /\p{L}/u.test(s);
const isAllUpper = (s: string) => hasLetters(s) && s === s.toLocaleUpperCase('fr') && s !== s.toLocaleLowerCase('fr');
const firstLetterIndex = (s: string) => s.search(/\p{L}/u);

/**
 * Applies the case of `original` to `replacement`. Only an all-lowercase replacement is
 * changed (one with capitals is taken as written: "paris" -> "Paris" stays as is):
 * - original in capitals (at least two letters): replacement in capitals,
 * - original starting with a capital: first letter of the replacement in capital.
 */
export function matchCase(original: string, replacement: string): string {
  if (!hasLetters(replacement) || replacement !== replacement.toLocaleLowerCase('fr')) return replacement;
  const letters = original.replace(/[^\p{L}]/gu, '');
  if (letters.length >= 2 && isAllUpper(letters)) return replacement.toLocaleUpperCase('fr');
  const o = firstLetterIndex(original);
  if (o >= 0 && isAllUpper(original[o])) {
    const r = firstLetterIndex(replacement);
    return replacement.slice(0, r) + replacement[r].toLocaleUpperCase('fr') + replacement.slice(r + 1);
  }
  return replacement;
}

/**
 * Replacement to show and apply for `original`. When matching the case would make it
 * identical to the original, the suggestion was itself a case correction
 * ("Le" -> "le" in the middle of a sentence): the replacement is kept as given.
 */
export function replacementFor(original: string, replacement: string): string {
  const cased = matchCase(original, replacement);
  return cased === original ? replacement : cased;
}
