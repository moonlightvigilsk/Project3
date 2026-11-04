import type { GrammarCard } from '@/lib/chat/types';

/**
 * Starred items (☆ on the word card, the grammar card and its source link).
 * Kept in storage.local: grammar cards can exceed the 8KB/item limit of storage.sync.
 * Content scripts and extension pages read/write it directly.
 */
export type BookmarkKind = 'word' | 'grammar' | 'resource';

export interface Bookmark {
  /** `${kind}:${key}`, so the same word/card/URL is only saved once. */
  id: string;
  kind: BookmarkKind;
  title: string;
  subtitle?: string;
  url?: string;
  /** Full card for grammar bookmarks, so it can be reopened without the AI. */
  card?: GrammarCard;
  createdAt: number;
}

const KEY = 'bookmarks';
const MAX_BOOKMARKS = 500;

export function bookmarkId(kind: BookmarkKind, key: string): string {
  return `${kind}:${key.trim().toLowerCase()}`;
}

export async function getBookmarks(): Promise<Bookmark[]> {
  const stored = (await browser.storage.local.get(KEY))[KEY];
  return Array.isArray(stored) ? (stored as Bookmark[]) : [];
}

export async function isBookmarked(id: string): Promise<boolean> {
  return (await getBookmarks()).some((b) => b.id === id);
}

/** Adds the bookmark, or removes it when it is already saved. Returns the new state. */
export async function toggleBookmark(bookmark: Omit<Bookmark, 'createdAt'>): Promise<boolean> {
  const all = await getBookmarks();
  const exists = all.some((b) => b.id === bookmark.id);
  const next = exists
    ? all.filter((b) => b.id !== bookmark.id)
    : [{ ...bookmark, createdAt: Date.now() }, ...all].slice(0, MAX_BOOKMARKS);
  await browser.storage.local.set({ [KEY]: next });
  return !exists;
}

export async function removeBookmark(id: string): Promise<void> {
  const all = await getBookmarks();
  await browser.storage.local.set({ [KEY]: all.filter((b) => b.id !== id) });
}

export function watchBookmarks(callback: (value: Bookmark[]) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === 'local' && changes[KEY]) {
      const value = changes[KEY].newValue;
      callback(Array.isArray(value) ? (value as Bookmark[]) : []);
    }
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
