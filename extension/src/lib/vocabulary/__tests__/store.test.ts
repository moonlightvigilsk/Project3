import { describe, expect, it } from 'vitest';
import {
  assembleVocabulary,
  emptyVocabulary,
  parseBookmarkSubtitle,
  parseMeta,
  upsertEntry,
  VOCABULARY_KEY,
} from '../model';
import { VocabularyStore, type VocabularyStorage } from '../store';

const T0 = Date.UTC(2026, 0, 1);

function memory(local: Record<string, unknown> = {}, dictionary?: unknown) {
  const data: Record<string, unknown> = structuredClone(local);
  const sync = { dictionary };
  const log: string[][] = [];
  const storage: VocabularyStorage = {
    get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, structuredClone(data[k])])),
    set: async (items) => {
      log.push(Object.keys(items));
      for (const [k, v] of Object.entries(items)) data[k] = structuredClone(v);
    },
    remove: async (keys) => keys.forEach((k) => delete data[k]),
    getLegacyDictionary: async () => structuredClone(sync.dictionary),
  };
  const read = () => {
    const meta = parseMeta(data[VOCABULARY_KEY]);
    return meta ? assembleVocabulary(meta, data) : null;
  };
  return { data, sync, storage, log, read };
}

describe('VocabularyStore', () => {
  it('migrates once, then moves word bookmarks out of the bookmarks list', async () => {
    const m = memory(
      {
        bookmarks: [
          { id: 'word:ami', kind: 'word', title: 'ami', createdAt: 1 },
          { id: 'grammar:x', kind: 'grammar', title: 'Subjonctif', createdAt: 2 },
        ],
      },
      ['textchecker']
    );
    const store = new VocabularyStore(m.storage, () => T0);
    expect([...(await store.ignoredSpellings())]).toEqual(['textchecker']);
    expect(Object.keys(m.read()!.entries).sort()).toEqual(['ami', 'textchecker']);
    expect(m.data['vocab:ami']).toMatchObject({ saved: true });
    expect(m.data.bookmarks).toEqual([{ id: 'grammar:x', kind: 'grammar', title: 'Subjonctif', createdAt: 2 }]);

    // A second instance (service worker restart) reads the stored notebook, no new write.
    const writes = m.log.length;
    const restarted = new VocabularyStore(m.storage, () => T0);
    await restarted.ensureReady();
    expect(m.log.length).toBe(writes);
    expect([...(await restarted.ignoredSpellings())]).toEqual(['textchecker']);
  });

  it('writes only the changed entry and the meta record', async () => {
    const m = memory();
    const store = new VocabularyStore(m.storage, () => T0);
    await store.apply({ op: 'save', draft: { word: 'ami' } });
    await store.apply({ op: 'save', draft: { word: 'maison' } });
    m.log.length = 0;
    await store.apply({ op: 'update', id: 'ami', patch: { note: 'friend' } });
    expect(m.log).toEqual([['vocab:ami', VOCABULARY_KEY]]);
    await store.apply({ op: 'unsave', id: 'maison' });
    expect(m.data['vocab:maison']).toBeUndefined();
    expect(Object.keys(parseMeta(m.data[VOCABULARY_KEY])!.index)).toEqual(['ami']);
  });

  it('converts the version 1 layout (all entries in one key)', async () => {
    const m = memory(
      {
        vocabulary: {
          version: 1,
          entries: { ami: { word: 'ami', saved: true, createdAt: 5 }, zut: { word: 'zut', ignoreSpelling: true } },
        },
      },
      ['zut']
    );
    const store = new VocabularyStore(m.storage, () => T0);
    await store.ensureReady();
    expect(parseMeta(m.data[VOCABULARY_KEY])).toMatchObject({ version: 2, importedLegacy: ['zut'] });
    expect(m.read()!.entries.ami).toMatchObject({ saved: true, createdAt: 5 });
    expect(m.read()!.entries.zut).toMatchObject({ ignoreSpelling: true });
  });

  it('imports words added later to the old dictionary, once', async () => {
    const m = memory({}, ['zut']);
    const store = new VocabularyStore(m.storage, () => T0);
    await store.ensureReady();
    m.sync.dictionary = ['zut', 'Bof'];
    await store.importLegacy();
    expect([...(await store.ignoredSpellings())].sort()).toEqual(['bof', 'zut']);
    // Un-ignored here: another sync of the old list does not bring it back.
    await store.apply({ op: 'unignoreSpelling', id: 'bof' });
    await store.importLegacy();
    expect([...(await store.ignoredSpellings())]).toEqual(['zut']);
    // A restarted store also imports on load.
    m.sync.dictionary = ['zut', 'Bof', 'hop'];
    const restarted = new VocabularyStore(m.storage, () => T0);
    expect([...(await restarted.ignoredSpellings())].sort()).toEqual(['hop', 'zut']);
  });

  it('reloads after a change it did not make, not after its own', async () => {
    const m = memory();
    const store = new VocabularyStore(m.storage, () => T0);
    await store.apply({ op: 'save', draft: { word: 'ami' } });
    store.onStorageChanged(m.data[VOCABULARY_KEY]); // own write: kept
    // Data cleared from outside ("clear data"): the next command must not resurrect "ami".
    for (const k of Object.keys(m.data)) delete m.data[k];
    store.onStorageChanged(undefined);
    await store.apply({ op: 'save', draft: { word: 'maison' } });
    expect(Object.keys(m.read()!.entries)).toEqual(['maison']);
  });

  it('applies concurrent commands without losing any', async () => {
    const m = memory();
    const store = new VocabularyStore(m.storage, () => T0);
    await Promise.all(Array.from({ length: 20 }, (_, i) => store.apply({ op: 'save', draft: { word: `mot${i}` } })));
    await store.apply({ op: 'ignoreSpelling', word: 'mot3' });
    const reread = m.read()!;
    expect(Object.keys(reread.entries)).toHaveLength(20);
    expect(reread.entries.mot3).toMatchObject({ saved: true, ignoreSpelling: true });
  });

  it('runs unsave / unignore / update / remove', async () => {
    const m = memory();
    const store = new VocabularyStore(m.storage, () => T0);
    await store.apply({ op: 'save', draft: { word: 'ami' } });
    expect(await store.apply({ op: 'update', id: 'ami', patch: { note: 'friend' } })).toMatchObject({ note: 'friend' });
    expect(await store.apply({ op: 'unsave', id: 'ami' })).toBeNull();
    await store.apply({ op: 'ignoreSpelling', word: 'Zut' });
    expect([...(await store.ignoredSpellings())]).toEqual(['zut']);
    await store.apply({ op: 'unignoreSpelling', id: 'zut' });
    await store.apply({ op: 'save', draft: { word: 'x' } });
    await store.apply({ op: 'remove', id: 'x' });
    expect(m.read()!.entries).toEqual({});
  });
});

