/**
 * One text model for contenteditable elements (US-11), used for all three steps:
 * the text sent to the checker, the underline positions, and Apply.
 *
 * - Text nodes in document order, character for character (offsets map 1:1 to the DOM).
 * - `<br>` counts as "\n".
 * - A block boundary (p, div, li, h1…, or any element displayed as a block) adds one
 *   "\n" between the texts it separates, unless there is already a line break there.
 *   This virtual "\n" belongs to no text node.
 * - Whitespace-only text nodes next to blocks (HTML indentation between paragraphs) and
 *   script/style content are left out, like the browser does not render them.
 *
 * `innerText` was used before for the checked text while positions were computed from
 * text nodes only, so every paragraph break shifted the underlines of the next paragraphs.
 */

export interface TextSegment {
  node: Text;
  /** Offset of the node's first character in the model text. */
  start: number;
}

export interface TextModel {
  text: string;
  segments: TextSegment[];
}

const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DETAILS', 'DIV', 'DL', 'DT', 'FIELDSET', 'FIGCAPTION',
  'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL',
  'P', 'PRE', 'SECTION', 'SUMMARY', 'TABLE', 'TBODY', 'THEAD', 'TFOOT', 'TR', 'TD', 'TH', 'UL', 'CAPTION',
]);
const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT']);
const BLOCK_DISPLAY = /^(block|flex|grid|list-item|table|table-row|table-cell|table-caption|flow-root)$/;

/** Block by tag, or by computed display when the element is styled as one. */
export function isBlockElement(el: Element): boolean {
  const tag = el.tagName.toUpperCase();
  if (BLOCK_TAGS.has(tag)) return true;
  if (tag === 'SPAN' || tag === 'B' || tag === 'I' || tag === 'A' || tag === 'STRONG' || tag === 'EM') {
    // Inline by default; checked only when styled (cheap path for the common case).
    if (!(el as HTMLElement).style?.display) return false;
  }
  try {
    const view = el.ownerDocument?.defaultView;
    const display = view?.getComputedStyle?.(el).display;
    return !!display && BLOCK_DISPLAY.test(display);
  } catch {
    return false;
  }
}

const isWhitespaceOnly = (s: string) => !/[^\s]/.test(s.replace(/ /g, 'x'));

/**
 * Whitespace-only text that only lays out the HTML source: between blocks, or between a
 * block and the edge of its parent (or alone in a block). Inside a line it is kept.
 */
function isLayoutWhitespace(node: Node, isBlock: (el: Element) => boolean): boolean {
  const prev = node.previousSibling;
  const next = node.nextSibling;
  const blockOrEdge = (n: Node | null) => n === null || (n.nodeType === 1 && isBlock(n as Element));
  if (!blockOrEdge(prev) || !blockOrEdge(next)) return false;
  if (prev || next) return true;
  const parent = node.parentElement;
  return !!parent && isBlock(parent);
}

export function buildTextModel(root: Node, isBlock: (el: Element) => boolean = isBlockElement): TextModel {
  let text = '';
  const segments: TextSegment[] = [];
  let pendingBreak = false;

  const breakIfNeeded = () => {
    if (pendingBreak && text.length > 0 && !text.endsWith('\n')) text += '\n';
    pendingBreak = false;
  };

  const walk = (parent: Node) => {
    for (let child = parent.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 3) {
        const data = (child as Text).data;
        if (!data) continue;
        if (isWhitespaceOnly(data) && isLayoutWhitespace(child, isBlock)) continue;
        breakIfNeeded();
        segments.push({ node: child as Text, start: text.length });
        text += data;
      } else if (child.nodeType === 1) {
        const el = child as Element;
        const tag = el.tagName.toUpperCase();
        if (SKIPPED_TAGS.has(tag)) continue;
        if (tag === 'BR') {
          breakIfNeeded();
          text += '\n';
          continue;
        }
        const block = isBlock(el);
        if (block) pendingBreak = true;
        walk(el);
        if (block) pendingBreak = true;
      }
    }
  };
  walk(root);
  return { text, segments };
}

/** Text of a contenteditable in the shared model. */
export function getModelText(root: Node): string {
  return buildTextModel(root).text;
}

function segmentEnd(s: TextSegment): number {
  return s.start + s.node.length;
}

/**
 * DOM position of a model offset. `side` decides where an offset on a boundary goes:
 * 'start' moves forward to the next text node, 'end' stays at the end of the previous one.
 */
export function positionAt(model: TextModel, offset: number, side: 'start' | 'end'): { node: Text; offset: number } | null {
  const { segments } = model;
  if (segments.length === 0) return null;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const end = segmentEnd(s);
    if (side === 'start') {
      if (offset < end || (offset === end && i === segments.length - 1)) {
        return { node: s.node, offset: Math.max(0, offset - s.start) };
      }
    } else if (offset <= end) {
      if (offset >= s.start || i === 0) return { node: s.node, offset: Math.max(0, offset - s.start) };
      // In a virtual "\n" before this node: end of the previous one.
      const prev = segments[i - 1];
      return { node: prev.node, offset: prev.node.length };
    }
  }
  const last = segments[segments.length - 1];
  return side === 'end' ? { node: last.node, offset: last.node.length } : null;
}

/** Range covering model offsets [start, end). */
export function rangeForModelOffsets(model: TextModel, start: number, end: number, doc: Document = document): Range | null {
  const from = positionAt(model, start, 'start');
  const to = positionAt(model, Math.max(start, end), 'end');
  if (!from || !to) return null;
  try {
    const range = doc.createRange();
    range.setStart(from.node, from.offset);
    range.setEnd(to.node, to.offset);
    return range;
  } catch {
    return null;
  }
}

/** Ancestors of `node` from the root down, `node` included. */
function ancestry(node: Node): Node[] {
  const chain: Node[] = [];
  for (let n: Node | null = node; n; n = n.parentNode) chain.unshift(n);
  return chain;
}

/** True when `b` comes after `a` in tree order (not inside it). */
function isAfter(a: Node, b: Node): boolean {
  const pa = ancestry(a);
  const pb = ancestry(b);
  let i = 0;
  while (i < pa.length && i < pb.length && pa[i] === pb[i]) i++;
  if (i === pa.length || i === pb.length) return false; // one contains the other
  const parent = pa[i - 1];
  if (!parent) return false;
  const siblings = [...parent.childNodes];
  return siblings.indexOf(pb[i] as ChildNode) > siblings.indexOf(pa[i] as ChildNode);
}

/**
 * Model offset of a DOM position (a caret) inside the model's root; null for a text node
 * outside the model or an empty model.
 * Element positions (`<p>|<b>…`) resolve to the start of the next text node.
 */
export function offsetOfPosition(model: TextModel, node: Node, offset: number): number | null {
  if (node.nodeType === 3) {
    const segment = model.segments.find((s) => s.node === node);
    return segment ? segment.start + Math.min(offset, (node as Text).length) : null;
  }
  if (model.segments.length === 0) return null;
  const child = node.childNodes[offset] ?? null;
  for (const s of model.segments) {
    const at = child ? child === s.node || child.contains(s.node) || isAfter(child, s.node) : !node.contains(s.node) && isAfter(node, s.node);
    if (at) return s.start;
  }
  // After all text (the caller checks the position is inside the editable root).
  return model.text.length;
}
