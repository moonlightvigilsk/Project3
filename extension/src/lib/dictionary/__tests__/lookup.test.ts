import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { lookupCandidates, normalizeLookupQuery, withoutDeterminer } from '../normalize';
import { lookupWord } from '../wiktionary';
import { isOutdatedLookup, LookupCache, LOOKUP_CACHE_LIMIT } from '../cache';
import type { LookupResponse } from '../types';

const fixture = (name: string) =>
  fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

describe('normalizeLookupQuery', () => {
  it.each([
    ["l'ami,", 'ami'],
    ['l’ami', 'ami'],
    ["« j'ai »", 'ai'],
    ["qu'il", 'il'],
    ['maison.', 'maison'],
    ['  pomme de terre ! ', 'pomme de terre'],
    ["aujourd'hui", "aujourd'hui"],
    ['Maison', 'Maison'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeLookupQuery(input)).toBe(expected);
  });

  it('drops a leading determiner only as a fallback', () => {
    expect(withoutDeterminer('la maison')).toBe('maison');
    expect(withoutDeterminer('Les enfants')).toBe('enfants');
    expect(withoutDeterminer('maison')).toBeNull();
    expect(withoutDeterminer('lame')).toBeNull();
  });

  it('tries the lowercase form of capitalized words', () => {
    expect(lookupCandidates('Maison')).toEqual(['Maison', 'maison']);
    expect(lookupCandidates('maison')).toEqual(['maison']);
  });
});

/** Fake Wiktionary: fr pages from fixtures, en glosses for a few words. */
function mockWiktionary(frPages: Record<string, string>, enPages: Record<string, string> = {}) {
  const fetchMock = vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (url.hostname === 'fr.wiktionary.org') {
      const page = url.searchParams.get('page')!;
      const file = frPages[page];
      if (!file) return json(200, { error: { code: 'missingtitle' } });
      return json(200, { parse: { title: page, wikitext: fixture(file) } });
    }
    const title = decodeURIComponent(url.pathname.split('/').pop()!).replace(/_/g, ' ');
    const file = enPages[title];
    return file ? new Response(fixture(file), { status: 200 }) : json(404, {});
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('lookupWord', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns French entries and English glosses for a base word', async () => {
    mockWiktionary({ maison: 'maison.wikitext' }, { maison: 'en_maison.json' });
    const res = await lookupWord("la maison.");
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.result).toMatchObject({ word: 'maison', lemma: 'maison', ipa: 'me.zɔ̃', formOf: null });
    expect(res.result.entries[0].pos).toBe('nom');
    expect(res.result.english[0]).toEqual({ pos: 'Noun', definitions: ['house'] });
    expect(res.result.sourceUrl).toBe('https://fr.wiktionary.org/wiki/maison');
  });

  it('follows an inflected form to its lemma', async () => {
    mockWiktionary({ mangeons: 'mangeons.wikitext', manger: 'maison.wikitext' });
    const res = await lookupWord('mangeons');
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.result.word).toBe('mangeons');
    expect(res.result.lemma).toBe('manger');
    expect(res.result.ipa).toBe('mɑ̃.ʒɔ̃');
    expect(res.result.formOf?.lemma).toBe('manger');
    // Entries come from the lemma page (the maison fixture stands in for it).
    expect(res.result.entries[0].isInflection).toBe(false);
    expect(res.result.sourceUrl).toBe('https://fr.wiktionary.org/wiki/manger');
  });

  it('prefers the common noun over a surname for a capitalized selection', async () => {
    mockWiktionary({ Maison: 'Maison_capital.wikitext', maison: 'maison.wikitext' });
    const res = await lookupWord('Maison');
    expect(res.status === 'ok' && res.result.word).toBe('maison');
  });

  it('reports not_found and error', async () => {
    mockWiktionary({});
    expect(await lookupWord('xyzzyq')).toEqual({ status: 'not_found', word: 'xyzzyq' });

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const res = await lookupWord('maison');
    expect(res).toMatchObject({ status: 'error', word: 'maison' });
  });

  it('returns English-only results that the cache keeps serving', async () => {
    mockWiktionary({}, { brunch: 'en_maison.json' });
    const res = await lookupWord('brunch');
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.result.entries).toEqual([]);
    expect(res.result.audio).toBeNull();
    expect(isOutdatedLookup(res)).toBe(false);
  });

  it('marks results cached before US-04 (no audio field) as outdated', () => {
    const old = {
      status: 'ok',
      result: { word: 'a', lemma: 'a', ipa: null, formOf: null, entries: [], english: [], sourceUrl: '' },
    } as LookupResponse;
    expect(isOutdatedLookup(old)).toBe(true);
    expect(isOutdatedLookup({ status: 'not_found', word: 'a' })).toBe(false);
  });

  it('reports an error (not not_found) when one candidate fails and the other is missing', async () => {
    const working = mockWiktionary({});
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.hostname === 'fr.wiktionary.org' && url.searchParams.get('page') === 'maison') {
        throw new TypeError('Failed to fetch');
      }
      return working(input);
    }));
    expect(await lookupWord('Maison')).toMatchObject({ status: 'error', word: 'Maison' });
  });
});

