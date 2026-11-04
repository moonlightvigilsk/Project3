import type { DictionaryEntry, DictionarySense, Gender, PronunciationAudio } from './types';

/**
 * Minimal parser for French Wiktionary (fr.wiktionary.org) wikitext.
 * It only extracts what the lookup card needs: part of speech, gender, IPA,
 * the first definitions with one example each, and "form of" links.
 * Pure string processing so it runs in the MV3 service worker (no DOMParser).
 */

export interface ParsedFrenchPage {
  /** IPA of the page word, from the first part-of-speech head line that has one. */
  ipa: string | null;
  entries: DictionaryEntry[];
  /** Set when the page is only inflected forms of another word (mangeons -> manger). */
  formOf: { lemma: string; description: string } | null;
  /** First paragraph of the first "Étymologie" section, as plain text. */
  etymology: string | null;
  /** Preferred recording among the section's {{écouter}} templates. */
  audio: PronunciationAudio | null;
}

/**
 * Normalizes IPA for comparison: drops syllable dots, liaison ties, stress marks,
 * length marks, spaces and the dental diacritic some editors add (ɛst̪ = ɛst).
 */
export function comparableIpa(ipa: string): string {
  return ipa
    .normalize('NFD')
    .replace(/[.‿ˈˌː\s̪͡]/g, '')
    .normalize('NFC');
}

