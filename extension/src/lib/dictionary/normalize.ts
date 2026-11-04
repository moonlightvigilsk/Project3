/** French elided prefixes that are not part of the word being looked up (l'ami -> ami). */
const ELISION_PREFIX = /^(?:l|d|j|m|t|s|n|c|ç|qu|jusqu|lorsqu|puisqu|quoiqu|presqu)'(?=\p{L})/iu;

/** Punctuation that commonly sticks to a selection: quotes, guillemets, brackets, sentence marks. */
const EDGE_PUNCTUATION = /^[\s"«»“”„‹›()[\]{}.,;:!?…–—-]+|[\s"«»“”„‹›()[\]{}.,;:!?…–—-]+$/gu;

/**
 * Turns a raw selection into the word to look up:
 * NFC, straight apostrophes, no surrounding punctuation, no elided article/pronoun.
 */
export function normalizeLookupQuery(raw: string): string {
  let text = raw
    .normalize('NFC')
    .replace(/[’‘ʼ`´]/g, "'")
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .replace(EDGE_PUNCTUATION, '')
    .trim();
  text = text.replace(ELISION_PREFIX, '');
  return text;
}

const LEADING_DETERMINER =
  /^(?:le|la|les|un|une|des|du|de|au|aux|mon|ma|mes|ton|ta|tes|son|sa|ses|notre|nos|votre|vos|leur|leurs|ce|cet|cette|ces)\s+(?=\p{L})/iu;

/**
 * Fallback when a phrase has no entry: drop a leading determiner
 * ("la maison" -> "maison"). Returns null when there is nothing to drop.
 */
export function withoutDeterminer(word: string): string | null {
  const stripped = word.replace(LEADING_DETERMINER, '');
  return stripped !== word && stripped ? stripped : null;
}

/**
 * Page titles to try, best first. Wiktionary titles are case-sensitive: a word
 * capitalized at the start of a sentence ("Maison") is usually the common noun
 * ("maison"), so the lowercase variant is tried too.
 */
export function lookupCandidates(word: string): string[] {
  const lower = word.toLocaleLowerCase('fr');
  return lower === word ? [word] : [word, lower];
}
