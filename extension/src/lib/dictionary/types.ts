/**
 * Bump when the Wiktionary parsing changes what a lookup returns, so cached results built
 * by the older parser are fetched again (2: audio US-04, {{lien}} form-of links US-06).
 */
export const PARSER_VERSION = 2;

export type Gender = 'm' | 'f' | 'mf';

export interface DictionarySense {
  definition: string;
  example?: string;
}

/** One part-of-speech block of a French Wiktionary entry ("nom", "verbe"...). */
export interface DictionaryEntry {
  /** French part-of-speech label as used by fr.wiktionary, e.g. "nom", "verbe", "adjectif". */
  pos: string;
  /** True for inflected forms ("flexion" sections: conjugations, plurals, feminines). */
  isInflection: boolean;
  gender: Gender | null;
  ipa: string | null;
  senses: DictionarySense[];
}

/** Recorded pronunciation from Wikimedia Commons (US-04). */
export interface PronunciationAudio {
  /** Commons file name, e.g. "LL-Q150 (fra)-Lyokoï-allé.wav". */
  file: string;
  /** Speaker's region as given on Wiktionary ("France (Paris)"), when known. */
  region: string | null;
}

export interface EnglishGloss {
  pos: string;
  definitions: string[];
}

export interface LookupResult {
  /** Normalized word that was looked up (e.g. "ami" for a selection "l'ami,"). */
  word: string;
  /** Dictionary form; equals `word` unless `word` is an inflection. */
  lemma: string;
  /** Pronunciation of `word` itself. */
  ipa: string | null;
  /** Set when `word` is an inflected form of `lemma`. */
  formOf: { lemma: string; description: string } | null;
  /** French entries of the lemma (or of the word when no lemma could be resolved). */
  entries: DictionaryEntry[];
  /** English glosses from en.wiktionary, when available. */
  english: EnglishGloss[];
  /** Origin of the lemma ("Du latin mansio..."), when Wiktionary has one. Missing in results cached before it existed. */
  etymology?: string | null;
  /** Recording of `word` (the displayed word). Missing in results cached before US-04. */
  audio?: PronunciationAudio | null;
  /** Page to open for the full entry. */
  sourceUrl: string;
  /** PARSER_VERSION that built this result; missing in results cached by older versions. */
  parserVersion?: number;
}

export type LookupResponse =
  | { status: 'ok'; result: LookupResult }
  | { status: 'not_found'; word: string }
  | { status: 'error'; word: string; message: string };