/** Region label without wiki comments or templates ("France <!-- précisez… -->" -> "France"). */
function cleanRegion(raw: string): string | null {
  const text = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

/**
 * Picks the recording of the word itself from the {{écouter|...|audio=File}} templates of
 * the French section. Arguments: region, IPA, then named ones; both orders occur
 * ({{écouter|lang=fr|France (Paris)|a.le|audio=...}}, {{écouter||fis|lang=fr|audio=...}}).
 * - Recordings with `titre=` are of another phrase ("à l'est" on the "est" page): skipped.
 * - When the card's IPA is known, recordings of another pronunciation are skipped
 *   ("fils" /fil/ when /fis/ is shown) and a matching IPA is preferred.
 * - Speakers from France are preferred, being closest to the standard IPA shown.
 */
export function extractPronunciationAudio(section: string, ipa: string | null = null): PronunciationAudio | null {
  const target = ipa ? comparableIpa(ipa) : null;
  let best: { audio: PronunciationAudio; score: number } | null = null;
  for (const m of section.matchAll(/\{\{\s*écouter\s*\|((?:[^{}]|\{\{[^{}]*\}\})*)\}\}/g)) {
    let file: string | null = null;
    let lang: string | null = null;
    let titled = false;
    const positional: string[] = [];
    for (const raw of splitTopLevel(m[1])) {
      const arg = raw.trim();
      const named = /^(\w+)\s*=\s*([\s\S]*)$/.exec(arg);
      if (named) {
        if (named[1] === 'audio') file = named[2].trim();
        else if (named[1] === 'lang') lang = named[2].trim();
        else if (named[1] === 'titre' && named[2].trim()) titled = true;
      } else {
        positional.push(arg);
      }
    }
    if (!file || titled || (lang && lang !== 'fr')) continue;
    if (!/\.(wav|ogg|oga|opus|mp3|flac|webm)$/i.test(file)) continue;

    const region = cleanRegion(positional[0] ?? '');
    const recordedIpa = positional[1]?.trim() ? comparableIpa(positional[1]) : null;
    if (target && recordedIpa && recordedIpa !== target) continue;

    const score = (target && recordedIpa === target ? 4 : 0) + (region && /france/i.test(region) ? 2 : 0);
    if (!best || score > best.score) best = { audio: { file, region }, score };
  }
  return best?.audio ?? null;
}

const MAX_SENSES = 5;

/** Templates that carry no text worth showing inside a definition. */
const DROPPED_TEMPLATES = new Set([
  'm', 'f', 'mf', 'mf ?', 'n', 'c', 'pron', 'phon', 'réf', 'r', 'ref', 'source',
  'exemple', 'ébauche-déf', 'ébauche-exe', 'ébauche', 'ancre', 'note', 'réf ?',
  'référence nécessaire', 'pas clair', 'sans balise', 'ws', 'lang', 'ébauche-étym',
]);

/** Templates whose arguments are a usage domain/label shown in parentheses. */
const LABEL_TEMPLATES = new Set(['term', 'lexique', 'domaine', 'info lex', 'term_lien']);

/** Wiktionary language codes passed as template arguments (only French matters here). */
const LANG_ARGS = new Set(['fr']);

/** Splits template/link content on top-level '|' (ignores pipes inside [[...]] and {{...}}). */
export function splitTopLevel(content: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < content.length; i++) {
    const two = content.slice(i, i + 2);
    if (two === '{{' || two === '[[') {
      depth++;
      current += two;
      i++;
      continue;
    }
    if ((two === '}}' || two === ']]') && depth > 0) {
      depth--;
      current += two;
      i++;
      continue;
    }
    if (content[i] === '|' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += content[i];
  }
  parts.push(current);
  return parts;
}

const NAMED_ARG = /^\s*[\p{L}\d_ -]+\s*=/u;

function positionalArgs(args: string[]): string[] {
  return args.filter((a) => !NAMED_ARG.test(a)).map((a) => a.trim());
}

/** Language codes used by {{étyl}} in etymology sections. */
const ETYMOLOGY_LANGUAGES: Record<string, string> = {
  la: 'latin',
  'la-cl': 'latin classique',
  'bas latin': 'bas latin',
  fro: 'ancien français',
  frm: 'moyen français',
  fr: 'français',
  grc: 'grec ancien',
  el: 'grec',
  frk: 'francique',
  gaul: 'gaulois',
  oc: 'occitan',
  pro: 'ancien occitan',
  it: 'italien',
  es: 'espagnol',
  pt: 'portugais',
  en: 'anglais',
  de: 'allemand',
  nl: 'néerlandais',
  ar: 'arabe',
  ja: 'japonais',
};

function namedArg(args: string[], key: string): string | undefined {
  for (const arg of args) {
    const match = arg.match(/^\s*([^=]+?)\s*=\s*([\s\S]*)$/);
    if (match && match[1] === key) return match[2].trim() || undefined;
  }
  return undefined;
}

/** {{étyl|la|fr|mot=mansio|dif=mānsiō|sens=lieu de séjour}} -> "latin mānsiō (« lieu de séjour »)". */
function renderEtyl(args: string[]): string {
  const positional = positionalArgs(args);
  const code = positional[0] ?? '';
  const language = ETYMOLOGY_LANGUAGES[code] ?? code;
  const word = namedArg(args, 'dif') ?? namedArg(args, 'mot') ?? positional[2] ?? '';
  const sense = namedArg(args, 'sens');
  return [language, word, sense ? `(« ${sense} »)` : ''].filter(Boolean).join(' ');
}

function renderTemplate(inner: string): string {
  const [rawName, ...args] = splitTopLevel(inner);
  const name = rawName.trim().toLowerCase();
  if (DROPPED_TEMPLATES.has(name)) return '';
  if (name === 'étyl') return renderEtyl(args);
  if (name === 'date' || name === 'siècle') {
    const when = positionalArgs(args).filter((a) => a && a !== '?').join(' ');
    return when ? `(${when})` : '';
  }

  const positional = positionalArgs(args).filter((a) => a && !LANG_ARGS.has(a));

  if (name === 'lien' || name === 'l') return positional[0] ?? '';
  if (name === 'w') return positional[1] ?? positional[0] ?? '';
  if (LABEL_TEMPLATES.has(name)) return positional.length ? `(${positional.join(', ')})` : '';
  if (positional.length === 0) {
    // Context labels such as {{figuré|fr}}, {{familier|fr}}, {{Canada|fr}}.
    const label = rawName.trim();
    return /^[\p{L}][\p{L} '’-]*$/u.test(label) ? `(${label})` : '';
  }
  return positional.join(', ');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Converts a fragment of wikitext to plain text. */
export function cleanWikitext(input: string): string {
  let s = input
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');

  // Resolve templates from the innermost outwards.
  for (let i = 0; i < 12 && s.includes('{{'); i++) {
    const next = s.replace(/\{\{([^{}]*)\}\}/g, (_m, inner: string) => renderTemplate(inner));
    if (next === s) break;
    s = next;
  }

  s = s
    .replace(/\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, (_m, target: string, label?: string) => {
      if (/^\s*(image|fichier|file|catégorie|category)\s*:/i.test(target)) return '';
      return label ?? target.split('#')[0];
    })
    .replace(/\[(?:https?:)?\/\/\S+\s+([^\]]+)\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/\s*<br\s*\/?>\s*/gi, ' / ')
    .replace(/<[^>]+>/g, '');

  return decodeEntities(s)
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    // Removed templates can leave "word ." behind; French keeps its space before ; : ! ?
    .replace(/\s+([,.])/g, '$1')
    .replace(/^[\s,;:]+/, '')
    .trim();
}

function braceDepth(s: string): number {
  return (s.match(/\{\{/g)?.length ?? 0) - (s.match(/\}\}/g)?.length ?? 0);
}

/** Joins physical lines so that a multi-line template ({{exemple | ... }}) is one logical line. */
function logicalLines(text: string): string[] {
  const out: string[] = [];
  let buffer = '';
  for (const line of text.split(/\r?\n/)) {
    buffer = buffer ? `${buffer} ${line.trim()}` : line;
    if (braceDepth(buffer) <= 0) {
      out.push(buffer);
      buffer = '';
    }
  }
  if (buffer) out.push(buffer);
  return out;
}

/** Extracts the French section (`== {{langue|fr}} ==`) of a page. */
export function extractFrenchSection(wikitext: string): string | null {
  const start = wikitext.search(/^==\s*\{\{langue\|fr\}\}\s*==\s*$/m);
  if (start === -1) return null;
  const rest = wikitext.slice(start);
  const firstLineEnd = rest.indexOf('\n');
  if (firstLineEnd === -1) return '';
  const body = rest.slice(firstLineEnd + 1);
  const next = body.search(/^==[^=]/m);
  return next === -1 ? body : body.slice(0, next);
}

interface Heading {
  level: number;
  args: string[];
}

function parseHeading(line: string): Heading | null {
  const m = line.match(/^(={2,6})\s*(.*?)\s*\1\s*$/);
  if (!m) return null;
  const s = m[2].match(/^\{\{S\|(.*)\}\}$/);
  return { level: m[1].length, args: s ? splitTopLevel(s[1]).map((a) => a.trim()) : [] };
}

function extractIpa(headLine: string): string | null {
  const m = headLine.match(/\{\{pron\|([^{}]*)\}\}/);
  if (!m) return null;
  const value = positionalArgs(splitTopLevel(m[1])).find((a) => a && !LANG_ARGS.has(a));
  return value ?? null;
}

function extractGender(headLine: string): Gender | null {
  if (/\{\{mf\??(\|[^{}]*)?\}\}/.test(headLine)) return 'mf';
  const hasM = /\{\{m(\|[^{}]*)?\}\}/.test(headLine);
  const hasF = /\{\{f(\|[^{}]*)?\}\}/.test(headLine);
  if (hasM && hasF) return 'mf';
  if (hasM) return 'm';
  if (hasF) return 'f';
  return null;
}

/** Text of an example line (`#* {{exemple|...}}` or the older `#* ''...''`). */
function extractExample(line: string): string | null {
  const body = line.replace(/^#\*\s*/, '');
  const tpl = body.match(/^\{\{\s*exemple\s*\|([\s\S]*)\}\}\s*$/i);
  if (tpl) {
    const first = positionalArgs(splitTopLevel(tpl[1]))[0];
    const text = first ? cleanWikitext(first) : '';
    return text || null;
  }
  if (body.startsWith('{{')) return null;
  return cleanWikitext(body) || null;
}

/** Last [[link]] target of a definition: the lemma in "Pluriel de [[cheval]]." */
/**
 * Target of the last link of a definition line: a wiki link ([[enfant]], [[cheval#fr|cheval]])
 * or a link template ({{lien|enfant|fr}}, {{l|enfant|fr}}), e.g. "Pluriel d'{{lien|enfant|fr}}".
 */
export function lastLinkTarget(raw: string): string | null {
  const found: { index: number; target: string }[] = [];
  for (const m of raw.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)) {
    found.push({ index: m.index ?? 0, target: m[1] });
  }
  for (const m of raw.matchAll(/\{\{\s*(?:lien|l)\s*\|\s*([^|}#]+)/g)) {
    found.push({ index: m.index ?? 0, target: m[1] });
  }
  found.sort((a, b) => a.index - b.index);
  const target = found.at(-1)?.target.trim();
  return target || null;
}

/** Parses a fr.wiktionary page; returns null when it has no French section. */
export function parseFrenchWikitext(wikitext: string): ParsedFrenchPage | null {
  const section = extractFrenchSection(wikitext);
  if (section === null) return null;

  const entries: DictionaryEntry[] = [];
  let formOf: ParsedFrenchPage['formOf'] = null;
  let current: (DictionaryEntry & { headSeen: boolean }) | null = null;
  let lastSense: DictionarySense | null = null;
  let etymology: string | null = null;
  let inEtymology = false;

  const flush = () => {
    if (current && current.senses.length > 0) {
      const { headSeen: _headSeen, ...entry } = current;
      entries.push(entry);
    }
    current = null;
    lastSense = null;
  };

  for (const line of logicalLines(section)) {
    const heading = parseHeading(line);
    if (heading) {
      flush();
      inEtymology = heading.level === 3 && heading.args[0] === 'étymologie' && etymology === null;
      // Part-of-speech sections are level 3 and carry the language: {{S|nom|fr}}.
      if (heading.level === 3 && heading.args[1] === 'fr' && heading.args[0]) {
        current = {
          pos: heading.args[0],
          isInflection: heading.args.includes('flexion'),
          gender: null,
          ipa: null,
          senses: [],
          headSeen: false,
        };
      }
      continue;
    }
    if (inEtymology) {
      if (/^:(?!:)/.test(line)) {
        const text = cleanWikitext(line.replace(/^:s*/, ''));
        if (text) {
          etymology = text;
          inEtymology = false;
        }
      }
      continue;
    }
    if (!current) continue;
    const entry: DictionaryEntry & { headSeen: boolean } = current;

    if (!entry.headSeen && line.startsWith("'''")) {
      entry.headSeen = true;
      entry.ipa = extractIpa(line);
      entry.gender = extractGender(line);
      continue;
    }

    if (/^#\*/.test(line)) {
      if (lastSense && !lastSense.example) {
        const example = extractExample(line);
        if (example) lastSense.example = example;
      }
      continue;
    }

    // Top-level definitions only ("# ..."), not sub-senses ("##") or notes ("#:").
    if (/^#(?![#*:])/.test(line)) {
      if (entry.senses.length >= MAX_SENSES) {
        lastSense = null;
        continue;
      }
      const raw = line.replace(/^#\s*/, '');
      const definition = cleanWikitext(raw);
      if (!definition) continue;
      lastSense = { definition };
      entry.senses.push(lastSense);

      if (entry.isInflection && !formOf) {
        const lemma = lastLinkTarget(raw);
        if (lemma) formOf = { lemma, description: definition };
      }
    }
  }
  flush();

  // Only report "form of" when the page has nothing but inflections.
  if (formOf && entries.some((e) => !e.isInflection)) formOf = null;

  // Show base-word entries before inflection entries.
  entries.sort((a, b) => Number(a.isInflection) - Number(b.isInflection));

  // The card shows this IPA; the recording must match it.
  const ipa = entries.find((e) => e.ipa)?.ipa ?? null;
  return {
    ipa,
    entries,
    formOf,
    etymology,
    audio: extractPronunciationAudio(section, ipa),
  };
}

/** Plain text from the HTML definitions of the en.wiktionary REST API. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<\/li>\s*<li[^>]*>/gi, '; ')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}
