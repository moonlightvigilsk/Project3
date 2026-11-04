import type { APIKeys, Settings, CacheEntry } from '@/types';
import { withDefaultSettings } from '@/types';

// Helper to get from sync storage
async function getSyncItem<T>(key: string, defaultValue: T): Promise<T> {
  const result = await browser.storage.sync.get(key);
  return (result[key] as T) ?? defaultValue;
}

// Helper to set sync storage
async function setSyncItem<T>(key: string, value: T): Promise<void> {
  await browser.storage.sync.set({ [key]: value });
}

// Helper to get from local storage
async function getLocalItem<T>(key: string, defaultValue: T): Promise<T> {
  const result = await browser.storage.local.get(key);
  return (result[key] as T) ?? defaultValue;
}

// Helper to set local storage
async function setLocalItem<T>(key: string, value: T): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

// API Keys storage
export const apiKeysStorage = {
  async getValue(): Promise<APIKeys> {
    return getSyncItem<APIKeys>('apiKeys', {});
  },
  async setValue(value: APIKeys): Promise<void> {
    await setSyncItem('apiKeys', value);
  },
  watch(callback: (value: APIKeys) => void): () => void {
    const listener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, areaName: string) => {
      if (areaName === 'sync' && changes.apiKeys) {
        callback((changes.apiKeys.newValue as APIKeys) ?? {});
      }
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  },
};

// Settings storage
export const settingsStorage = {
  async getValue(): Promise<Settings> {
    return withDefaultSettings(await getSyncItem<Partial<Settings> | null>('settings', null));
  },
  async setValue(value: Settings): Promise<void> {
    await setSyncItem('settings', value);
  },
  watch(callback: (value: Settings) => void): () => void {
    const listener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, areaName: string) => {
      if (areaName === 'sync' && changes.settings) {
        callback(withDefaultSettings(changes.settings.newValue as Partial<Settings> | undefined));
      }
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  },
};

// The personal dictionary (words ignored by the spell check) is now part of the
// vocabulary notebook: see src/lib/vocabulary (US-05). Its old storage.sync key
// "dictionary" is only read once, by the migration.

// Stats storage
export const statsStorage = {
  async getValue(): Promise<{ checksPerformed: number; errorsFound: number; correctionsApplied: number }> {
    return getSyncItem('stats', {
      checksPerformed: 0,
      errorsFound: 0,
      correctionsApplied: 0,
    });
  },
  async setValue(value: { checksPerformed: number; errorsFound: number; correctionsApplied: number }): Promise<void> {
    await setSyncItem('stats', value);
  },
};

// Cache storage (local only)
export const cacheStorage = {
  async getValue(): Promise<Record<string, CacheEntry>> {
    return getLocalItem<Record<string, CacheEntry>>('cache', {});
  },
  async setValue(value: Record<string, CacheEntry>): Promise<void> {
    await setLocalItem('cache', value);
  },
};

// Helper functions
export async function getApiKey(provider: keyof APIKeys): Promise<string | undefined> {
  const keys = await apiKeysStorage.getValue();
  return keys[provider];
}

export async function setApiKey(provider: keyof APIKeys, key: string): Promise<void> {
  const keys = await apiKeysStorage.getValue();
  await apiKeysStorage.setValue({ ...keys, [provider]: key });
}

export async function getCachedResult(text: string): Promise<CacheEntry | undefined> {
  const cache = await cacheStorage.getValue();
  const hash = hashText(text);
  const entry = cache[hash];

  // Cache expires after 1 hour
  if (entry && Date.now() - entry.timestamp < 3600000) {
    return entry;
  }

  return undefined;
}

export async function setCachedResult(text: string, entry: CacheEntry): Promise<void> {
  const cache = await cacheStorage.getValue();
  const hash = hashText(text);

  // Expired results (1 hour) are removed, so checked text does not stay on disk (US-14 privacy policy).
  const now = Date.now();
  for (const [key, value] of Object.entries(cache)) {
    if (!value || now - value.timestamp >= 3600000) delete cache[key];
  }

  // Limit cache size to 100 entries
  const entries = Object.entries(cache);
  if (entries.length >= 100) {
    // Remove oldest entries
    const sorted = entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = sorted.slice(0, 20);
    toRemove.forEach(([key]) => delete cache[key]);
  }

  cache[hash] = entry;
  await cacheStorage.setValue(cache);
}

export async function incrementStats(field: 'checksPerformed' | 'errorsFound' | 'correctionsApplied', amount = 1): Promise<void> {
  const stats = await statsStorage.getValue();
  await statsStorage.setValue({
    ...stats,
    [field]: stats[field] + amount,
  });
}

// Simple hash function for caching
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}
