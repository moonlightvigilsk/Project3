import { describe, expect, it } from 'vitest';
import { contextMenuFallback, contextMenuQuery, wiktionarySearchUrl } from '../context-menu';
import { PARSER_VERSION, type LookupResponse } from '@/lib/dictionary/types';

const page = { url: 'https://example.org/doc.pdf', title: 'Doc' };
const ok: LookupResponse = {
  status: 'ok',
  result: {
    word: 'enfants',
    lemma: 'enfant',
    ipa: 'ɑ̃.fɑ̃',
    formOf: { lemma: 'enfant', description: 'Pluriel d’enfant.' },
    entries: [{ pos: 'nom', isInflection: false, gender: 'mf', ipa: 'ɑ̃.fɑ̃', senses: [{ definition: 'Garçon ou fille.' }] }],
    english: [],
    audio: null,
    sourceUrl: 'https://fr.wiktionary.org/wiki/enfant',
    parserVersion: PARSER_VERSION,
  },
};

describe('contextMenuQuery', () => {
  it('accepts a word or short phrase, rejects longer selections', () => {
    expect(contextMenuQuery('  enfants ')).toBe('enfants');
    expect(contextMenuQuery('pomme de terre')).toBe('pomme de terre');
    expect(contextMenuQuery('Les enfants jouent dans le jardin')).toBeNull();
    expect(contextMenuQuery('ligne un\nligne deux')).toBeNull();
  });
});

describe('contextMenuFallback (no content script in the frame)', () => {
  it('"Look up" opens the Wiktionary entry, or a search for long selections', () => {
    expect(contextMenuFallback('enfants', false, ok, page)).toEqual({ type: 'open', url: 'https://fr.wiktionary.org/wiki/enfant' });
    expect(contextMenuFallback("l'ami,", false, { status: 'not_found', word: 'ami' }, page)).toEqual({
      type: 'open',
      url: 'https://fr.wiktionary.org/wiki/ami',
    });
    const long = 'Les enfants jouent dans le jardin';
    expect(contextMenuFallback(long, false, null, page)).toEqual({ type: 'open', url: wiktionarySearchUrl(long) });
  });

  it('"Add to vocabulary" saves the lemma with the page, without a sentence', () => {
    const action = contextMenuFallback('enfants', true, ok, page);
    expect(action).toMatchObject({
      type: 'save',
      draft: { word: 'enfants', lemma: 'enfant', pos: 'nom', sourceUrl: page.url, sourceTitle: 'Doc' },
    });
    expect(action.type === 'save' && action.draft.contextSentence).toBeFalsy();
  });

  it('"Add to vocabulary" saves an unknown word as typed, but never a long selection or after an error', () => {
    expect(contextMenuFallback('Zorglub', true, { status: 'not_found', word: 'Zorglub' }, page)).toEqual({
      type: 'save',
      draft: { word: 'Zorglub', sourceUrl: page.url, sourceTitle: 'Doc' },
    });
    expect(contextMenuFallback('Les enfants jouent dans le jardin', true, null, page)).toEqual({ type: 'none' });
    expect(contextMenuFallback('enfants', true, { status: 'error', word: 'enfants', message: 'offline' }, page)).toEqual({
      type: 'none',
    });
  });
});
