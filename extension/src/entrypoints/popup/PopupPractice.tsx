import { useEffect, useMemo, useState } from 'react';
import { Check, CircleAlert, PenLine, X } from 'lucide-react';
import type { UILanguage } from '@/types';
import type { Translations } from '@/lib/i18n';
import { formatDate } from '@/components/vocab';
import { historyRules, parseHistory, PRACTICE_HISTORY_KEY, type PracticeAttempt } from '@/lib/grammar/practice';

const FILTER_KEY = 'tc-practice-filter';

function readFilter(): string {
  try {
    return localStorage.getItem(FILTER_KEY) ?? '';
  } catch {
    return '';
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** US-19: "Practice history" tab of the popup: sentences written on grammar cards, newest first. */
export function PopupPractice({ t, lang }: { t: Translations; lang: UILanguage }) {
  const [history, setHistory] = useState<PracticeAttempt[] | null>(null);
  const [filter, setFilter] = useState(readFilter);

  useEffect(() => {
    void browser.storage.local.get(PRACTICE_HISTORY_KEY).then((v) => setHistory(parseHistory(v[PRACTICE_HISTORY_KEY])));
    const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && changes[PRACTICE_HISTORY_KEY]) setHistory(parseHistory(changes[PRACTICE_HISTORY_KEY].newValue));
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  const rules = useMemo(() => historyRules(history ?? []), [history]);
  // A filter on a structure no longer in the history shows everything.
  const active = rules.some((r) => r.id === filter) ? filter : '';
  const shown = (history ?? []).filter((a) => !active || a.ruleId === active);

  function choose(value: string) {
    setFilter(value);
    try {
      localStorage.setItem(FILTER_KEY, value);
    } catch {
      // per-viewer convenience only
    }
  }

  async function clear() {
    if (!window.confirm(t.historyClearConfirm)) return;
    await browser.storage.local.remove(PRACTICE_HISTORY_KEY);
  }

  if (history === null) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin w-5 h-5 border-2 border-french-bordeaux border-t-transparent rounded-full" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="px-5 py-8 text-center" data-testid="popup-practice">
        <PenLine className="w-7 h-7 text-ink-300 mx-auto mb-2" aria-hidden="true" />
        <p className="text-xs font-medium text-ink-600">{t.historyTitle}</p>
        <p className="text-[11px] text-ink-500 mt-1 leading-relaxed">{t.historyEmpty}</p>
      </div>
    );
  }

  return (
    <div className="select-text" data-testid="popup-practice">
      <div className="p-3 pb-2 flex items-center gap-2">
        <h2 className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">{t.historyTitle}</h2>
        <select
          value={active}
          onChange={(e) => choose(e.target.value)}
          aria-label={t.historyAllRules}
          className="max-w-[60%] bg-parchment-50 border border-stone-border rounded-md px-1.5 py-1 text-[11px] text-ink-800 focus:outline-none focus:border-french-bordeaux"
        >
          <option value="">
            {t.historyAllRules} ({history.length})
          </option>
          {rules.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.count})
            </option>
          ))}
        </select>
      </div>

      <ul className="max-h-[380px] overflow-y-auto border-t border-stone-border divide-y divide-stone-border">
        {shown.map((a) => {
          const verdict = a.isCorrect ? t.historyUsed : a.usesConstruct ? t.historyWithErrors : t.historyNotUsed;
          const Icon = a.isCorrect ? Check : a.usesConstruct ? CircleAlert : X;
          return (
            <li key={a.id} className="px-3 py-2 text-[11px]">
              <div className="flex items-start gap-1.5">
                <Icon
                  aria-hidden="true"
                  className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${a.isCorrect ? 'text-emerald-700' : 'text-ink-500'}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-ink-900 leading-snug">{a.sentence}</div>
                  {a.corrected && <div className="text-ink-600 mt-0.5">→ {a.corrected}</div>}
                  <div className="text-ink-500 mt-0.5">
                    {verdict} · {a.ruleName}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-ink-400 mt-0.5">
                    {a.sourceUrl ? (
                      <a
                        href={a.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate hover:text-ink-700 hover:underline"
                        title={a.sourceUrl}
                      >
                        {t.historyFrom}: {a.sourceTitle || hostOf(a.sourceUrl)}
                      </a>
                    ) : (
                      <span />
                    )}
                    <span className="flex-shrink-0">{formatDate(a.createdAt, lang)}</span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => void clear()}
        className="w-full border-t border-stone-border bg-parchment-100 px-3 py-2 text-xs text-ink-600 hover:bg-parchment-200 text-left"
      >
        {t.historyClear}
      </button>
    </div>
  );
}
