import type { GrammarSpan } from './types';

/**
 * Soft highlight of the words of a grammar structure in the page (US-17), with the CSS
 * Custom Highlight API: the page DOM is not modified. Does nothing on browsers without it.
 */
const HIGHLIGHT_NAME = 'tc-grammar';
const STYLE_ID = 'tc-grammar-style';

/** Characters of a range as normalized text (whitespace collapsed, trimmed) with their DOM place. */
export interface RangeTextMap {
  text: string;
  positions: { node: Text; offset: number }[];
}

const SKIPPED = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

/**
 * Text of the text nodes inside `range`, normalized like the analyzed sentence, so a span
 * [start, end) of the sentence maps back to page positions.
 */
export function rangeTextMap(range: Range): RangeTextMap {
  const root = range.commonAncestorContainer;
  const positions: RangeTextMap['positions'] = [];
  let text = '';
  const visit = (node: Text) => {
    if (!range.intersectsNode(node)) return;
    const from = node === range.startContainer ? range.startOffset : 0;
    const to = node === range.endContainer ? range.endOffset : node.length;
    for (let i = from; i < to; i++) {
      const ch = node.data[i];
      if (/[\s  ]/.test(ch)) {
        if (text && !text.endsWith(' ')) {
          text += ' ';
          positions.push({ node, offset: i });
        }
      } else {
        text += ch;
        positions.push({ node, offset: i });
      }
    }
  };
  if (root.nodeType === Node.TEXT_NODE) {
    visit(root as Text);
  } else {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n instanceof Element && SKIPPED.has(n.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === Node.TEXT_NODE) visit(n as Text);
    }
  }
  if (text.endsWith(' ')) {
    text = text.slice(0, -1);
    positions.pop();
  }
  return { text, positions };
}

/** Page ranges of the spans; empty when the range's text is not the analyzed sentence. */
export function spanRanges(range: Range, sentence: string, spans: GrammarSpan[]): Range[] {
  const map = rangeTextMap(range);
  if (map.text !== sentence) return [];
  const out: Range[] = [];
  for (const span of spans) {
    const first = map.positions[span.start];
    const last = map.positions[span.end - 1];
    if (!first || !last || span.end <= span.start) continue;
    const r = document.createRange();
    r.setStart(first.node, first.offset);
    r.setEnd(last.node, last.offset + 1);
    out.push(r);
  }
  return out;
}

function supported(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `::highlight(${HIGHLIGHT_NAME}) { background-color: rgba(52, 96, 200, 0.18); text-decoration: underline; text-decoration-color: rgba(52, 96, 200, 0.7); text-underline-offset: 3px; }`;
  (document.head ?? document.documentElement).appendChild(style);
}

/** Highlights `ranges` (replacing the previous ones). Returns false when not supported. */
export function highlightGrammar(ranges: Range[]): boolean {
  if (!supported()) return false;
  if (ranges.length === 0) {
    CSS.highlights.delete(HIGHLIGHT_NAME);
    return true;
  }
  ensureStyle();
  CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
  return true;
}

export function clearGrammarHighlight() {
  if (supported()) CSS.highlights.delete(HIGHLIGHT_NAME);
}
