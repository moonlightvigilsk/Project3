import { getTextareaCharacterRects } from '@/lib/text-rects';

/** Maximum number of words a selection may contain to be offered for lookup. */
export const MAX_LOOKUP_WORDS = 5;
/** Hard cap on characters, so a long "word" (URL, hash...) is not offered. */
export const MAX_LOOKUP_CHARS = 60;

const TEXT_INPUT_TYPES = ['text', 'search', 'email', 'url', 'tel', ''];

export interface SelectionInfo {
  /** Trimmed selected text. */
  text: string;
  /** Viewport rect of the end of the selection, used to anchor the button/card. */
  rect: DOMRect;
  /** The input/textarea holding the selection, or null for page text / contenteditable. */
  field: HTMLInputElement | HTMLTextAreaElement | null;
  /** Sentence containing the selection (US-06), computed on first call. */
  context: () => string | null;
}

/** Longest context sentence kept; longer ones are cut around the selection. */
export const MAX_CONTEXT_CHARS = 300;

/** Abbreviations whose final dot does not end a sentence ("M. Dupont", "etc. et"). */
const ABBREVIATIONS = new Set([
  'm', 'mm', 'mme', 'mmes', 'mlle', 'mlles', 'dr', 'pr', 'me', 'st', 'ste', 'etc', 'cf', 'p', 'pp',
  'av', 'apr', 'env', 'ex', 'fig', 'n', 'no', 'vol', 'chap', 'éd', 'mr', 'mrs', 'ms', 'jr', 'vs',
]);

