import { describe, expect, it } from 'vitest';
import { extractSentence, MAX_CONTEXT_CHARS, sentenceBounds, toLookupText, toSentenceText } from '../selection-info';
import { withDefaultSettings, DEFAULT_SETTINGS } from '@/types';

describe('toLookupText', () => {
  it('accepts a single word and trims it', () => {
    expect(toLookupText('  maison ')).toBe('maison');
  });

  it('accepts accented words, elisions and phrases up to 5 words', () => {
    expect(toLookupText("l'ami")).toBe("l'ami");
    expect(toLookupText('pomme de terre')).toBe('pomme de terre');
    expect(toLookupText('il était une fois là')).toBe('il était une fois là');
  });

  it('normalizes non-breaking spaces', () => {
    expect(toLookupText('tout à fait')).toBe('tout à fait');
  });

  it('rejects empty, too long, multi-line or letter-less selections', () => {
    expect(toLookupText('   ')).toBeNull();
    expect(toLookupText('un deux trois quatre cinq six')).toBeNull();
    expect(toLookupText('bonjour\nmonde')).toBeNull();
    expect(toLookupText('12 345')).toBeNull();
    expect(toLookupText('a'.repeat(61))).toBeNull();
  });
});

describe('withDefaultSettings', () => {
  it('adds selectionLookup to settings saved by older versions', () => {
    const old = { ...DEFAULT_SETTINGS } as Partial<typeof DEFAULT_SETTINGS>;
    delete old.selectionLookup;
    const merged = withDefaultSettings({ ...old, checkMode: 'ondemand' });
    expect(merged.checkMode).toBe('ondemand');
    expect(merged.selectionLookup).toMatchObject({ enabled: true, trigger: 'button' });
  });

  it('keeps user choices and fills only missing nested fields', () => {
    const merged = withDefaultSettings({
      selectionLookup: { trigger: 'alt' } as never,
    });
    expect(merged.selectionLookup).toMatchObject({ enabled: true, trigger: 'alt' });
  });

  it('returns defaults when nothing is stored', () => {
    expect(withDefaultSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('toSentenceText', () => {
  it('accepts selections longer than the lookup limit and joins lines', () => {
    expect(toSentenceText('Nous allons visiter\nHanoi la semaine prochaine.')).toBe(
      'Nous allons visiter Hanoi la semaine prochaine.'
    );
  });

  it('leaves short selections to the word lookup', () => {
    expect(toSentenceText('Nous allons visiter Hanoi.')).toBeNull();
  });

  it('rejects passages that are too long or have no letters', () => {
    expect(toSentenceText('mot '.repeat(121))).toBeNull();
    expect(toSentenceText('1 2 3 4 5 6 7')).toBeNull();
  });
});

describe('extractSentence (US-06)', () => {
  const around = (text: string, word: string, occurrence = 0) => {
    let i = -1;
    for (let k = 0; k <= occurrence; k++) i = text.indexOf(word, i + 1);
    return extractSentence(text, i, i + word.length);
  };

  it('returns the sentence containing the selection', () => {
    const text = 'Il pleut. Nous mangeons dans la maison de Paul ! Puis on sort ? Oui…';
    expect(around(text, 'maison')).toBe('Nous mangeons dans la maison de Paul !');
    expect(around(text, 'pleut')).toBe('Il pleut.');
    expect(around(text, 'sort')).toBe('Puis on sort ?');
  });

  it('does not split on abbreviations, initials, decimals or URLs', () => {
    expect(around('Hier, M. Dupont a vu 3.5 km de route. Fin.', 'route')).toBe('Hier, M. Dupont a vu 3.5 km de route.');
    expect(around('Lisez fr.wiktionary.org pour le mot ami. Merci.', 'ami')).toBe('Lisez fr.wiktionary.org pour le mot ami.');
    expect(around('Pommes, poires, etc. sont des fruits. Fin.', 'fruits')).toBe('Pommes, poires, etc. sont des fruits.');
    expect(around('Voir J. K. Rowling pour la suite. Fin.', 'suite')).toBe('Voir J. K. Rowling pour la suite.');
  });

  it('keeps closing quotes and stops at line breaks', () => {
    expect(around('Il dit : « Je suis là. » Ensuite rien.', 'suis')).toBe('Il dit : « Je suis là. »');
    expect(around('Titre du chapitre\nLe chat dort sur le lit\nAutre ligne', 'chat')).toBe('Le chat dort sur le lit');
  });

  it('collapses whitespace and cuts very long sentences around the word', () => {
    expect(around('Le   chat\tdort.', 'chat')).toBe('Le chat dort.');
    const long = `${'mot '.repeat(120)}maison ${'mot '.repeat(120)}.`;
    const s = around(long, 'maison')!;
    expect(s.length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS + 2);
    expect(s.startsWith('…')).toBe(true);
    expect(s.endsWith('…')).toBe(true);
    expect(s).toContain('maison');
  });

  it('returns null when there is nothing but the selection', () => {
    expect(around('maison', 'maison')).toBeNull();
    expect(around('Titre\nmaison\nTexte', 'maison')).toBeNull();
    expect(extractSentence('abc', 2, 1)).toBeNull();
  });
});

describe('extractSentence after a French closing quote', () => {
  it('starts the next sentence after « … »', () => {
    const text = 'Il dit : « Je suis là. » Ensuite il part.';
    const i = text.indexOf('part');
    expect(extractSentence(text, i, i + 4)).toBe('Ensuite il part.');
  });
});

describe('sentenceBounds (US-17: sentence around a caret)', () => {
  const text = 'Hier, mon ami est venu. Nous avons parlé longtemps. M. Dupont est parti.';
  const around = (i: number) => {
    const { from, to } = sentenceBounds(text, i, i);
    return text.slice(from, to).trim();
  };
  it('finds the sentence of a caret, also inside the first and last words', () => {
    expect(around(text.indexOf('avons'))).toBe('Nous avons parlé longtemps.');
    expect(around(0)).toBe('Hier, mon ami est venu.');
    expect(around(text.indexOf('parti') + 2)).toBe('M. Dupont est parti.');
  });
  it('keeps the old behaviour of extractSentence', () => {
    const i = text.indexOf('ami');
    expect(extractSentence(text, i, i + 3)).toBe('Hier, mon ami est venu.');
  });
});