describe('occurrence (US-06: newest sentence wins)', () => {
  it('replaces sentence, URL and title together with the newest occurrence', () => {
    const state = emptyVocabulary();
    upsertEntry(state, { word: 'ami', contextSentence: 'Mon ami arrive.', sourceUrl: 'https://a', sourceTitle: 'A', saved: true }, T0);
    upsertEntry(state, { word: 'ami', contextSentence: "C'est un ami.", sourceUrl: 'https://b', sourceTitle: 'B' }, T0 + 1);
    expect(state.entries.ami).toMatchObject({ contextSentence: "C'est un ami.", sourceUrl: 'https://b', sourceTitle: 'B' });
    // A new page without a sentence (context menu on a PDF): no stale sentence kept.
    upsertEntry(state, { word: 'ami', sourceUrl: 'https://c.pdf', sourceTitle: null }, T0 + 2);
    expect(state.entries.ami).toMatchObject({ contextSentence: null, sourceUrl: 'https://c.pdf', sourceTitle: null });
    // No occurrence in the draft (spelling ignore): kept as is.
    upsertEntry(state, { word: 'ami', ignoreSpelling: true }, T0 + 3);
    expect(state.entries.ami.sourceUrl).toBe('https://c.pdf');
  });
});

describe('parseBookmarkSubtitle with multi-word parts of speech', () => {
  it('keeps "nom propre" / "locution nominale" as the part of speech', () => {
    expect(parseBookmarkSubtitle('nom propre · /pa.ʁi/ · Capitale de la France.')).toEqual({
      pos: 'nom propre',
      ipa: 'pa.ʁi',
      definition: 'Capitale de la France.',
    });
    expect(parseBookmarkSubtitle('locution nominale · Tubercule comestible.')).toEqual({
      pos: 'locution nominale',
      ipa: null,
      definition: 'Tubercule comestible.',
    });
  });
});
