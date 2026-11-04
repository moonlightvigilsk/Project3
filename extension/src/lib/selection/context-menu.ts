import type { LookupResponse } from '@/lib/dictionary/types';
import { normalizeLookupQuery } from '@/lib/dictionary/normalize';
import { wiktionaryPageUrl } from '@/lib/dictionary/wiktionary';
import { vocabDraftFromLookup, type VocabDraft } from '@/lib/vocabulary/model';
import { toLookupText } from './selection-info';

/**
 * Context menu "Look up" / "Add to vocabulary" (US-06). The browser shows the items for
 * any selection, so the selection is checked here: only a word or short phrase (the
 * same limit as the lookup button) is looked up or saved.
 */

/** The selection as a lookup query, or null when it is too long to be a word or phrase. */
export function contextMenuQuery(selectionText: string): string | null {
  return toLookupText(selectionText);
}

/** Wiktionary search, for selections that are not a single entry. */
export function wiktionarySearchUrl(text: string): string {
  return `https://fr.wiktionary.org/w/index.php?search=${encodeURIComponent(text.replace(/\s+/g, ' ').trim().slice(0, 200))}`;
}

export type ContextMenuFallback =
  | { type: 'save'; draft: VocabDraft }
  | { type: 'open'; url: string }
  | { type: 'none' };

/**
 * What the background does when no content script handled the click (browser pages,
 * the PDF viewer...): open Wiktionary, or save the word without its sentence.
 * `response` is the lookup of the query (null when the selection is too long).
 */
export function contextMenuFallback(
  selectionText: string,
  save: boolean,
  response: LookupResponse | null,
  page: { url: string | null; title: string | null }
): ContextMenuFallback {
  const query = contextMenuQuery(selectionText);
  if (!query) return save ? { type: 'none' } : { type: 'open', url: wiktionarySearchUrl(selectionText) };
  const word = normalizeLookupQuery(query) || query;
  if (!save) {
    return { type: 'open', url: response?.status === 'ok' ? response.result.sourceUrl : wiktionaryPageUrl(word) };
  }
  if (response?.status === 'error') return { type: 'none' }; // unknown: do not save a guess
  const draft: VocabDraft =
    response?.status === 'ok'
      ? vocabDraftFromLookup(response.result, page)
      : { word, sourceUrl: page.url, sourceTitle: page.title };
  return { type: 'save', draft };
}
