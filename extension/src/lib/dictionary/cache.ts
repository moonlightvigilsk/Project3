import { PARSER_VERSION, type LookupResponse } from './types';

/** Each response is stored under its own key so a lookup only reads/writes that entry. */
const ENTRY_PREFIX = 'lookup:';
/** Small map key -> last use, used for LRU eviction. */
const INDEX_KEY = 'lookupIndex';
/** Pre-1.1 storage: the whole cache in a single key (removed on first use). */
const LEGACY_KEY = 'lookupCache';
const MAX_ENTRIES = 500;
const TTL_OK_MS = 30 * 24 * 60 * 60 * 1000;
const TTL_NOT_FOUND_MS = 24 * 60 * 60 * 1000;
/** A cache hit only rewrites the index when the recorded use is older than this. */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

interface CachedLookup {
  response: LookupResponse;
  storedAt: number;
}

type LruIndex = Record<string, number>;

/** Minimal async key-value store, so the cache can be tested without browser.storage. */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

export function cacheKey(query: string): string {
  return query.normalize('NFC').trim();
}

export function entryStorageKey(query: string): string {
  return ENTRY_PREFIX + cacheKey(query);
}

function isFresh(entry: CachedLookup, now: number): boolean {
  const ttl = entry.response.status === 'ok' ? TTL_OK_MS : TTL_NOT_FOUND_MS;
  return now - entry.storedAt < ttl;
}

/**
 * LRU cache of lookup responses (errors are never cached).
 * Operations are serialized so concurrent lookups cannot overwrite each other's index updates.
 */
export class LookupCache {
  private queue: Promise<unknown> = Promise.resolve();
  private legacyCleared = false;

  constructor(
    private readonly store: KeyValueStore,
    private readonly now: () => number = Date.now
  ) {}

  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async readIndex(): Promise<LruIndex> {
    if (!this.legacyCleared) {
      this.legacyCleared = true;
      await this.store.remove([LEGACY_KEY]);
    }
    return ((await this.store.get(INDEX_KEY)) as LruIndex | undefined) ?? {};
  }

  get(query: string): Promise<LookupResponse | null> {
    return this.serialize(async () => {
      const key = cacheKey(query);
      const entry = (await this.store.get(ENTRY_PREFIX + key)) as CachedLookup | undefined;
      if (!entry) return null;
      const now = this.now();
      const index = await this.readIndex();
      if (!isFresh(entry, now)) {
        delete index[key];
        await this.store.remove([ENTRY_PREFIX + key]);
        await this.store.set(INDEX_KEY, index);
        return null;
      }
      if (!(key in index) || now - index[key] >= TOUCH_INTERVAL_MS) {
        index[key] = now;
        await this.store.set(INDEX_KEY, index);
      }
      return entry.response;
    });
  }

  set(query: string, response: LookupResponse): Promise<void> {
    if (response.status === 'error') return Promise.resolve();
    return this.serialize(async () => {
      const key = cacheKey(query);
      const now = this.now();
      const index = await this.readIndex();
      const entry: CachedLookup = { response, storedAt: now };
      await this.store.set(ENTRY_PREFIX + key, entry);
      index[key] = now;

      const keys = Object.keys(index);
      if (keys.length > MAX_ENTRIES) {
        const evicted = keys
          .sort((a, b) => index[a] - index[b])
          .slice(0, keys.length - MAX_ENTRIES);
        evicted.forEach((k) => delete index[k]);
        await this.store.remove(evicted.map((k) => ENTRY_PREFIX + k));
      }
      await this.store.set(INDEX_KEY, index);
    });
  }
}

/**
 * True for results built by an older parser (PARSER_VERSION): they are fetched again
 * instead of being served, e.g. to get recordings (US-04) or fixed lemmas (US-06).
 */
export function isOutdatedLookup(response: LookupResponse): boolean {
  return response.status === 'ok' && response.result.parserVersion !== PARSER_VERSION;
}

export const LOOKUP_CACHE_LIMIT = MAX_ENTRIES;
export const LOOKUP_CACHE_TOUCH_INTERVAL_MS = TOUCH_INTERVAL_MS;
