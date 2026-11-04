import { describe, expect, it } from 'vitest';
import { catalogExamples, explanationFor, parseRule, ruleToGrammarCard } from '../rule';
import { fetchRule, RuleDetailCache, type FetchFn } from '../backend';

/** Rule as returned by GET /api/grammar/rules/aller_infinitif (loaded from YAML). */
const YAML_RULE = {
  id: 'aller_infinitif',
  name: 'Futur proche (aller + infinitif)',
  category: 'Temps du verbe',
  level: 'A1-A2',
  formula: "Sujet + aller (présent de l'indicatif) + verbe à l'infinitif",
  // The YAML loader copies description_vi here.
  description: 'Diễn tả một hành động sắp xảy ra.',
  description_vi: 'Diễn tả một hành động sắp xảy ra.',
  description_en: 'Expresses an imminent action.',
  key_points: [],
  conjugation_table: {},
  examples: ['Je vais visiter mon ami.', 'Nous allons visiter Hanoi.'],
  examples_correct: [
    { text: 'Je vais visiter mon ami.', note: 'vais (aller, présent) + visiter (infinitif)' },
    { text: 'Nous allons visiter Hanoi.', note: 'allons + visiter' },
  ],
  links: [
    { title: 'Wiktionnaire : futur proche', url: 'https://fr.wiktionary.org/wiki/futur_proche' },
    { title: 'Evil', url: 'https://evil.example/phish' },
  ],
};

/** Built-in catalog rule: French description only, nested conjugation table. */
const BUILTIN_RULE = {
  id: 'passe_compose',
  name: 'Passé composé',
  category: 'Temps du verbe',
  level: 'A2',
  formula: 'Sujet + auxiliaire + participe passé',
  description: 'Exprime une action passée, achevée.',
  description_vi: null,
  description_en: null,
  key_points: ["La plupart des verbes utilisent l'auxiliaire 'avoir'.", ''],
  conjugation_table: { avoir: 'ai, as, a', terminaisons_participe: { 'verbes en -er': '-é (parlé)' } },
  examples: ['J’ai terminé ce livre.', 'Elle est allée à la bibliothèque.', 'Nous avons parlé longtemps de nos vacances.'],
  examples_correct: [],
};

describe('parseRule', () => {
  it('reads a YAML rule: examples with notes, no duplicates, trusted links only', () => {
    const rule = parseRule(YAML_RULE)!;
    expect(rule.examples).toEqual([
      { text: 'Je vais visiter mon ami.', note: 'vais (aller, présent) + visiter (infinitif)' },
      { text: 'Nous allons visiter Hanoi.', note: 'allons + visiter' },
    ]);
    expect(rule.links).toEqual([{ title: 'Wiktionnaire : futur proche', url: 'https://fr.wiktionary.org/wiki/futur_proche' }]);
    // `description` repeats the Vietnamese text: no French explanation.
    expect(rule.descriptions).toEqual({ vi: 'Diễn tả một hành động sắp xảy ra.', en: 'Expresses an imminent action.' });
  });

  it('reads a built-in rule: French description, flattened table, Wiktionary link by default', () => {
    const rule = parseRule(BUILTIN_RULE)!;
    expect(rule.descriptions).toEqual({ fr: 'Exprime une action passée, achevée.' });
    expect(rule.patterns).toEqual(['avoir : ai, as, a', 'terminaisons participe › verbes en -er : -é (parlé)']);
    expect(rule.keyPoints).toHaveLength(1);
    expect(rule.links[0].url).toBe('https://fr.wiktionary.org/wiki/pass%C3%A9_compos%C3%A9');
  });

  it('rejects what is not a rule', () => {
    expect(parseRule(null)).toBeNull();
    expect(parseRule({ id: 'x' })).toBeNull();
    expect(parseRule([1, 2])).toBeNull();
  });
});

describe('explanationFor', () => {
  it('uses the interface language, else English, then French, then Vietnamese', () => {
    const yaml = parseRule(YAML_RULE)!;
    expect(explanationFor(yaml, 'vi')).toEqual({ text: 'Diễn tả một hành động sắp xảy ra.', lang: 'vi' });
    expect(explanationFor(yaml, 'fr')).toEqual({ text: 'Expresses an imminent action.', lang: 'en' });
    const builtin = parseRule(BUILTIN_RULE)!;
    expect(explanationFor(builtin, 'vi')).toEqual({ text: 'Exprime une action passée, achevée.', lang: 'fr' });
    expect(explanationFor({ ...builtin, descriptions: {} }, 'vi')).toBeNull();
  });
});

describe('catalogExamples', () => {
  it('leaves out the page sentence, which is shown first', () => {
    const rule = parseRule(BUILTIN_RULE)!;
    const examples = catalogExamples(rule, '  Nous avons parlé   longtemps de nos vacances. ');
    expect(examples.map((e) => e.text)).toEqual(['J’ai terminé ce livre.', 'Elle est allée à la bibliothèque.']);
    expect(catalogExamples(rule, null)).toHaveLength(3);
  });
});

describe('ruleToGrammarCard', () => {
  it('makes a bookmark card the side panel can show', () => {
    const card = ruleToGrammarCard(parseRule(YAML_RULE)!, 'en');
    expect(card).toEqual({
      id: 'aller_infinitif',
      title: 'Futur proche (aller + infinitif)',
      form: "Sujet + aller (présent de l'indicatif) + verbe à l'infinitif",
      patterns: [],
      uses: ['Expresses an imminent action.'],
      examples: ['Je vais visiter mon ami.', 'Nous allons visiter Hanoi.'],
      source: { title: 'Wiktionnaire : futur proche', url: 'https://fr.wiktionary.org/wiki/futur_proche' },
    });
  });
});

describe('fetchRule', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it('reads the rule, encodes the id', async () => {
    let called = '';
    const fetchFn: FetchFn = async (url) => {
      called = url;
      return json(YAML_RULE);
    };
    const reply = await fetchRule('http://b', 'aller infinitif', fetchFn);
    expect(called).toBe('http://b/api/grammar/rules/aller%20infinitif');
    expect(reply.status).toBe('ok');
  });

  it('tells a missing rule, a stopped backend and other errors apart', async () => {
    expect(await fetchRule('http://b', 'x', async () => json({ detail: "Rule 'x' not found." }, 404))).toEqual({ status: 'not_found', ruleId: 'x' });
    expect(await fetchRule('http://b', 'x', async () => Promise.reject(new TypeError('Failed to fetch')))).toEqual({
      status: 'unreachable',
      backendUrl: 'http://b',
    });
    expect(await fetchRule('http://b', 'x', async () => json({ detail: 'boom' }, 500))).toMatchObject({ status: 'error', httpStatus: 500, message: 'boom' });
    expect(await fetchRule('http://b', 'x', async () => json({ hello: 1 }))).toMatchObject({ status: 'error', message: 'not a grammar rule' });
  });

  it('caches by backend and id', () => {
    const cache = new RuleDetailCache();
    const rule = parseRule(YAML_RULE)!;
    cache.set('http://a', 'aller_infinitif', rule);
    expect(cache.get('http://a', 'aller_infinitif')).toBe(rule);
    expect(cache.get('http://b', 'aller_infinitif')).toBeNull();
  });
});
