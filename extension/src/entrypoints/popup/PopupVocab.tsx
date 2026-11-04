import { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, Search, Trash2 } from 'lucide-react';
import type { UILanguage } from '@/types';
import type { Translations } from '@/lib/i18n';
import { browseVocabulary } from '@/lib/vocabulary/browse';
import {
  ContextSentence,
  NoteField,
  RemoveButton,
  SourceLink,
  StatusSelect,
  formatDate,
  grammarLine,
  useSavedVocabulary,
} from '@/components/vocab';

/** Words listed in the popup; the options page has the full notebook. */
export const POPUP_VOCAB_LIMIT = 10;

/** US-07: "Vocabulary" tab of the popup: the 10 most recent words, or search results. */
export function PopupVocab({ t, lang }: { t: Translations; lang: UILanguage }) {
  const { entries, setStatus, remove } = useSavedVocabulary();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const matches = useMemo(() => browseVocabulary(entries ?? [], { query, sort: 'recent' }), [entries, query]);
  const shown = matches.slice(0, POPUP_VOCAB_LIMIT);
  const total = entries?.length ?? 0;

  function openNotebook() {
    void browser.tabs.create({ url: browser.runtime.getURL('/options.html#vocabulary') });
    window.close();
  }

  if (entries === null) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin w-5 h-5 border-2 border-french-bordeaux border-t-transparent rounded-full" />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <BookOpen className="w-7 h-7 text-ink-300 mx-auto mb-2" />
        <p className="text-xs font-medium text-ink-600">{t.vocabEmpty}</p>
        <p className="text-[11px] text-ink-500 mt-1 leading-relaxed">{t.vocabEmptyDesc}</p>
      </div>
    );
  }

  return (
    <div className="select-text" data-testid="popup-vocab">
      <div className="p-3 pb-2">
        <label className="relative block">
          <Search className="w-3.5 h-3.5 text-ink-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.vocabSearchPlaceholder}
            aria-label={t.vocabSearchPlaceholder}
            className="w-full pl-8 pr-2 py-1.5 bg-parchment-50 border border-stone-border rounded-lg text-xs text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-french-bordeaux"
          />
        </label>
        <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500" role="status">
          {query.trim() ? t.vocabMatches(shown.length, matches.length) : t.vocabRecentTitle}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="px-3 pb-4 text-xs text-ink-500">{t.vocabNoMatch}</p>
      ) : (
        <ul className="max-h-[360px] overflow-y-auto border-t border-stone-border divide-y divide-stone-border">
          {shown.map((entry) => {
            const expanded = open === entry.id;
            const grammar = grammarLine(entry);
            return (
              <li key={entry.id} className={expanded ? 'bg-parchment-100/60' : ''}>
                <div className="flex items-start gap-2 px-3 py-2">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : entry.id)}
                    className="flex-1 min-w-0 text-left group"
                  >
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="font-serif font-bold text-sm text-ink-900 truncate">{entry.lemma}</span>
                      {entry.ipa && <span className="font-mono text-[10px] text-ink-500 truncate">/{entry.ipa}/</span>}
                      <ChevronDown
                        className={`w-3 h-3 text-ink-400 flex-shrink-0 self-center transition-transform ${expanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                    {!expanded && entry.definitions[0] && (
                      <div className="text-[11px] text-ink-600 truncate">{entry.definitions[0]}</div>
                    )}
                  </button>
                  <StatusSelect entry={entry} t={t} onChange={(s) => setStatus(entry.id, s)} />
                </div>

                {expanded && (
                  <div className="px-3 pb-3 space-y-2 text-[11px]">
                    {(grammar || entry.word !== entry.lemma) && (
                      <div className="text-ink-500">
                        {grammar}
                        {entry.word !== entry.lemma && (
                          <span>
                            {grammar ? ' · ' : ''}
                            <i>{entry.word}</i>
                          </span>
                        )}
                      </div>
                    )}
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
                    <div className="flex items-center justify-between gap-2 text-ink-500">
                      <SourceLink entry={entry} />
                      <span className="flex-shrink-0">{formatDate(entry.createdAt, lang)}</span>
                    </div>
                    <NoteField entry={entry} t={t} />
                    <div className="flex justify-end">
                      <RemoveButton entry={entry} t={t} onRemove={remove} icon={<Trash2 className="w-3.5 h-3.5" />} />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={openNotebook}
        className="w-full border-t border-stone-border bg-parchment-100 px-3 py-2 text-xs font-medium text-french-bordeaux hover:bg-parchment-200 text-left"
      >
        {t.vocabOpenAll(total)} &rarr;
      </button>
    </div>
  );
}
