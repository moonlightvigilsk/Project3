import { lookupCandidates, normalizeLookupQuery, withoutDeterminer } from './normalize';
import { htmlToText, parseFrenchWikitext, type ParsedFrenchPage } from './wikitext';
import { PARSER_VERSION, type EnglishGloss, type LookupResponse, type LookupResult } from './types';

const FR_API = 'https://fr.wiktionary.org/w/api.php';
const EN_REST = 'https://en.wiktionary.org/api/rest_v1/page/definition/';
const REQUEST_TIMEOUT_MS = 8000;
const MAX_EN_POS = 3;
const MAX_EN_DEFS = 3;

/** Wikimedia asks API clients to identify themselves; browsers cannot set User-Agent. */
const HEADERS = { 'Api-User-Agent': 'TextChecker/1.0 (browser extension; French dictionary lookup)' };

/** Proper-noun sections: a capitalized selection should prefer the common word when it exists. */
const PROPER_NOUN_POS = new Set(['nom propre', 'prénom', 'nom de famille']);

/** Direct link to a Commons file (redirects to upload.wikimedia.org). */
export function commonsFileUrl(file: string): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}`;
}

export function wiktionaryPageUrl(title: string): string {
  return `https://fr.wiktionary.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

async function getJson(url: string): Promise<{ status: number; body: unknown }> {
  const resp = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  let body: unknown = null;
  try {
    body = await resp.json();
  } catch {
    body = null;
  }
  return { status: resp.status, body };
}

interface FrenchPage {
  title: string;
  parsed: ParsedFrenchPage | null;
}

/** Fetches and parses a fr.wiktionary page; null when the page does not exist. Throws on network errors. */
export async function fetchFrenchPage(title: string): Promise<FrenchPage | null> {
  const params = new URLSearchParams({
    action: 'parse',
    format: 'json',
    formatversion: '2',
    prop: 'wikitext',
    redirects: '1',
    origin: '*',
    page: title,
  });
  const { status, body } = await getJson(`${FR_API}?${params}`);
  const data = body as { parse?: { title: string; wikitext: string }; error?: { code: string } } | null;
  if (data?.error?.code === 'missingtitle' || data?.error?.code === 'invalidtitle') return null;
  if (status !== 200 || !data?.parse) {
    throw new Error(`fr.wiktionary HTTP ${status}${data?.error ? ` (${data.error.code})` : ''}`);
  }
  return { title: data.parse.title, parsed: parseFrenchWikitext(data.parse.wikitext) };
}

/** English glosses of a French word; [] when missing or on any error (they are optional). */
export async function fetchEnglishGlosses(title: string): Promise<EnglishGloss[]> {
  try {
    const { status, body } = await getJson(EN_REST + encodeURIComponent(title.replace(/ /g, '_')));
    if (status !== 200) return [];
    const french = (body as { fr?: { partOfSpeech: string; definitions?: { definition: string }[] }[] })?.fr ?? [];
    return french
      .map((block) => ({
        pos: block.partOfSpeech,
        definitions: (block.definitions ?? [])
          .map((d) => htmlToText(d.definition))
          .filter(Boolean)
          .slice(0, MAX_EN_DEFS),
      }))
      .filter((g) => g.definitions.length > 0)
      .slice(0, MAX_EN_POS);
  } catch {
    return [];
  }
}

function pageScore(page: FrenchPage | null): number {
  const entries = page?.parsed?.entries ?? [];
  if (entries.length === 0) return 0;
  return entries.some((e) => !PROPER_NOUN_POS.has(e.pos)) ? 2 : 1;
}

/**
 * Looks a selection up on Wiktionary:
 * 1. fr.wiktionary page of the word (and its lowercase form if capitalized),
 * 2. if it is only an inflection (mangeons, allé), the page of its lemma,
 * 3. English glosses from en.wiktionary for the lemma.
 */
export async function lookupWord(rawText: string): Promise<LookupResponse> {
  const word = normalizeLookupQuery(rawText);
  if (!word) return { status: 'not_found', word: rawText.trim() };

  const candidates = lookupCandidates(word);
  // English glosses are requested in parallel with the French pages to save a round trip;
  // they are only awaited for the candidate that wins.
  const englishByTitle = new Map(candidates.map((c) => [c, fetchEnglishGlosses(c)]));
  const settled = await Promise.allSettled(candidates.map((c) => fetchFrenchPage(c)));
  const failure = settled.find((s): s is PromiseRejectedResult => s.status === 'rejected');
  const errorResponse = (reason: unknown): LookupResponse => ({
    status: 'error',
    word,
    message: reason instanceof Error ? reason.message : String(reason),
  });
  if (settled.every((s) => s.status === 'rejected')) return errorResponse(failure!.reason);

  let best: FrenchPage | null = null;
  let bestScore = 0;
  settled.forEach((s) => {
    const page = s.status === 'fulfilled' ? s.value : null;
    const score = pageScore(page);
    if (score > bestScore) {
      best = page;
      bestScore = score;
    }
  });

  // A request failed and the others found nothing: the word may well exist, so report
  // a (retryable, uncached) error rather than a "not found" that would be cached.
  if (!best && failure) return errorResponse(failure.reason);

  if (!best) {
    // "la maison" has no page of its own: retry without the determiner.
    const shorter = withoutDeterminer(word);
    if (shorter) return lookupWord(shorter);
  }

  // No French entry: English glosses alone are still useful.
  if (!best) {
    for (const candidate of candidates) {
      const english = await englishByTitle.get(candidate)!;
      if (english.length > 0) {
        const result: LookupResult = {
          word: candidate,
          lemma: candidate,
          ipa: null,
          formOf: null,
          entries: [],
          english,
          audio: null,
          sourceUrl: wiktionaryPageUrl(candidate),
          parserVersion: PARSER_VERSION,
        };
        return { status: 'ok', result };
      }
    }
    return { status: 'not_found', word };
  }

  const page: FrenchPage = best;
  const parsed = page.parsed!;
  const formOf = parsed.formOf && parsed.formOf.lemma !== page.title ? parsed.formOf : null;
  const lemma = formOf?.lemma ?? page.title;

  let entries = parsed.entries;
  let etymology = parsed.etymology;
  let english: EnglishGloss[];
  if (formOf) {
    const [lemmaPage, glosses] = await Promise.all([
      fetchFrenchPage(lemma).catch(() => null),
      fetchEnglishGlosses(lemma),
    ]);
    if (lemmaPage?.parsed?.entries.length) entries = lemmaPage.parsed.entries;
    etymology = lemmaPage?.parsed?.etymology ?? null;
    english = glosses;
  } else {
    english = await (englishByTitle.get(page.title) ?? fetchEnglishGlosses(page.title));
  }

  const result: LookupResult = {
    word: page.title,
    lemma,
    ipa: parsed.ipa,
    formOf,
    entries,
    english,
    etymology,
    audio: parsed.audio,
    sourceUrl: wiktionaryPageUrl(lemma),
    parserVersion: PARSER_VERSION,
  };
  return { status: 'ok', result };
}