describe('LookupCache', () => {
  function memoryStore() {
    const data: Record<string, unknown> = {};
    const writes: string[] = [];
    return {
      data,
      writes,
      get: async (k: string) => data[k],
      set: async (k: string, v: unknown) => {
        writes.push(k);
        data[k] = JSON.parse(JSON.stringify(v));
      },
      remove: async (keys: string[]) => {
        keys.forEach((k) => delete data[k]);
      },
    };
  }
  const ok = (word: string): LookupResponse => ({
    status: 'ok',
    result: { word, lemma: word, ipa: null, formOf: null, entries: [], english: [], sourceUrl: '' },
  });
  const HOUR = 3600 * 1000;

  it('stores ok/not_found responses but never errors', async () => {
    const cache = new LookupCache(memoryStore());
    await cache.set('maison', ok('maison'));
    await cache.set('zzz', { status: 'not_found', word: 'zzz' });
    await cache.set('err', { status: 'error', word: 'err', message: 'x' });
    expect(await cache.get('maison')).toEqual(ok('maison'));
    expect(await cache.get('zzz')).toEqual({ status: 'not_found', word: 'zzz' });
    expect(await cache.get('err')).toBeNull();
  });

  it('expires not_found after a day and ok after 30 days', async () => {
    let now = 0;
    const store = memoryStore();
    const cache = new LookupCache(store, () => now);
    await cache.set('maison', ok('maison'));
    await cache.set('zzz', { status: 'not_found', word: 'zzz' });
    now = 2 * 24 * HOUR;
    expect(await cache.get('zzz')).toBeNull();
    expect(store.data['lookup:zzz']).toBeUndefined();
    expect(await cache.get('maison')).not.toBeNull();
    now = 31 * 24 * HOUR;
    expect(await cache.get('maison')).toBeNull();
  });

  it('stores each word under its own key and removes the legacy single-key cache', async () => {
    const store = memoryStore();
    store.data.lookupCache = { old: {} };
    const cache = new LookupCache(store);
    await cache.set('maison', ok('maison'));
    expect(store.data.lookupCache).toBeUndefined();
    expect(store.data['lookup:maison']).toBeDefined();
    expect(Object.keys(store.data.lookupIndex as object)).toEqual(['maison']);
  });

  it('does not rewrite anything on a cache hit within the touch interval', async () => {
    let now = 0;
    const store = memoryStore();
    const cache = new LookupCache(store, () => now);
    await cache.set('maison', ok('maison'));
    store.writes.length = 0;
    now = 10 * 60 * 1000;
    expect(await cache.get('maison')).not.toBeNull();
    expect(store.writes).toEqual([]);
    now = 2 * HOUR;
    await cache.get('maison');
    expect(store.writes).toEqual(['lookupIndex']);
  });

  it('keeps every entry when lookups run concurrently', async () => {
    const store = memoryStore();
    const cache = new LookupCache(store);
    await Promise.all(Array.from({ length: 20 }, (_, i) => cache.set(`w${i}`, ok(`w${i}`))));
    expect(Object.keys(store.data.lookupIndex as object)).toHaveLength(20);
  });

  it('evicts the least recently used entries beyond the limit', async () => {
    let now = 0;
    const store = memoryStore();
    const cache = new LookupCache(store, () => now);
    for (let i = 0; i < LOOKUP_CACHE_LIMIT; i++) {
      now += 1;
      await cache.set(`w${i}`, ok(`w${i}`));
    }
    now += 2 * HOUR;
    await cache.get('w0'); // touch the oldest
    now += 1;
    await cache.set('new', ok('new'));
    expect(Object.keys(store.data.lookupIndex as object)).toHaveLength(LOOKUP_CACHE_LIMIT);
    expect(Object.keys(store.data).filter((k) => k.startsWith('lookup:'))).toHaveLength(LOOKUP_CACHE_LIMIT);
    expect(await cache.get('w0')).not.toBeNull();
    expect(await cache.get('w1')).toBeNull();
  });
});
