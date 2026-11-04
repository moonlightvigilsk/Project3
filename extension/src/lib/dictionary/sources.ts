import {
  DEFAULT_SOURCE_PREFS,
  normalizeSourcePrefs,
  type DictionarySourceId,
  type DictionarySourcePref,
  type UILanguage,
} from '@/types';
import { wiktionaryPageUrl } from './wiktionary';

export { DEFAULT_SOURCE_PREFS, normalizeSourcePrefs };
export type { DictionarySourceId, DictionarySourcePref };

export interface DictionarySource {
  id: DictionarySourceId;
  /** Brand name, shown as is in every UI language. */
  label: string;
  url: (word: string, uiLanguage: UILanguage) => string;
}

/** Le Robert slugs are lowercase ASCII with hyphens ("être" -> "etre", "pomme de terre" -> "pomme-de-terre"). */
export function leRobertSlug(word: string): string {
  return word
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .toLowerCase()
    .replace(/['’\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Google Translate target: the UI language, or English when the UI itself is French. */
export function translateTarget(uiLanguage: UILanguage): string {
  return uiLanguage === 'fr' ? 'en' : uiLanguage;
}

const enc = (w: string) => encodeURIComponent(w);

/** Single place for every external URL template. */
export const DICTIONARY_SOURCES: Record<DictionarySourceId, DictionarySource> = {
  larousse: {
    id: 'larousse',
    label: 'Larousse',
    url: (w) => `https://www.larousse.fr/dictionnaires/francais/${enc(w)}`,
  },
  lerobert: {
    id: 'lerobert',
    label: 'Le Robert',
    url: (w) => `https://dictionnaire.lerobert.com/definition/${leRobertSlug(w)}`,
  },
  cnrtl: {
    id: 'cnrtl',
    label: 'CNRTL',
    url: (w) => `https://www.cnrtl.fr/definition/${enc(w)}`,
  },
  google: {
    id: 'google',
    label: 'Google Translate',
    url: (w, ui) =>
      `https://translate.google.com/?sl=fr&tl=${translateTarget(ui)}&text=${enc(w)}&op=translate`,
  },
  wiktionary: {
    id: 'wiktionary',
    label: 'Wiktionary',
    url: (w) => wiktionaryPageUrl(w),
  },
};

export interface SourceLink {
  id: DictionarySourceId;
  label: string;
  href: string;
}

/** Links for the enabled sources, in the user's order. */
export function buildSourceLinks(
  word: string,
  prefs: DictionarySourcePref[],
  uiLanguage: UILanguage
): SourceLink[] {
  const w = word.trim();
  if (!w) return [];
  return normalizeSourcePrefs(prefs)
    .filter((p) => p.enabled)
    .map((p) => {
      const source = DICTIONARY_SOURCES[p.id];
      return { id: p.id, label: source.label, href: source.url(w, uiLanguage) };
    });
}

/** Moves the source at `index` one step up (-1) or down (+1). */
export function moveSourcePref(prefs: DictionarySourcePref[], index: number, delta: -1 | 1): DictionarySourcePref[] {
  const target = index + delta;
  if (index < 0 || index >= prefs.length || target < 0 || target >= prefs.length) return prefs;
  const next = prefs.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
