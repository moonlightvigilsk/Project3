import { useState } from 'react';
import { Eye, EyeOff, Star } from 'lucide-react';
import { isTrustedSourceUrl } from '@/lib/chat/prompts';
import { SourcePreviewView } from './SourcePreviewView';
import type { Translations } from '@/lib/i18n';
import type { GrammarCard } from '@/lib/chat/types';

interface Props {
  card: GrammarCard;
  t: Translations;
  saved: boolean;
  sourceSaved: boolean;
  onToggleSave: () => void;
  onToggleSourceSave: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3">
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">{title}</h4>
      <div className="mt-0.5 text-[13px] leading-snug text-ink-900">{children}</div>
    </section>
  );
}

function StarButton({ pressed, onClick, t }: { pressed: boolean; onClick: () => void; t: Translations }) {
  const label = pressed ? t.bookmarkRemove : t.bookmarkAdd;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-parchment-300 focus-visible:outline-2 focus-visible:outline-accent ${
        pressed ? 'text-star' : 'text-ink-500 hover:text-ink-900'
      }`}
    >
      <Star className="h-3.5 w-3.5" fill={pressed ? 'currentColor' : 'none'} />
    </button>
  );
}

/** Grammar sheet (docs/design/grammar-card-source-preview.png): the card, and on demand the source preview. */
export function GrammarCardView({ card, t, saved, sourceSaved, onToggleSave, onToggleSourceSave }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const canPreview = !!card.source && isTrustedSourceUrl(card.source.url);
  const previewLabel = previewOpen ? t.sourcePreviewHide : t.sourcePreviewShow;
  return (
    <div className="flex flex-col gap-2">
      <article className="rounded-2xl border border-stone-border bg-white p-3 pb-4 shadow-sm">
        <div className="flex h-[30px] items-center gap-1 rounded-full bg-parchment-200 px-1">
          <StarButton pressed={saved} onClick={onToggleSave} t={t} />
          <span className="min-w-0 flex-1 truncate pr-7 text-center text-xs text-ink-700">grammar/{card.id}</span>
        </div>
  
        <div className="px-1.5">
          <h3 className="mt-4 text-xl font-bold leading-tight text-ink-900">{card.title}</h3>
          {card.form && (
            <p className="mt-0.5 text-[13px] text-ink-500">
              {t.cardForm}: {card.form}
            </p>
          )}
  
          {card.patterns.length > 0 && (
            <Section title={t.cardPatterns}>
              {card.patterns.map((p) => (
                <div key={p}>{p}</div>
              ))}
            </Section>
          )}
  
          {card.uses.length > 0 && (
            <Section title={t.cardUses}>
              <ul className="list-disc pl-4">
                {card.uses.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </Section>
          )}
  
          {card.examples.length > 0 && (
            <Section title={t.cardExamples}>
              {card.examples.map((x) => (
                <div key={x}>{x}</div>
              ))}
            </Section>
          )}
  
          {card.source && (
            <Section title={t.cardSource}>
              <div className="flex items-center gap-1">
                <a
                  href={card.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t.openSource}
                  className="min-w-0 flex-1 truncate text-xs text-ink-500 hover:text-ink-900 hover:underline"
                >
                  {card.source.url.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
                {canPreview && (
                  <button
                    type="button"
                    onClick={() => setPreviewOpen((o) => !o)}
                    aria-pressed={previewOpen}
                    aria-label={previewLabel}
                    title={previewLabel}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-parchment-300 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {previewOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                )}
                <StarButton pressed={sourceSaved} onClick={onToggleSourceSave} t={t} />
              </div>
            </Section>
          )}
        </div>
      </article>
      {previewOpen && card.source && (
        <SourcePreviewView
          url={card.source.url}
          t={t}
          saved={sourceSaved}
          onToggleSave={onToggleSourceSave}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
