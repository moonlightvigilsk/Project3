import { useEffect, useState } from 'react';
import { ExternalLink, Star, X } from 'lucide-react';
import type { Translations } from '@/lib/i18n';
import { loadSourcePreview, type PreviewBlock, type SourcePreview } from '@/lib/chat/source-preview';

interface Props {
  url: string;
  t: Translations;
  saved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
}

type State = { status: 'loading' } | { status: 'ok'; preview: SourcePreview } | { status: 'error' };

function Block({ block }: { block: PreviewBlock }) {
  const content = block.spans.map((s, i) => (s.strong ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>));
  switch (block.kind) {
    case 'h1':
      return <h1 className="mt-3 text-[17px] font-bold leading-tight text-ink-900">{content}</h1>;
    case 'h2':
      return <h2 className="mt-3 text-[14.5px] font-bold leading-snug text-ink-900">{content}</h2>;
    case 'h3':
      return <h3 className="mt-2.5 text-[13px] font-semibold leading-snug text-ink-900">{content}</h3>;
    case 'li':
      return (
        <p className="mt-0.5 pl-3.5 -indent-2.5">
          <span aria-hidden="true">•&nbsp;</span>
          {content}
        </p>
      );
    case 'quote':
      return <blockquote className="mt-1.5 border-l-2 border-stone-border pl-2 text-ink-600">{content}</blockquote>;
    default:
      return <p className="mt-1.5">{content}</p>;
  }
}

/**
 * Preview of the grammar card's source page (docs/design/grammar-card-source-preview.png,
 * right card): a "☆ url" bar and the page's readable text. Sites forbid framing, so the text
 * is fetched and rebuilt here (see `src/lib/chat/source-preview.ts`).
 */
export function SourcePreviewView({ url, t, saved, onToggleSave, onClose }: Props) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    loadSourcePreview(url).then(
      (preview) => alive && setState({ status: 'ok', preview }),
      () => alive && setState({ status: 'error' })
    );
    return () => {
      alive = false;
    };
  }, [url]);

  const shortUrl = url.replace(/^https?:\/\/(www\.)?/, '');
  const saveLabel = saved ? t.bookmarkRemove : t.bookmarkAdd;

  return (
    <section
      aria-label={t.sourcePreviewTitle}
      className="rounded-2xl border border-stone-border bg-white p-3 pb-4 shadow-sm"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex h-[30px] items-center gap-1 rounded-full bg-parchment-200 px-1">
        <button
          type="button"
          onClick={onToggleSave}
          aria-pressed={saved}
          aria-label={saveLabel}
          title={saveLabel}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-parchment-300 focus-visible:outline-2 focus-visible:outline-accent ${
            saved ? 'text-star' : 'text-ink-500 hover:text-ink-900'
          }`}
        >
          <Star className="h-3.5 w-3.5" fill={saved ? 'currentColor' : 'none'} />
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={t.openSource}
          className="min-w-0 flex-1 truncate text-center text-xs text-ink-700 hover:text-ink-900 hover:underline"
        >
          {shortUrl}
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.sourcePreviewHide}
          title={t.sourcePreviewHide}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-parchment-300 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-h-[420px] overflow-y-auto overscroll-contain px-1.5 pt-1 text-[12.5px] leading-relaxed text-ink-800">
        {state.status === 'loading' && <p className="py-4 text-ink-500">{t.sourcePreviewLoading}</p>}
        {state.status === 'error' && (
          <p className="py-4 text-ink-500">
            {t.sourcePreviewFailed}{' '}
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-accent hover:underline">
              {t.openSource}
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        )}
        {state.status === 'ok' && (
          <>
            {state.preview.blocks.length === 0 ? (
              <p className="py-4 text-ink-500">{t.sourcePreviewEmpty}</p>
            ) : (
              <div>
                {state.preview.blocks.map((b, i) => (
                  <Block key={i} block={b} />
                ))}
              </div>
            )}
            {state.preview.truncated && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline"
              >
                {t.sourcePreviewMore}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </>
        )}
      </div>
    </section>
  );
}
