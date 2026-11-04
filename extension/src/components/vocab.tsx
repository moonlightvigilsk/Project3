import { useCallback, useEffect, useRef, useState } from 'react';
import type { UILanguage, VocabEntry, VocabStatus } from '@/types';
import type { Translations } from '@/lib/i18n';
import { getVocabulary, unsaveWord, updateVocabEntry, watchVocabulary } from '@/lib/vocabulary/client';
import { savedEntries } from '@/lib/vocabulary/model';
import { VOCAB_STATUSES } from '@/lib/vocabulary/browse';

/** UI pieces of the vocabulary notebook shared by the popup and the options page (US-07). */

/**
 * Saved words, kept up to date with storage. Status changes and removals are shown at
 * once and reverted (by re-reading storage) if the background rejects them.
 */
export function useSavedVocabulary() {
  const [entries, setEntries] = useState<VocabEntry[] | null>(null);
  const version = useRef(0);

  const reload = useCallback(() => {
    const call = ++version.current;
    void getVocabulary()
      .then((state) => call === version.current && setEntries(savedEntries(state)))
      .catch(() => call === version.current && setEntries((list) => list ?? []));
  }, []);

  useEffect(() => {
    reload();
    const unwatch = watchVocabulary((state) => {
      ++version.current; // a pending initial read is now older than this one
      setEntries(savedEntries(state));
    });
    return unwatch;
  }, [reload]);

  const setStatus = useCallback(
    (id: string, status: VocabStatus) => {
      setEntries((list) => list?.map((e) => (e.id === id ? { ...e, status } : e)) ?? null);
      updateVocabEntry(id, { status }).catch(reload);
    },
    [reload]
  );

  const remove = useCallback(
    (id: string) => {
      setEntries((list) => list?.filter((e) => e.id !== id) ?? null);
      unsaveWord(id).catch(reload);
    },
    [reload]
  );

  return { entries, setStatus, remove };
}

export function statusLabel(t: Translations, status: VocabStatus): string {
  return { new: t.vocabStatusNew, learning: t.vocabStatusLearning, known: t.vocabStatusKnown }[status];
}

const STATUS_STYLE: Record<VocabStatus, string> = {
  new: 'bg-info text-french-bordeaux border-info-line',
  learning: 'bg-note text-french-ochre border-note-line',
  known: 'bg-ok text-emerald-800 border-ok-line',
};

