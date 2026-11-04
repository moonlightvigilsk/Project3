import { describe, expect, it } from 'vitest';
import { actionPrompt, isTrustedSourceUrl, parseGrammarCard } from '../prompts';

describe('parseGrammarCard', () => {
  it('parses a fenced JSON answer and keeps a trusted source', () => {
    const answer = `\`\`\`json
{
  "id": "futur proche",
  "title": "Futur proche",
  "form": "aller (présent) + infinitif",
  "patterns": ["Sujet + aller + infinitif", "Négation : ne + aller + pas + infinitif", 42],
  "uses": ["Hành động sắp xảy ra"],
  "examples": ["Nous allons visiter Hanoi. (Chúng tôi sắp đi thăm Hà Nội.)"],
  "source": { "title": "Near future", "url": "https://www.lawlessfrench.com/grammar/near-future/" }
}
\`\`\``;
    const card = parseGrammarCard(answer)!;
    expect(card.id).toBe('futur_proche');
    expect(card.title).toBe('Futur proche');
    expect(card.patterns).toEqual(['Sujet + aller + infinitif', 'Négation : ne + aller + pas + infinitif']);
    expect(card.source).toEqual({ title: 'Near future', url: 'https://www.lawlessfrench.com/grammar/near-future/' });
  });

  it('replaces an untrusted or missing source with a search link', () => {
    const card = parseGrammarCard('{"title":"Passé composé","source":{"title":"x","url":"https://evil.example/page"}}')!;
    expect(card.source!.url).toBe('https://www.lawlessfrench.com/?s=Pass%C3%A9%20compos%C3%A9');
    expect(card.id).toBe('passe_compose');
  });

  it('returns null for prose or JSON without a title', () => {
    expect(parseGrammarCard('Le futur proche se forme avec aller.')).toBeNull();
    expect(parseGrammarCard('{"form":"x"}')).toBeNull();
    expect(parseGrammarCard('{ broken json')).toBeNull();
  });
});

describe('isTrustedSourceUrl', () => {
  it('accepts subdomains of allowed hosts only', () => {
    expect(isTrustedSourceUrl('https://fr.wiktionary.org/wiki/aller')).toBe(true);
    expect(isTrustedSourceUrl('https://www.larousse.fr/x')).toBe(true);
    expect(isTrustedSourceUrl('https://larousse.fr.evil.com/x')).toBe(false);
    expect(isTrustedSourceUrl('javascript:alert(1)')).toBe(false);
  });
});

describe('actionPrompt', () => {
  it('names the concept when known, otherwise points at the sentence', () => {
    expect(actionPrompt('examples', 'Futur proche')).toContain('"Futur proche"');
    expect(actionPrompt('practice', null)).toContain('the sentence I am reading');
  });
});
