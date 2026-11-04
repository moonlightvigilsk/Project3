import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { cleanWikitext, htmlToText, lastLinkTarget, parseFrenchWikitext, splitTopLevel } from '../wikitext';

const fixture = (name: string) =>
  fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

describe('cleanWikitext', () => {
  it('renders links, labels and drops formatting', () => {
    expect(cleanWikitext("{{figuré|fr}} [[bâtiment|Bâtiment]] servant de [[logis]], d’'''habitation'''.")).toBe(
      '(figuré) Bâtiment servant de logis, d’habitation.'
    );
  });

  it('handles nested templates and lien', () => {
    expect(cleanWikitext('Voir {{lien|habitation|fr}} {{réf|{{w|Littré}}}}.')).toBe('Voir habitation.');
  });

  it('keeps the case of context labels and drops gender templates', () => {
    expect(cleanWikitext('{{Canada|fr}} Airelle {{f}}')).toBe('(Canada) Airelle');
  });

  it('turns <br /> into a separator', () => {
    expect(cleanWikitext('vers un<br\n/>vers deux')).toBe('vers un / vers deux');
  });
});

describe('splitTopLevel', () => {
  it('ignores pipes inside links and nested templates', () => {
    expect(splitTopLevel('exemple|[[a|b]] {{x|y}}|lang=fr')).toEqual(['exemple', '[[a|b]] {{x|y}}', 'lang=fr']);
  });
});

describe('parseFrenchWikitext', () => {
  it('parses a noun with gender, IPA, senses and examples (maison)', () => {
    const page = parseFrenchWikitext(fixture('maison.wikitext'))!;
    expect(page.formOf).toBeNull();
    expect(page.ipa).toBe('me.zɔ̃');
    const noun = page.entries[0];
    expect(noun.pos).toBe('nom');
    expect(noun.gender).toBe('f');
    expect(noun.isInflection).toBe(false);
    expect(noun.senses[0].definition).toBe('(édifices) Bâtiment servant de logis, d’habitation, de demeure.');
    expect(noun.senses[0].example).toMatch(/^Les maisons peuvent brûler/);
    expect(noun.senses.length).toBeLessThanOrEqual(5);
    expect(page.entries.map((e) => e.pos)).toContain('adjectif');
  });

  it('extracts the etymology paragraph as plain text (maison)', () => {
    const page = parseFrenchWikitext(fixture('maison.wikitext'))!;
    expect(page.etymology).toMatch(/^.vers 980. Du moyen français maison, de l’ancien français maison, issu du latin mānsiō/);
    expect(page.etymology).toContain('(« fait de séjourner ; lieu de séjour »)');
    expect(page.etymology).not.toMatch(/[{}[]]/);
  });

  it('skips etymology stubs and undated century templates', () => {
    expect(parseFrenchWikitext(fixture('Maison_capital.wikitext'))!.etymology).toBeNull();
    expect(parseFrenchWikitext(fixture('belle.wikitext'))!.etymology).toBe('Du féminin de l’adjectif beau.');
  });

  it('ignores other languages after the French section', () => {
    const page = parseFrenchWikitext(fixture('alle.wikitext'))!;
    expect(page.entries).toHaveLength(1);
    expect(page.entries.every((e) => !e.senses.some((s) => s.definition.includes('ignored')))).toBe(true);
  });

  it('detects inflected forms and their lemma (mangeons -> manger, allé -> aller)', () => {
    const mangeons = parseFrenchWikitext(fixture('mangeons.wikitext'))!;
    expect(mangeons.formOf).toEqual({
      lemma: 'manger',
      description: 'Première personne du pluriel du présent de l’indicatif de manger.',
    });
    expect(mangeons.ipa).toBe('mɑ̃.ʒɔ̃');

    const alle = parseFrenchWikitext(fixture('alle.wikitext'))!;
    expect(alle.formOf?.lemma).toBe('aller');
    // Multi-line {{exemple | ... }} templates are joined into one example.
    expect(alle.entries[0].senses[0].example).toMatch(/^Silène était allé rentrer la charrette/);
  });

  it('does not report formOf when the page also has a base entry (belle)', () => {
    const page = parseFrenchWikitext(fixture('belle.wikitext'))!;
    expect(page.formOf).toBeNull();
    expect(page.entries[0]).toMatchObject({ pos: 'nom', isInflection: false, gender: 'f' });
    expect(page.entries[1]).toMatchObject({ pos: 'adjectif', isInflection: true });
    expect(page.entries[1].senses[0].definition).toBe('Féminin singulier de beau.');
  });

  it('parses multi-word entries (pomme de terre)', () => {
    const page = parseFrenchWikitext(fixture('pomme_de_terre.wikitext'))!;
    expect(page.ipa).toBe('pɔm də tɛʁ');
    expect(page.entries[0].senses[0].definition).toMatch(/^\(cuisine\) Rhizome souterrain/);
  });

  it('returns null when there is no French section', () => {
    expect(parseFrenchWikitext('== {{langue|en}} ==\n=== {{S|nom|en}} ===\n# House.')).toBeNull();
  });
});

describe('htmlToText', () => {
  it('flattens en.wiktionary form-of definitions', () => {
    const json = JSON.parse(fixture('en_mangeons.json'));
    const text = htmlToText(json.fr[0].definitions[0].definition);
    expect(text).toBe('inflection of manger: first-person plural present indicative; first-person plural imperative');
  });
});

describe('form-of links written with {{lien}}', () => {
  it('follows "Pluriel d’{{lien|enfant|fr}}" to the lemma', () => {
    const page = parseFrenchWikitext(fs.readFileSync(path.join(__dirname, 'fixtures', 'enfants.wikitext'), 'utf8'));
    expect(page?.formOf?.lemma).toBe('enfant');
  });

  it('takes the last link, wiki link or template', () => {
    expect(lastLinkTarget("''Pluriel de'' [[cheval#fr|cheval]].")).toBe('cheval');
    expect(lastLinkTarget("Féminin de {{l|beau|fr}}, voir [[bel]]")).toBe('bel');
    expect(lastLinkTarget("Voir [[bel]] ou {{lien|beau|fr}}")).toBe('beau');
    expect(lastLinkTarget('Aucun lien')).toBeNull();
  });
});