export function StatusSelect({
  entry,
  t,
  onChange,
}: {
  entry: VocabEntry;
  t: Translations;
  onChange: (status: VocabStatus) => void;
}) {
  return (
    <select
      value={entry.status}
      aria-label={`${t.vocabStatusLabel}: ${entry.lemma}`}
      title={t.vocabStatusLabel}
      onChange={(e) => onChange(e.target.value as VocabStatus)}
      onClick={(e) => e.stopPropagation()}
      className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-french-bordeaux/30 ${STATUS_STYLE[entry.status]}`}
    >
      {VOCAB_STATUSES.map((s) => (
        <option key={s} value={s}>
          {statusLabel(t, s)}
        </option>
      ))}
    </select>
  );
}

const NOTE_SAVE_DELAY = 700;

/**
 * Note of an entry, saved while typing (debounced), on blur and when unmounted, so
 * closing the popup does not lose it. Updates from elsewhere are applied unless the
 * user has unsaved changes.
 */
export function NoteField({ entry, t, rows = 2 }: { entry: VocabEntry; t: Translations; rows?: number }) {
  const [draft, setDraft] = useState(entry.note);
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle');
  const draftRef = useRef(draft);
  draftRef.current = draft;
  /** Value known to be stored. */
  const stored = useRef(entry.note);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (draftRef.current === stored.current) setDraft(entry.note);
    stored.current = entry.note;
  }, [entry.note]);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const value = draftRef.current;
    if (value === stored.current) return;
    const previous = stored.current;
    stored.current = value;
    updateVocabEntry(entry.id, { note: value }).then(
      () => setState('saved'),
      () => {
        stored.current = previous;
        setState('error');
      }
    );
  }, [entry.id]);

  // Unmount (row closed, tab switched) and page closing (popup dismissed) save the draft.
  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  useEffect(() => {
    if (state !== 'saved') return;
    const id = setTimeout(() => setState('idle'), 1500);
    return () => clearTimeout(id);
  }, [state]);

  return (
    <div className="relative">
      <textarea
        value={draft}
        rows={rows}
        aria-label={`${t.vocabNote}: ${entry.lemma}`}
        placeholder={t.vocabNotePlaceholder}
        onChange={(e) => {
          setDraft(e.target.value);
          setState('idle');
          clearTimeout(timer.current);
          timer.current = setTimeout(flush, NOTE_SAVE_DELAY);
        }}
        onBlur={flush}
        onClick={(e) => e.stopPropagation()}
        className="w-full resize-y rounded-md border border-stone-border bg-parchment-50 px-2 py-1.5 text-xs text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-french-bordeaux"
      />
      {state !== 'idle' && (
        <span
          role="status"
          className={`absolute right-2 bottom-2 text-[10px] ${state === 'saved' ? 'text-emerald-700' : 'text-french-bordeaux'}`}
        >
          {state === 'saved' ? t.vocabNoteSaved : t.vocabSaveFailed}
        </span>
      )}
    </div>
  );
}

/** Remove button asking for confirmation in place. */
export function RemoveButton({
  entry,
  t,
  onRemove,
  icon,
}: {
  entry: VocabEntry;
  t: Translations;
  onRemove: (id: string) => void;
  icon: React.ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setConfirming(true);
        }}
        title={t.vocabRemove}
        aria-label={`${t.vocabRemove}: ${entry.lemma}`}
        className="p-1 rounded-md text-ink-400 hover:text-french-bordeaux hover:bg-parchment-200 transition-colors"
      >
        {icon}
      </button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[11px]" onClick={(e) => e.stopPropagation()}>
      <span className="text-ink-600">{t.vocabConfirmRemove}</span>
      <button
        type="button"
        autoFocus
        onClick={() => onRemove(entry.id)}
        className="px-1.5 py-0.5 rounded bg-french-bordeaux text-white font-medium hover:bg-ink-900"
      >
        {t.remove}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="px-1.5 py-0.5 rounded text-ink-600 hover:bg-parchment-200"
      >
        {t.vocabCancel}
      </button>
    </span>
  );
}

/** "nom · m" style details line. */
export function grammarLine(entry: VocabEntry): string {
  const gender = entry.gender === 'mf' ? 'm/f' : entry.gender;
  return [entry.pos, gender].filter(Boolean).join(' · ');
}

/** The context sentence with the word met in bold. */
export function ContextSentence({ entry }: { entry: VocabEntry }) {
  const sentence = entry.contextSentence;
  if (!sentence) return null;
  const at = sentence.toLowerCase().indexOf(entry.word.toLowerCase());
  return (
    <q className="font-serif italic text-ink-700">
      {at < 0 ? (
        sentence
      ) : (
        <>
          {sentence.slice(0, at)}
          <b className="font-semibold not-italic text-ink-900">{sentence.slice(at, at + entry.word.length)}</b>
          {sentence.slice(at + entry.word.length)}
        </>
      )}
    </q>
  );
}

/** Link to the page where the word was met (title, or host name). */
export function SourceLink({ entry }: { entry: VocabEntry }) {
  if (!entry.sourceUrl || !/^https?:/i.test(entry.sourceUrl)) return null;
  let label = entry.sourceTitle;
  if (!label) {
    try {
      label = new URL(entry.sourceUrl).hostname;
    } catch {
      label = entry.sourceUrl;
    }
  }
  return (
    <a
      href={entry.sourceUrl}
      target="_blank"
      rel="noreferrer"
      title={entry.sourceUrl}
      onClick={(e) => e.stopPropagation()}
      className="text-[11px] text-french-bordeaux hover:underline truncate max-w-full inline-block align-bottom"
    >
      {label}
    </a>
  );
}

const DATE_LOCALES: Record<UILanguage, string> = { vi: 'vi-VN', en: 'en-GB', fr: 'fr-FR' };

export function formatDate(ts: number, lang: UILanguage): string {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(DATE_LOCALES[lang] ?? undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
