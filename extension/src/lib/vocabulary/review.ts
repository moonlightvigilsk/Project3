import type { VocabEntry } from '@/types';
import { MIN_EASE, type VocabularyState } from './model';

/**
 * Flashcard scheduling (US-10): SM-2 reduced to two answers.
 * - "Forgot": back to the start, seen again 10 minutes later, ease −0.2.
 * - "Remembered": interval 1 day, then 6 days, then interval × ease (SM-2 quality 4,
 *   ease unchanged).
 * A word whose interval reaches KNOWN_AFTER_DAYS becomes "known". Known words are not
 * reviewed (set them back to "learning" to review them again).
 */

export type ReviewGrade = 'forgot' | 'remembered';

export const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;
export const RELEARN_DELAY = 10 * MINUTE;
export const KNOWN_AFTER_DAYS = 21;
const EASE_PENALTY = 0.2;

/** Interval in days after a correct answer. */
export function nextIntervalDays(entry: Pick<VocabEntry, 'intervalDays' | 'ease'>): number {
  if (entry.intervalDays < 1) return 1;
  if (entry.intervalDays < 6) return 6;
  return Math.round(entry.intervalDays * entry.ease);
}

/** Scheduling fields after an answer (pure). */
export function scheduleReview(
  entry: VocabEntry,
  grade: ReviewGrade,
  now: number
): Pick<VocabEntry, 'dueAt' | 'ease' | 'intervalDays' | 'status' | 'reviewCount'> {
  const reviewCount = entry.reviewCount + 1;
  if (grade === 'forgot') {
    return {
      reviewCount,
      intervalDays: 0,
      ease: Math.max(MIN_EASE, Math.round((entry.ease - EASE_PENALTY) * 100) / 100),
      dueAt: now + RELEARN_DELAY,
      status: 'learning',
    };
  }
  const intervalDays = nextIntervalDays(entry);
  return {
    reviewCount,
    intervalDays,
    ease: entry.ease,
    dueAt: now + intervalDays * DAY,
    status: intervalDays >= KNOWN_AFTER_DAYS ? 'known' : 'learning',
  };
}

/** Applies an answer to the notebook; null when the word is no longer there. */
export function reviewEntry(state: VocabularyState, id: string, grade: ReviewGrade, now: number): VocabEntry | null {
  const prev = state.entries[id];
  if (!prev) return null;
  const next: VocabEntry = { ...prev, ...scheduleReview(prev, grade, now), updatedAt: now };
  state.entries[id] = next;
  return next;
}

/** Words that take part in reviews: saved and not known yet. */
export function isReviewable(entry: VocabEntry): boolean {
  return entry.saved && entry.status !== 'known';
}

/** Words due for review, the most overdue first (new words, due at 0, by date added). */
export function dueEntries(entries: Iterable<VocabEntry>, now: number): VocabEntry[] {
  return [...entries]
    .filter((e) => isReviewable(e) && e.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt || a.createdAt - b.createdAt);
}

/** Number of due words and when the next one becomes due (null: none scheduled). */
export function dueSummary(entries: Iterable<VocabEntry>, now: number): { due: number; nextDueAt: number | null } {
  let due = 0;
  let nextDueAt: number | null = null;
  for (const e of entries) {
    if (!isReviewable(e)) continue;
    if (e.dueAt <= now) due++;
    else if (nextDueAt === null || e.dueAt < nextDueAt) nextDueAt = e.dueAt;
  }
  return { due, nextDueAt };
}

/** Text of the toolbar badge. */
export function badgeText(due: number): string {
  if (due <= 0) return '';
  return due > 99 ? '99+' : String(due);
}
