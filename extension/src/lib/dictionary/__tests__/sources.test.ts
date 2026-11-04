import { describe, expect, it } from 'vitest';
import {
  buildSourceLinks,
  DEFAULT_SOURCE_PREFS,
  leRobertSlug,
  moveSourcePref,
  normalizeSourcePrefs,
  translateTarget,
} from '../sources';
import { withDefaultSettings } from '@/types';

describe('URL templates', () => {
  it('builds every source URL for a word', () => {
    const all = DEFAULT_SOURCE_PREFS.map((p) => ({ ...p, enabled: true }));
    const links = buildSourceLinks('être', all, 'vi');
    expect(Object.fromEntries(links.map((l) => [l.id, l.href]))).toEqual({
      larousse: 'https://www.larousse.fr/dictionnaires/francais/%C3%AAtre',
      lerobert: 'https://dictionnaire.lerobert.com/definition/etre',
      cnrtl: 'https://www.cnrtl.fr/definition/%C3%AAtre',
      google: 'https://translate.google.com/?sl=fr&tl=vi&text=%C3%AAtre&op=translate',
      wiktionary: 'https://fr.wiktionary.org/wiki/%C3%AAtre',
    });
  });

  it('slugifies phrases, elisions and ligatures for Le Robert', () => {
    expect(leRobertSlug('pomme de terre')).toBe('pomme-de-terre');
    expect(leRobertSlug("aujourd'hui")).toBe('aujourd-hui');
    expect(leRobertSlug('Œuvre')).toBe('oeuvre');
    expect(leRobertSlug('garçon')).toBe('garcon');
  });

  it('translates into the UI language, English when the UI is French', () => {
    expect(translateTarget('vi')).toBe('vi');
    expect(translateTarget('en')).toBe('en');
    expect(translateTarget('fr')).toBe('en');
    const [google] = buildSourceLinks('maison', [{ id: 'google', enabled: true }], 'en');
    expect(google.href).toContain('tl=en');
  });

  it('returns nothing for an empty word', () => {
    expect(buildSourceLinks('  ', DEFAULT_SOURCE_PREFS, 'vi')).toEqual([]);
  });
});

describe('source preferences', () => {
  it('shows the four other dictionaries by default (Wiktionary is in the top bar)', () => {
    expect(buildSourceLinks('ami', DEFAULT_SOURCE_PREFS, 'vi').map((l) => l.id)).toEqual([
      'larousse',
      'lerobert',
      'cnrtl',
      'google',
    ]);
  });

  it('never throws on corrupted stored settings', () => {
    for (const sources of [{}, 'larousse', 42, null, [null, 7, { id: 1 }]]) {
      const merged = withDefaultSettings({ selectionLookup: { sources } } as never);
      expect(merged.selectionLookup.sources).toEqual(DEFAULT_SOURCE_PREFS);
    }
  });

  it('keeps the user order and hides disabled sources', () => {
    const links = buildSourceLinks(
      'ami',
      [
        { id: 'google', enabled: true },
        { id: 'larousse', enabled: false },
        { id: 'cnrtl', enabled: true },
        { id: 'lerobert', enabled: false },
        { id: 'wiktionary', enabled: false },
      ],
      'vi'
    );
    expect(links.map((l) => l.id)).toEqual(['google', 'cnrtl']);
  });

  it('repairs stored lists: unknown, duplicate and missing sources', () => {
    const repaired = normalizeSourcePrefs([
      { id: 'cnrtl', enabled: false },
      { id: 'bogus', enabled: true },
      { id: 'cnrtl', enabled: true },
      { id: 'google' },
    ]);
    expect(repaired).toEqual([
      { id: 'cnrtl', enabled: false },
      { id: 'google', enabled: true },
      { id: 'larousse', enabled: true },
      { id: 'lerobert', enabled: true },
      { id: 'wiktionary', enabled: false },
    ]);
    expect(normalizeSourcePrefs(undefined)).toEqual(DEFAULT_SOURCE_PREFS);
  });

  it('moves a source up or down within bounds', () => {
    const ids = (p: typeof DEFAULT_SOURCE_PREFS) => p.map((x) => x.id);
    expect(ids(moveSourcePref(DEFAULT_SOURCE_PREFS, 1, -1)).slice(0, 2)).toEqual(['lerobert', 'larousse']);
    expect(moveSourcePref(DEFAULT_SOURCE_PREFS, 0, -1)).toBe(DEFAULT_SOURCE_PREFS);
    expect(moveSourcePref(DEFAULT_SOURCE_PREFS, 4, 1)).toBe(DEFAULT_SOURCE_PREFS);
  });

  it('adds default sources to settings saved before US-03 without sharing the default array', () => {
    const merged = withDefaultSettings({ selectionLookup: { enabled: false, trigger: 'alt' } as never });
    expect(merged.selectionLookup).toEqual({ enabled: false, trigger: 'alt', sources: DEFAULT_SOURCE_PREFS });
    merged.selectionLookup.sources[0].enabled = false;
    expect(DEFAULT_SOURCE_PREFS[0].enabled).toBe(true);
  });
});