function endsSentence(text: string, i: number): boolean {
  const ch = text[i];
  if (ch === '\n') return true;
  if (!/[.!?…]/.test(ch)) return false;
  // Must be followed by space/end (closing quotes and brackets allowed in between).
  let j = i + 1;
  while (j < text.length && /[.!?…»"”’)\]]/.test(text[j])) j++;
  if (j < text.length && !/\s/.test(text[j])) return false; // "3.14", "fr.wiktionary"
  if (ch === '.') {
    const word = /([\p{L}]+)$/u.exec(text.slice(Math.max(0, i - 12), i))?.[1];
    if (word && (ABBREVIATIONS.has(word.toLowerCase()) || word.length === 1)) return false;
  }
  return true;
}

/**
 * Bounds [from, to) of the sentence of `text` containing [start, end) (start may equal
 * end: a caret). Bounded by . ! ? … (not abbreviations or decimals) or a line break; the
 * final punctuation and closing quotes are included.
 */
export function sentenceBounds(text: string, start: number, end: number): { from: number; to: number } {
  let from = start;
  while (from > 0 && !endsSentence(text, from - 1)) from--;
  // The previous sentence's closing quote (French style "là. »") is not part of this one.
  while (from < start && /[\s  »”"’)\]]/.test(text[from])) from++;
  let to = end;
  while (to < text.length && !endsSentence(text, to)) to++;
  // Keep the final punctuation and closing quotes, also after a French space ("là. »").
  while (to < text.length && /[.!?…»"”’)\]]/.test(text[to])) to++;
  const closing = /^[   ]*[»”"’)\]]+/.exec(text.slice(to));
  if (closing) to += closing[0].length;
  return { from, to };
}

/**
 * Sentence of `text` containing [start, end): bounded by . ! ? … (not abbreviations or
 * decimals) or a line break, whitespace collapsed, cut to MAX_CONTEXT_CHARS around the
 * selection. Null when there is no sentence beyond the selection itself.
 */
export function extractSentence(text: string, start: number, end: number): string | null {
  if (start < 0 || end > text.length || start >= end) return null;
  const { from, to } = sentenceBounds(text, start, end);

  const before = text.slice(from, start).replace(/\s+/g, ' ').trimStart();
  const selected = text.slice(start, end).replace(/\s+/g, ' ');
  const after = text.slice(end, to).replace(/\s+/g, ' ').trimEnd();
  let sentence = before + selected + after;
  if (sentence.trim() === selected.trim()) return null;
  if (sentence.length > MAX_CONTEXT_CHARS) {
    const room = Math.max(0, MAX_CONTEXT_CHARS - selected.length);
    const left = Math.min(before.length, Math.floor(room / 2));
    const right = Math.min(after.length, room - left);
    sentence =
      (left < before.length ? '…' : '') +
      before.slice(before.length - left) +
      selected +
      after.slice(0, right) +
      (right < after.length ? '…' : '');
  }
  return sentence.trim();
}

const BLOCK_DISPLAYS = /^(block|list-item|table-cell|table-caption|flex|grid|flow-root)$/;

/** Elements that start a new line inside a block (Range.toString() ignores them). */
const LINE_BREAK_TAGS = new Set([
  'BR', 'P', 'DIV', 'LI', 'TR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'DD', 'DT', 'HR',
]);
const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

/**
 * Text of `block` with "\n" for <br> and nested blocks (so lines of a poem or an address
 * stay separate sentences), and the offset of the range start in that text.
 */
export function blockTextWithOffset(block: Node, range: Range): { text: string; start: number } | null {
  let text = '';
  let start = -1;
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n instanceof Element && SKIPPED_TAGS.has(n.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  // A range starting on an element (not a text node) starts before its child at startOffset.
  const startChild =
    range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer.childNodes[range.startOffset] ?? null : null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n === startChild) start = text.length;
    if (n.nodeType === Node.TEXT_NODE) {
      if (n === range.startContainer) start = text.length + range.startOffset;
      text += (n as Text).data;
    } else if (LINE_BREAK_TAGS.has((n as Element).tagName) && text && !text.endsWith('\n')) {
      text += '\n';
      if (n === startChild) start = text.length;
    }
  }
  return start >= 0 ? { text, start } : null;
}

/** Sentence around a page range: the text of its nearest block element, split. */
function sentenceAroundRange(range: Range): string | null {
  const node: Node = range.startContainer;
  let block: Element | null = node instanceof Element ? node : node.parentElement;
  while (block && block !== document.body && !BLOCK_DISPLAYS.test(getComputedStyle(block).display)) {
    block = block.parentElement;
  }
  if (!block) return null;
  const located = blockTextWithOffset(block, range);
  if (!located) return null;
  return extractSentence(located.text, located.start, located.start + range.toString().length);
}

function once<T>(compute: () => T): () => T {
  let done = false;
  let value: T;
  return () => {
    if (!done) {
      value = compute();
      done = true;
    }
    return value;
  };
}

/**
 * Normalizes the raw selection and returns it if it is a plausible word or short
 * phrase to look up: 1..MAX_LOOKUP_WORDS words, a single line, at least one letter.
 */
export function toLookupText(raw: string): string | null {
  const text = raw.replace(/ /g, ' ').trim();
  if (!text || text.length > MAX_LOOKUP_CHARS) return null;
  if (/[\r\n]/.test(text)) return null;
  if (!/\p{L}/u.test(text)) return null;
  const words = text.split(/\s+/);
  if (words.length > MAX_LOOKUP_WORDS) return null;
  return text;
}

function isTextField(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && TEXT_INPUT_TYPES.includes(el.type.toLowerCase());
}

/** Follows focus into open shadow roots, so fields inside web components are found. */
function getDeepActiveElement(): Element | null {
  let el: Element | null = document.activeElement;
  while (el?.shadowRoot?.activeElement) {
    el = el.shadowRoot.activeElement;
  }
  return el;
}

function hasFieldSelection(field: HTMLInputElement | HTMLTextAreaElement): boolean {
  const { selectionStart: start, selectionEnd: end } = field;
  return start !== null && end !== null && start !== end;
}

function lastNonEmptyRect(rects: ArrayLike<DOMRect>): DOMRect | null {
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (r.width > 0 || r.height > 0) return r;
  }
  return null;
}

/** Reads the current selection (page text, contenteditable, or input/textarea). */
export function getSelectionInfo(): SelectionInfo | null {
  const active = getDeepActiveElement();

  // <input>/<textarea> selections are not exposed through window.getSelection().
  // A focused field without a selection of its own does not hide a selection made elsewhere.
  if (isTextField(active) && hasFieldSelection(active)) {
    const start = active.selectionStart!;
    const end = active.selectionEnd!;
    const text = toLookupText(active.value.substring(start, end));
    if (!text) return null;
    const rects = getTextareaCharacterRects(active, start, end);
    const rect = rects[rects.length - 1] ?? active.getBoundingClientRect();
    const value = active.value;
    return { text, rect, field: active, context: once(() => extractSentence(value, start, end)) };
  }

  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const text = toLookupText(sel.toString());
  if (!text) return null;
  const range = sel.getRangeAt(0);
  const rect = lastNonEmptyRect(range.getClientRects()) ?? range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  const saved = range.cloneRange();
  return {
    text,
    rect,
    field: null,
    context: once(() => {
      try {
        return sentenceAroundRange(saved);
      } catch {
        return null;
      }
    }),
  };
}

/** Longest selection offered to the chat panel ("Ask about this sentence"). */
export const MAX_SENTENCE_WORDS = 120;
export const MAX_SENTENCE_CHARS = 800;

export interface SentenceSelection {
  text: string;
  rect: DOMRect;
  /** Page range, used to highlight the sentence while it is discussed; null inside input/textarea. */
  range: Range | null;
}

/** Normalizes a selection too long for the word lookup but short enough to discuss. */
export function toSentenceText(raw: string): string | null {
  const text = raw.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text || text.length > MAX_SENTENCE_CHARS) return null;
  if (!/\p{L}/u.test(text)) return null;
  const words = text.split(' ').length;
  if (words <= MAX_LOOKUP_WORDS || words > MAX_SENTENCE_WORDS) return null;
  return text;
}

/** Reads the current selection when it is a sentence or short passage (more than MAX_LOOKUP_WORDS words). */
export function getSentenceSelection(): SentenceSelection | null {
  const active = getDeepActiveElement();
  if (isTextField(active) && hasFieldSelection(active)) {
    const start = active.selectionStart!;
    const end = active.selectionEnd!;
    const text = toSentenceText(active.value.substring(start, end));
    if (!text) return null;
    const rects = getTextareaCharacterRects(active, start, end);
    return { text, rect: rects[rects.length - 1] ?? active.getBoundingClientRect(), range: null };
  }

  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const text = toSentenceText(sel.toString());
  if (!text) return null;
  const range = sel.getRangeAt(0);
  const rect = lastNonEmptyRect(range.getClientRects()) ?? range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { text, rect, range: range.cloneRange() };
}

// --- sentence around the caret or a word (US-17) --------------------------------

interface BlockTextMap {
  text: string;
  /** Text nodes and the offset of their first character in `text`. */
  nodes: { node: Text; start: number }[];
}

/** Same text as `blockTextWithOffset`, with the place of every text node. */
function blockTextMap(block: Node): BlockTextMap {
  let text = '';
  const nodes: BlockTextMap['nodes'] = [];
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n instanceof Element && SKIPPED_TAGS.has(n.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      nodes.push({ node: n as Text, start: text.length });
      text += (n as Text).data;
    } else if (LINE_BREAK_TAGS.has((n as Element).tagName) && text && !text.endsWith('\n')) {
      text += '\n';
    }
  }
  return { text, nodes };
}

/** Offset in the block text of a DOM boundary point. */
function offsetInBlock(map: BlockTextMap, container: Node, offset: number): number {
  const hit = map.nodes.find((n) => n.node === container);
  if (hit) return hit.start + Math.min(offset, hit.node.length);
  // Boundary on an element: before the first text node that comes after it.
  const point = document.createRange();
  point.setStart(container, offset);
  for (const n of map.nodes) {
    if (point.comparePoint(n.node, 0) >= 0) return n.start;
  }
  return map.text.length;
}

/** DOM position of block-text offset `i` (`end`: the position just after character i - 1). */
function positionInBlock(map: BlockTextMap, i: number, end: boolean): { node: Text; offset: number } | null {
  for (const n of map.nodes) {
    const last = n.start + n.node.length;
    if (end ? i > n.start && i <= last : i >= n.start && i < last) return { node: n.node, offset: i - n.start };
  }
  return null;
}

function blockOf(node: Node): Element | null {
  let block: Element | null = node instanceof Element ? node : node.parentElement;
  while (block && block !== document.body && !BLOCK_DISPLAYS.test(getComputedStyle(block).display)) {
    block = block.parentElement;
  }
  return block;
}

/** [from, to) of the sentence around [start, end) without its outer whitespace; caret after the last sentence: that one. */
function trimmedBounds(text: string, start: number, end: number): { from: number; to: number } | null {
  let { from, to } = sentenceBounds(text, start, end);
  if (!text.slice(from, to).trim() && start > 0) ({ from, to } = sentenceBounds(text, start - 1, start - 1));
  while (from < to && /\s/.test(text[from])) from++;
  while (to > from && /\s/.test(text[to - 1])) to--;
  return from < to ? { from, to } : null;
}

/** Normalized text of a sentence to analyze: whitespace collapsed, at least one letter. */
function toAnalysisText(raw: string): string | null {
  const text = raw.replace(/[\s\u00a0\u202f]+/g, ' ').trim();
  if (!text || text.length > MAX_SENTENCE_CHARS || !/\p{L}/u.test(text)) return null;
  return text;
}

/** Sentence of the page around a range (a caret or a selected word), with its own range. */
export function sentenceAroundPageRange(range: Range): SentenceSelection | null {
  const block = blockOf(range.startContainer);
  if (!block) return null;
  const map = blockTextMap(block);
  const start = offsetInBlock(map, range.startContainer, range.startOffset);
  const end = range.collapsed ? start : Math.max(start, offsetInBlock(map, range.endContainer, range.endOffset));
  const bounds = trimmedBounds(map.text, start, end);
  if (!bounds) return null;
  const text = toAnalysisText(map.text.slice(bounds.from, bounds.to));
  const from = positionInBlock(map, bounds.from, false);
  const to = positionInBlock(map, bounds.to, true);
  if (!text || !from || !to) return null;
  const sentenceRange = document.createRange();
  sentenceRange.setStart(from.node, from.offset);
  sentenceRange.setEnd(to.node, to.offset);
  const rect = lastNonEmptyRect(sentenceRange.getClientRects()) ?? sentenceRange.getBoundingClientRect();
  return { text, rect, range: sentenceRange };
}

/**
 * Sentence to analyze when no sentence is selected (US-17): the sentence around the
 * selected word, or around the caret (page text, contenteditable, input/textarea).
 */
export function getSentenceAtCaret(): SentenceSelection | null {
  const active = getDeepActiveElement();
  if (isTextField(active) && active.selectionStart !== null) {
    const start = active.selectionStart;
    const end = active.selectionEnd ?? start;
    const bounds = trimmedBounds(active.value, start, Math.max(start, end));
    if (!bounds) return null;
    const text = toAnalysisText(active.value.slice(bounds.from, bounds.to));
    if (!text) return null;
    const rects = getTextareaCharacterRects(active, bounds.from, bounds.to);
    return { text, rect: rects[rects.length - 1] ?? active.getBoundingClientRect(), range: null };
  }
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!document.body?.contains(range.startContainer)) return null;
  try {
    return sentenceAroundPageRange(range);
  } catch {
    return null;
  }
}
