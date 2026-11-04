import { describe, expect, it } from 'vitest';
import type { VocabEntry } from '@/types';
import { emptyVocabulary, parseVocabulary, updateEntry, upsertEntry } from '../model';
import {
  DAY,
  RELEARN_DELAY,
  badgeText,
  dueEntries,
  dueSummary,
  nextIntervalDays,
  reviewEntry,
  scheduleReview,
} from '../review';
import { VocabularyStore, type VocabularyStorage } from '../store';

const NOW = Date.UTC(2026, 10, 4, 12);

function entry(lemma: string, extra: Partial<VocabEntry> = {}): VocabEntry {
  return {
    id: lemma,
    word: lemma,
    lemma,
    pos: null,
    gender: null,
    ipa: null,
    definitions: [],
    note: '',
    contextSentence: null,
    sourceUrl: null,
    sourceTitle: null,
    status: 'new',
    saved: true,
    ignoreSpelling: false,
    createdAt: 1,
    updatedAt: 1,
    reviewCount: 0,
    dueAt: 0,
    ease: 2.5,
    intervalDays: 0,
    ...extra,
  };
}

describe('scheduleReview (simplified SM-2)', () => {
  it('"remembered": 1 day, then 6 days, then interval × ease; known after 21 days', () => {
    let e = entry('ami');
    const intervals: number[] = [];
    const statuses: string[] = [];
    for (let i = 0; i < 4; i++) {
      e = { ...e, ...scheduleReview(e, 'remembered', NOW) };
      intervals.push(e.intervalDays);
      statuses.push(e.status);
    }
    expect(intervals).toEqual([1, 6, 15, 38]);
    expect(statuses).toEqual(['learning', 'learning', 'learning', 'known']);
    expect(e.reviewCount).toBe(4);
    expect(e.ease).toBe(2.5);
    expect(e.dueAt).toBe(NOW + 38 * DAY);
  });

  it('"forgot": back to the start in 10 minutes, ease lowered but not below 1.3', () => {
    const e = scheduleReview(entry('ami', { intervalDays: 15, ease: 2.5, status: 'learning' }), 'forgot', NOW);
    expect(e).toEqual({ reviewCount: 1, intervalDays: 0, ease: 2.3, dueAt: NOW + RELEARN_DELAY, status: 'learning' });
    expect(scheduleReview(entry('ami', { ease: 1.4 }), 'forgot', NOW).ease).toBe(1.3);
    expect(nextIntervalDays({ intervalDays: 0, ease: 1.3 })).toBe(1);
  });
});

describe('due words', () => {
  const list = [
    entry('new1', { createdAt: 5 }),
    entry('new0', { createdAt: 2 }),
    entry('late', { dueAt: NOW - DAY, status: 'learning' }),
    entry('later', { dueAt: NOW + 2 * DAY, status: 'learning' }),
    entry('soon', { dueAt: NOW + 3600_000, status: 'learning' }),
    entry('known', { status: 'known' }),
    entry('spelling', { saved: false, ignoreSpelling: true }),
  ];

  it('lists saved, not-known words whose time has come, new ones by date added', () => {
    expect(dueEntries(list, NOW).map((e) => e.id)).toEqual(['new0', 'new1', 'late']);
  });

  it('summarises the count and the next due time', () => {
    expect(dueSummary(list, NOW)).toEqual({ due: 3, nextDueAt: NOW + 3600_000 });
    expect(dueSummary([], NOW)).toEqual({ due: 0, nextDueAt: null });
  });

  it('badge text', () => {
    expect([badgeText(0), badgeText(7), badgeText(150)]).toEqual(['', '7', '99+']);
  });
});

describe('model integration', () => {
  it('reviewEntry updates the stored entry; re-saving a word keeps its schedule', () => {
    const state = emptyVocabulary();
    upsertEntry(state, { word: 'ami', saved: true }, NOW);
    reviewEntry(state, 'ami', 'remembered', NOW);
    upsertEntry(state, { word: 'ami', contextSentence: 'Mon ami.', sourceUrl: 'https://x.example/' }, NOW + 5);
    expect(state.entries.ami).toMatchObject({ intervalDays: 1, dueAt: NOW + DAY, reviewCount: 1, status: 'learning' });
    expect(reviewEntry(state, 'nope', 'forgot', NOW)).toBeNull();
  });

  it('setting the status by hand: "new" restarts, leaving "known" makes the word due', () => {
    const state = emptyVocabulary();
    state.entries.ami = entry('ami', { status: 'known', intervalDays: 40, dueAt: NOW + 40 * DAY });
    updateEntry(state, 'ami', { status: 'learning' }, NOW);
    expect(state.entries.ami).toMatchObject({ dueAt: 0, intervalDays: 40 });
    state.entries.ami.dueAt = NOW + DAY;
    updateEntry(state, 'ami', { status: 'new' }, NOW);
    expect(state.entries.ami).toMatchObject({ dueAt: 0, intervalDays: 0 });
    // Same status again: nothing reset.
    state.entries.ami.dueAt = NOW + DAY;
    updateEntry(state, 'ami', { status: 'new' }, NOW);
    expect(state.entries.ami.dueAt).toBe(NOW + DAY);
  });

  it('older entries get default scheduling fields; bad values are clamped', () => {
    const state = parseVocabulary({ entries: { a: { word: 'ami' }, b: { word: 'chat', ease: 9, dueAt: -3, intervalDays: 'x' } } })!;
    expect(state.entries.ami).toMatchObject({ dueAt: 0, ease: 2.5, intervalDays: 0 });
    expect(state.entries.chat).toMatchObject({ dueAt: 0, ease: 3.5, intervalDays: 0 });
  });
});

describe('VocabularyStore review command', () => {
  it('writes the answer and reports the due summary', async () => {
    const data: Record<string, unknown> = {};
    const storage: VocabularyStorage = {
      get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]])),
      set: async (items) => void Object.assign(data, items),
      remove: async (keys) => keys.forEach((k) => delete data[k]),
      getLegacyDictionary: async () => [],
    };
    let now = NOW;
    const store = new VocabularyStore(storage, () => now);
    await store.apply({ op: 'save', draft: { word: 'ami' } });
    await store.apply({ op: 'save', draft: { word: 'chat' } });
    expect(await store.dueSummary()).toEqual({ due: 2, nextDueAt: null });
    await store.apply({ op: 'review', id: 'ami', grade: 'remembered' });
    expect(data['vocab:ami']).toMatchObject({ intervalDays: 1, status: 'learning', reviewCount: 1 });
    expect(await store.dueSummary()).toEqual({ due: 1, nextDueAt: NOW + DAY });
    now = NOW + DAY;
    expect((await store.dueSummary()).due).toBe(2);
    // A word removed meanwhile is not recreated by a late answer.
    await store.apply({ op: 'unsave', id: 'chat' });
    expect(await store.apply({ op: 'review', id: 'chat', grade: 'forgot' })).toBeNull();
    expect(data['vocab:chat']).toBeUndefined();
    await expect(store.apply({ op: 'review', id: 'ami', grade: 'bogus' as never })).rejects.toThrow();
  });
});
