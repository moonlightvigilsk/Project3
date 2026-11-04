/**
 * Reader-style preview of a grammar card's source page (US-15, right card of
 * docs/design/grammar-card-source-preview.png).
 *
 * Most study sites forbid being framed (X-Frame-Options / frame-ancestors), so instead of an
 * iframe the side panel fetches the page and keeps only its readable text: headings,
 * paragraphs, list items. The result is plain data rendered as React text — no page HTML,
 * script or style ever reaches the extension.
 */
import { isTrustedSourceUrl } from './prompts';

export type PreviewBlockKind = 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'quote';

/** A run of text; `strong` keeps the page's bold, which these sites use for the key forms. */
export interface PreviewSpan {
  text: string;
  strong?: boolean;
}

export interface PreviewBlock {
  kind: PreviewBlockKind;
  spans: PreviewSpan[];
}

export interface SourcePreview {
  url: string;
  title: string;
  blocks: PreviewBlock[];
  /** True when the page had more text than the preview keeps. */
  truncated: boolean;
}

export const PREVIEW_MAX_BLOCKS = 80;
export const PREVIEW_MAX_CHARS = 12000;
const FETCH_TIMEOUT_MS = 10000;
const MAX_BYTES = 3 * 1024 * 1024;

/** Elements that never hold the article text. */
const SKIP_SELECTOR = [
  'script', 'style', 'noscript', 'template', 'svg', 'canvas', 'iframe', 'object', 'embed',
  'form', 'button', 'input', 'select', 'textarea', 'nav', 'header', 'footer', 'aside',
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]', '[role="complementary"]',
  '[aria-hidden="true"]', '[hidden]',
  '.nav', '.navbar', '.menu', '.sidebar', '.breadcrumb', '.breadcrumbs', '.share', '.social',
  '.comments', '#comments', '.advert', '.ads', '.cookie', '.newsletter',
].join(',');

/** Main content containers, most specific first. */
const MAIN_SELECTORS = [
  'article', 'main', '[role="main"]', '#mw-content-text', '.mw-parser-output',
  '.entry-content', '.post-content', '.article-content', '#content', '.content',
];

const BLOCK_TAGS: Record<string, PreviewBlockKind> = {
  H1: 'h1', H2: 'h2', H3: 'h3', H4: 'h3', H5: 'h3', H6: 'h3',
  P: 'p', LI: 'li', DT: 'p', DD: 'p', BLOCKQUOTE: 'quote', PRE: 'p', FIGCAPTION: 'p', TD: 'p', TH: 'p',
};

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ');
}

function pickRoot(doc: Document): Element | null {
  for (const selector of MAIN_SELECTORS) {
    const candidates = [...doc.querySelectorAll(selector)];
    // The container with the most text wins (pages may have several <article> teasers).
    let best: Element | null = null;
    let bestLength = 0;
    for (const c of candidates) {
      const length = (c.textContent ?? '').trim().length;
      if (length > bestLength) {
        best = c;
        bestLength = length;
      }
    }
    if (best && bestLength >= 200) return best;
  }
  return doc.body;
}

/** Inline spans of a block, without descending into nested blocks (they become blocks of their own). */
function spansOf(el: Element): PreviewSpan[] {
  const spans: PreviewSpan[] = [];
  const push = (raw: string, strong: boolean) => {
    const last = spans[spans.length - 1];
    // No double space across text nodes ("visiter <br> Hanoi").
    const text = last && /\s$/.test(last.text) ? raw.replace(/^\s+/, '') : raw;
    if (!text) return;
    if (last && !!last.strong === strong) last.text += text;
    else spans.push(strong ? { text, strong: true } : { text });
  };
  const walk = (node: Node, strong: boolean) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        push(collapse(child.nodeValue ?? ''), strong);
      } else if (child.nodeType === 1) {
        const tag = (child as Element).tagName;
        if (BLOCK_TAGS[tag] || tag === 'UL' || tag === 'OL' || tag === 'TABLE') continue;
        if (tag === 'BR') {
          push(' ', strong);
          continue;
        }
        walk(child, strong || tag === 'B' || tag === 'STRONG');
      }
    }
  };
  walk(el, false);
  // Trim the ends of the block.
  if (spans.length) {
    spans[0].text = spans[0].text.replace(/^\s+/, '');
    const last = spans[spans.length - 1];
    last.text = last.text.replace(/\s+$/, '');
  }
  return spans.filter((s) => s.text.length > 0);
}

/** Extracts the readable text of a parsed page. Pure: works on any Document (tested with linkedom). */
export function extractPreview(doc: Document, url: string): SourcePreview {
  const title = collapse(doc.querySelector('title')?.textContent ?? '').trim() || url;
  const root = pickRoot(doc);
  const blocks: PreviewBlock[] = [];
  let chars = 0;
  let truncated = false;
  if (root) {
    root.querySelectorAll(SKIP_SELECTOR).forEach((el) => el.remove());
    const elements = root.querySelectorAll(Object.keys(BLOCK_TAGS).join(','));
    for (const el of elements) {
      const kind = BLOCK_TAGS[el.tagName];
      if (!kind) continue;
      const spans = spansOf(el);
      const length = spans.reduce((n, s) => n + s.text.length, 0);
      // Skip empty blocks and one-character leftovers (icons, separators).
      if (length < 2) continue;
      if (blocks.length >= PREVIEW_MAX_BLOCKS || chars + length > PREVIEW_MAX_CHARS) {
        truncated = true;
        break;
      }
      blocks.push({ kind, spans });
      chars += length;
    }
  }
  return { url, title, blocks, truncated };
}

/** Charset from the Content-Type header or a <meta> in the first bytes; UTF-8 otherwise. */
export function detectCharset(contentType: string | null, head: string): string {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  const fromMeta = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  const charset = (fromHeader || fromMeta || 'utf-8').toLowerCase();
  try {
    new TextDecoder(charset);
    return charset;
  } catch {
    return 'utf-8';
  }
}

export class PreviewError extends Error {}

const cache = new Map<string, Promise<SourcePreview>>();

/**
 * Downloads and extracts a source page. Only trusted study sites are fetched (the same list
 * the grammar card accepts), without cookies. Results are kept for the life of the panel.
 */
export function loadSourcePreview(url: string): Promise<SourcePreview> {
  if (!isTrustedSourceUrl(url)) return Promise.reject(new PreviewError('untrusted'));
  const cached = cache.get(url);
  if (cached) return cached;
  const promise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { credentials: 'omit', signal: controller.signal, redirect: 'follow' });
      if (!response.ok) throw new PreviewError(`HTTP ${response.status}`);
      const type = response.headers.get('content-type');
      if (type && !/html|xml/i.test(type)) throw new PreviewError('not html');
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_BYTES) throw new PreviewError('too large');
      const head = new TextDecoder('latin1').decode(buffer.slice(0, 2048));
      const html = new TextDecoder(detectCharset(type, head)).decode(buffer);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return extractPreview(doc, response.url || url);
    } finally {
      clearTimeout(timer);
    }
  })();
  cache.set(url, promise);
  promise.catch(() => cache.delete(url));
  return promise;
}
