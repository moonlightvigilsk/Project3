import { useCallback, useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import type { UILanguage, VocabEntry } from '@/types';
import type { Translations } from '@/lib/i18n';
import { reviewWord } from '@/lib/vocabulary/client';
import {
  DAY,
  RELEARN_DELAY,
  dueEntries,
  dueSummary,
  nextIntervalDays,
  type ReviewGrade,
} from '@/lib/vocabulary/review';
import { ContextSentence, SourceLink, grammarLine, useSavedVocabulary } from '@/components/vocab';

const LOCALES: Record<UILanguage, string> = { vi: 'vi-VN', en: 'en-GB', fr: 'fr-FR' };

/** "10 phút", "6 ngày"… for the answer buttons. */
export function formatDuration(ms: number, lang: UILanguage): string {
  const [value, unit] =
    ms < 3_600_000
      ? [Math.max(1, Math.round(ms / 60_000)), 'minute']
      : ms < DAY
        ? [Math.round(ms / 3_600_000), 'hour']
        : ms < 60 * DAY
          ? [Math.round(ms / DAY), 'day']
          : [Math.round(ms / (30 * DAY)), 'month'];
  return new Intl.NumberFormat(LOCALES[lang], { style: 'unit', unit, unitDisplay: 'long' }).format(value);
}

/** "in 3 hours" / "sau 3 giờ nữa"… for the next review time. */
function formatWhen(ts: number, now: number, lang: UILanguage): string {
  const ms = ts - now;
  const rtf = new Intl.RelativeTimeFormat(LOCALES[lang], { numeric: 'auto' });
  if (ms < 3_600_000) return rtf.format(Math.max(1, Math.round(ms / 60_000)), 'minute');
  if (ms < DAY) return rtf.format(Math.round(ms / 3_600_000), 'hour');
  return rtf.format(Math.round(ms / DAY), 'day');
}

/**
 * US-10: flashcards in the popup. The session is the list of due words when the tab
 * opens; a forgotten word comes back at the end of the session.
 */
export function PopupReview({ t, lang }: { t: Translations; lang: UILanguage }) {
  const { entries } = useSavedVocabulary();
  const [queue, setQueue] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reviewed, setReviewed] = useState(() => new Set<string>());

  useEffect(() => {
    if (entries && queue === null) setQueue(dueEntries(entries, Date.now()).map((e) => e.id));
  }, [entries, queue]);

  // Words removed (or marked known) elsewhere during the session are skipped.
  const byId = new Map((entries ?? []).map((e) => [e.id, e]));
  let current: VocabEntry | undefined;
  let position = index;
  if (queue) {
    while (position < queue.length) {
      const e = byId.get(queue[position]);
      if (e && e.saved && e.status !== 'known') {
        current = e;
        break;
      }
      position++;
    }
  }

  const answer = useCallback(
    async (grade: ReviewGrade) => {
      if (!current || busy) return;
      setBusy(true);
      setFailed(false);
      try {
        await reviewWord(current.id, grade);
        const id = current.id;
        setReviewed((s) => new Set(s).add(id));
        if (grade === 'forgot') setQueue((q) => [...(q ?? []), id]);
        setIndex(position + 1);
        setFlipped(false);
      } catch {
        setFailed(true);
      } finally {
        setBusy(false);
      }
    },
    [current, busy, position]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!flipped && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setFlipped(true);
      } else if (flipped && (e.key === '1' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        void answer('forgot');
      } else if (flipped && (e.key === '2' || e.key === 'ArrowRight')) {
        e.preventDefault();
        void answer('remembered');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, flipped, answer]);

  if (!entries || !queue) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin w-5 h-5 border-2 border-french-bordeaux border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!current) {
    const now = Date.now();
    const { due, nextDueAt } = dueSummary(entries, now);
    const reviewable = entries.some((e) => e.status !== 'known');
    return (
      <div className="px-5 py-7 text-center" data-testid="review-done">
        {reviewed.size > 0 ? (
          <>
            <p className="text-xs font-medium text-ink-700">{t.reviewDoneTitle}</p>
            <p className="text-[11px] text-ink-500 mt-1">{t.reviewDoneDesc(reviewed.size)}</p>
          </>
        ) : (
          <>
            <GraduationCap className="w-7 h-7 text-ink-300 mx-auto mb-2" />
            <p className="text-xs font-medium text-ink-600">{reviewable ? t.reviewNothingDue : t.reviewEmpty}</p>
          </>
        )}
        {due === 0 && nextDueAt !== null && (
          <p className="text-[11px] text-ink-500 mt-2">{t.reviewNextDue(formatWhen(nextDueAt, now, lang))}</p>
        )}
        {due > 0 && (
          <button
            type="button"
            onClick={() => {
              setQueue(null);
              setIndex(0);
              setReviewed(new Set());
            }}
            className="mt-3 px-3 py-1.5 rounded-lg bg-ink-900 text-parchment-50 text-xs font-medium hover:bg-ink-800"
          >
            {t.reviewBadgeTitle(due)} &rarr;
          </button>
        )}
      </div>
    );
  }

  const grammar = grammarLine(current);
  const answerButton = 'flex-1 flex flex-col items-center rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50';

  return (
    <div className="p-3 select-text" data-testid="review-card">
      <div className="flex items-center justify-between text-[10px] font-mono text-ink-500 mb-2">
        <span role="status">{t.reviewProgress(position + 1, queue.length)}</span>
        <span>{t.reviewKeysHint}</span>
      </div>

      <div className="rounded-xl border border-stone-border bg-parchment-50 shadow-sm px-4 py-5 min-h-[180px]">
        <div className="text-center">
          <div className="font-serif font-bold text-2xl text-ink-900 break-words" data-testid="review-word">
            {current.lemma}
          </div>
          {current.ipa && <div className="font-mono text-xs text-ink-500 mt-0.5">/{current.ipa}/</div>}
          {grammar && <div className="text-[11px] text-ink-500 mt-0.5">{grammar}</div>}
          {/* The sentence where the word was met: reviewed in context, not as an isolated word. */}
          {current.contextSentence && (
            <div className="mt-3 text-xs leading-relaxed" data-testid="review-context">
              <ContextSentence entry={current} />
            </div>
          )}
        </div>

        {flipped ? (
          <div className="mt-4 pt-3 border-t border-stone-border space-y-2 text-xs" data-testid="review-back">
            {current.definitions.length > 0 && (
              <ol className="list-decimal pl-4 space-y-0.5 text-ink-800">
                {current.definitions.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ol>
            )}
            {current.note.trim() && <p className="text-ink-600 whitespace-pre-line">{current.note}</p>}
            <SourceLink entry={current} />
          </div>
        ) : (
          <div className="mt-6 text-center">
            <button
              type="button"
              autoFocus
              onClick={() => setFlipped(true)}
              className="px-4 py-2 rounded-lg bg-ink-900 text-parchment-50 text-xs font-medium hover:bg-ink-800"
            >
              {t.reviewShowAnswer}
            </button>
          </div>
        )}
      </div>

      {flipped && (
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void answer('forgot')}
            className={`${answerButton} border-note-line bg-note text-french-ochre hover:bg-note-hover`}
          >
            {t.reviewForgot}
            <span className="font-normal text-[10px] opacity-80">{formatDuration(RELEARN_DELAY, lang)}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void answer('remembered')}
            className={`${answerButton} border-ok-line bg-ok text-emerald-800 hover:bg-ok-hover`}
          >
            {t.reviewRemembered}
            <span className="font-normal text-[10px] opacity-80">{formatDuration(nextIntervalDays(current) * DAY, lang)}</span>
          </button>
        </div>
      )}
      {failed && <p className="text-[11px] text-french-bordeaux mt-2 text-center">{t.reviewFailed}</p>}
    </div>
  );
}
