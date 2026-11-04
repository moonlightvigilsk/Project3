import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search, Trash2 } from 'lucide-react';
import type { UILanguage } from '@/types';
import type { Translations } from '@/lib/i18n';
import {
  VOCAB_STATUSES,
  browseVocabulary,
  countByStatus,
  isVocabSort,
  type StatusFilter,
  type VocabSort,
} from '@/lib/vocabulary/browse';
import {
  ContextSentence,
  NoteField,
  RemoveButton,
  SourceLink,
  StatusSelect,
  formatDate,
  grammarLine,
  statusLabel,
  useSavedVocabulary,
} from '@/components/vocab';
import { VocabTransfer } from './VocabTransfer';

const PAGE_SIZE = 50;
const SORT_KEY = 'tc-vocab-sort';

function readSort(): VocabSort {
  try {
    const value = localStorage.getItem(SORT_KEY);
    return isVocabSort(value) ? value : 'recent';
  } catch {
    return 'recent';
  }
}

/** US-07: full notebook in the options page: search, status filter, sort, edit, remove. */
export function VocabularyTab({ t, lang }: { t: Translations; lang: UILanguage }) {
  const { entries, setStatus, remove } = useSavedVocabulary();
  const [query, setQuery] = useState('');
  const [status, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<VocabSort>(readSort);
  const [limit, setLimit] = useState(PAGE_SIZE);

  useEffect(() => setLimit(PAGE_SIZE), [query, status, sort]);

  const counts = useMemo(() => countByStatus(entries ?? []), [entries]);
  const rows = useMemo(() => browseVocabulary(entries ?? [], { query, status, sort }), [entries, query, status, sort]);
  const shown = rows.slice(0, limit);

  function changeSort(next: VocabSort) {
    setSort(next);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      // not remembered
    }
  }

  const filters: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: t.vocabFilterAll },
    ...VOCAB_STATUSES.map((s) => ({ id: s as StatusFilter, label: statusLabel(t, s) })),
  ];

  return (
    <div className="space-y-5" data-testid="vocab-tab">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-serif font-bold text-base text-ink-900 mb-1">{t.vocabTitle}</h3>
          <p className="text-xs text-ink-600 leading-relaxed">{t.vocabDesc}</p>
        </div>
      </div>

      {entries !== null && (
        <VocabTransfer entries={rows} filtered={status !== 'all' || query.trim() !== ''} t={t} />
      )}

      {entries === null ? (
        <div className="py-12 flex justify-center">
          <div className="animate-spin w-5 h-5 border-2 border-french-bordeaux border-t-transparent rounded-full" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-stone-border rounded-xl">
          <BookOpen className="w-8 h-8 text-ink-300 mx-auto mb-2" />
          <p className="text-xs font-medium text-ink-500">{t.vocabEmpty}</p>
          <p className="text-[11px] text-ink-400 mt-1">{t.vocabEmptyDesc}</p>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <label className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.vocabSearchPlaceholder}
                aria-label={t.vocabSearchPlaceholder}
                className="w-full pl-9 pr-3 py-2 bg-parchment-100 border border-stone-border rounded-lg text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-french-bordeaux"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <div role="group" aria-label={t.vocabStatusLabel} className="flex flex-wrap gap-1">
                {filters.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={status === f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      status === f.id
                        ? 'bg-ink-900 text-parchment-50'
                        : 'bg-parchment-100 border border-stone-border text-ink-700 hover:bg-parchment-200'
                    }`}
                  >
                    {f.label} <span className="font-mono opacity-70">{counts[f.id]}</span>
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1.5 text-xs text-ink-600">
                {t.vocabSortLabel}
                <select
                  value={sort}
                  onChange={(e) => changeSort(e.target.value as VocabSort)}
                  className="px-2 py-1.5 bg-parchment-100 border border-stone-border rounded-lg text-xs text-ink-900 focus:outline-none focus:border-french-bordeaux"
                >
                  <option value="recent">{t.vocabSortRecent}</option>
                  <option value="alpha">{t.vocabSortAlpha}</option>
                  <option value="status">{t.vocabSortStatus}</option>
                </select>
              </label>
            </div>
          </div>

          <div className="text-[11px] text-ink-500" role="status">
            {t.vocabMatches(shown.length, rows.length)}
          </div>

          {rows.length === 0 ? (
            <p className="text-center py-10 text-xs text-ink-500 border border-dashed border-stone-border rounded-xl">
              {t.vocabNoMatch}
            </p>
          ) : (
            <div className="border border-stone-border rounded-xl overflow-hidden">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-parchment-100 text-[11px] uppercase tracking-wider text-ink-600">
                  <tr>
                    <th scope="col" className="w-[20%] px-4 py-2.5 font-semibold">{t.vocabColWord}</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">{t.vocabColMeaning}</th>
                    <th scope="col" className="w-[24%] px-4 py-2.5 font-semibold">{t.vocabNote}</th>
                    <th scope="col" className="w-[150px] px-4 py-2.5 font-semibold">{t.vocabStatusLabel}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-border bg-parchment-50">
                  {shown.map((entry) => {
                    const grammar = grammarLine(entry);
                    return (
                      <tr key={entry.id} data-vocab-id={entry.id} className="align-top">
                        <td className="px-4 py-3">
                          <div className="font-serif font-bold text-sm text-ink-900 break-words">{entry.lemma}</div>
                          {entry.word !== entry.lemma && <div className="italic text-ink-600">{entry.word}</div>}
                          {entry.ipa && <div className="font-mono text-[11px] text-ink-500">/{entry.ipa}/</div>}
                          {grammar && <div className="text-[11px] text-ink-500">{grammar}</div>}
                        </td>
                        <td className="px-4 py-3 space-y-1.5">
                          {entry.definitions.length > 0 && (
                            <ol className="list-decimal pl-4 space-y-0.5 text-ink-800">
                              {entry.definitions.map((d, i) => (
                                <li key={i}>{d}</li>
                              ))}
                            </ol>
                          )}
                          {entry.contextSentence && (
                            <div className="leading-relaxed">
                              <ContextSentence entry={entry} />
                            </div>
                          )}
                          <SourceLink entry={entry} />
                        </td>
                        <td className="px-4 py-3">
                          <NoteField entry={entry} t={t} />
                        </td>
                        <td className="px-4 py-3 space-y-2">
                          <StatusSelect entry={entry} t={t} onChange={(s) => setStatus(entry.id, s)} />
                          <div className="text-[11px] text-ink-500" title={t.vocabColAdded}>
                            {formatDate(entry.createdAt, lang)}
                          </div>
                          <RemoveButton entry={entry} t={t} onRemove={remove} icon={<Trash2 className="w-4 h-4" />} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {shown.length < rows.length && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setLimit((n) => n + PAGE_SIZE)}
                className="px-4 py-2 rounded-lg border border-stone-border bg-parchment-100 text-xs font-medium text-ink-800 hover:bg-parchment-200"
              >
                {t.vocabShowMore}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
