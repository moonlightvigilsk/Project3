import type { VocabEntry } from '@/types';
import { buildMatcher, findMatches, type HighlightStatus, type VocabMatcher } from './matcher';

/**
 * US-09: light highlight of saved words (status new / learning) in the page.
 * Uses the CSS Custom Highlight API: Range objects registered in CSS.highlights and
 * styled with ::highlight(), so the page DOM is never modified.
 * Work is bounded (text nodes, characters, ranges) and done in small time slices.
 */

export const HIGHLIGHT_NAMES: Record<HighlightStatus, string> = {
  new: 'textchecker-vocab-new',
  learning: 'textchecker-vocab-learning',
};

/** Text nodes read by a full page scan. */
export const MAX_SCAN_NODES = 8000;
/** Text nodes read per batch of page changes (infinite scroll, SPA navigation). */
export const MAX_MUTATION_NODES = 2000;
/** Characters of text read per scan. */
export const MAX_SCAN_CHARS = 1_000_000;
/** Words highlighted on one page. */
export const MAX_RANGES = 3000;
/** Longest run of work before giving the page the main thread back. */
const SLICE_MS = 8;

const SKIPPED_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE', 'KBD', 'SAMP',
  'SVG', 'MATH', 'IFRAME', 'OBJECT', 'CANVAS', 'VIDEO', 'AUDIO',
]);
const OVERLAY_ID = 'textchecker-overlay';

const STYLE = `
::highlight(${HIGHLIGHT_NAMES.new}) {
  background-color: rgba(52, 96, 200, 0.13);
  text-decoration: underline dotted rgba(52, 96, 200, 0.75);
}
::highlight(${HIGHLIGHT_NAMES.learning}) {
  background-color: rgba(234, 179, 8, 0.2);
  text-decoration: underline dotted rgba(161, 98, 7, 0.75);
}`;

export function isHighlightSupported(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight === 'function';
}

/** Skips text the user edits, code, our own UI, and elements without readable text. */
function acceptNode(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node as Text).data.trim().length >= 2 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
  }
  const el = node as Element;
  if (SKIPPED_TAGS.has(el.tagName.toUpperCase()) || el.id === OVERLAY_ID) return NodeFilter.FILTER_REJECT;
  if ((el as HTMLElement).isContentEditable) return NodeFilter.FILTER_REJECT;
  return NodeFilter.FILTER_SKIP;
}

interface Scan {
  walker: TreeWalker;
  nodes: number;
  chars: number;
  maxNodes: number;
}

export class VocabHighlighter {
  private matcher: VocabMatcher | null = null;
  private readonly highlights: Record<HighlightStatus, Highlight>;
  /** Ranges per text node, to replace them when the text changes. */
  private readonly ranges = new Map<Text, Range[]>();
  private rangeCount = 0;
  private readonly pending: { root: Node; maxNodes: number }[] = [];
  private scan: Scan | null = null;
  private scheduled = false;
  private observer: MutationObserver | null = null;
  private styleCleanup: (() => void) | null = null;
  private active = false;

  constructor(private readonly doc: Document = document) {
    this.highlights = { new: new Highlight(), learning: new Highlight() };
  }

  /** Starts (or refreshes) highlighting with the current notebook. */
  update(entries: readonly VocabEntry[]): void {
    this.matcher = buildMatcher(entries);
    this.clear();
    if (!this.matcher) {
      this.stopObserving();
      return;
    }
    if (!this.active) this.activate();
    if (this.doc.body) this.enqueue(this.doc.body, MAX_SCAN_NODES);
  }

  stop(): void {
    this.matcher = null;
    this.clear();
    this.stopObserving();
  }

  /** Number of highlighted words (for tests and diagnostics). */
  get count(): number {
    return this.rangeCount;
  }

  private activate() {
    this.active = true;
    this.styleCleanup = injectStyle(this.doc);
    CSS.highlights.set(HIGHLIGHT_NAMES.new, this.highlights.new);
    CSS.highlights.set(HIGHLIGHT_NAMES.learning, this.highlights.learning);
    this.observer = new MutationObserver((records) => this.onMutations(records));
    this.observer.observe(this.doc.documentElement, { childList: true, subtree: true, characterData: true });
  }

  private stopObserving() {
    if (!this.active) return;
    this.active = false;
    this.observer?.disconnect();
    this.observer = null;
    CSS.highlights.delete(HIGHLIGHT_NAMES.new);
    CSS.highlights.delete(HIGHLIGHT_NAMES.learning);
    this.styleCleanup?.();
    this.styleCleanup = null;
  }

  private clear() {
    this.highlights.new.clear();
    this.highlights.learning.clear();
    this.ranges.clear();
    this.rangeCount = 0;
    this.pending.length = 0;
    this.scan = null;
  }

  private onMutations(records: MutationRecord[]) {
    if (!this.matcher) return;
    let removed = false;
    const roots = new Set<Node>();
    for (const r of records) {
      if (r.type === 'characterData') {
        this.forget(r.target as Text);
        roots.add(r.target);
      } else {
        r.addedNodes.forEach((n) => roots.add(n));
        if (r.removedNodes.length > 0) removed = true;
      }
    }
    if (removed) this.forgetDetached();
    let budget = MAX_MUTATION_NODES;
    for (const root of roots) {
      if (budget <= 0) break;
      if (!root.isConnected || !this.isScannable(root)) continue;
      this.enqueue(root, budget);
      budget -= root.nodeType === Node.TEXT_NODE ? 1 : 50; // rough share; each scan has its own cap
    }
  }

  /** A changed node outside skipped areas (editable fields, code, our overlay). */
  private isScannable(node: Node): boolean {
    for (let el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement; el; el = el.parentElement) {
      if (acceptNode(el) === NodeFilter.FILTER_REJECT) return false;
    }
    return true;
  }

  private forget(text: Text) {
    const list = this.ranges.get(text);
    if (!list) return;
    for (const range of list) {
      this.highlights.new.delete(range);
      this.highlights.learning.delete(range);
    }
    this.rangeCount -= list.length;
    this.ranges.delete(text);
  }

  private forgetDetached() {
    for (const text of [...this.ranges.keys()]) if (!text.isConnected) this.forget(text);
  }

  private enqueue(root: Node, maxNodes: number) {
    this.pending.push({ root, maxNodes });
    this.schedule();
  }

  private schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    const run = () => {
      this.scheduled = false;
      this.work();
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 500 });
    else setTimeout(run, 16);
  }

  private work() {
    const deadline = performance.now() + SLICE_MS;
    while (performance.now() < deadline) {
      if (!this.scan) {
        const next = this.pending.shift();
        if (!next) return;
        if (!next.root.isConnected) continue;
        this.scan = {
          walker: this.doc.createTreeWalker(next.root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode }),
          nodes: 0,
          chars: 0,
          maxNodes: next.maxNodes,
        };
        // The root itself is not visited by nextNode().
        if (next.root.nodeType === Node.TEXT_NODE) {
          if (acceptNode(next.root) === NodeFilter.FILTER_ACCEPT) this.highlightText(next.root as Text);
          this.scan = null;
          continue;
        }
      }
      const scan = this.scan;
      const node = scan.walker.nextNode() as Text | null;
      if (!node || scan.nodes >= scan.maxNodes || scan.chars >= MAX_SCAN_CHARS || this.rangeCount >= MAX_RANGES) {
        this.scan = null;
        continue;
      }
      scan.nodes++;
      scan.chars += node.data.length;
      this.highlightText(node);
    }
    this.schedule();
  }

  private highlightText(text: Text) {
    if (!this.matcher || this.ranges.has(text)) return;
    const matches = findMatches(text.data, this.matcher, MAX_RANGES - this.rangeCount);
    if (matches.length === 0) return;
    const list: Range[] = [];
    for (const m of matches) {
      const range = this.doc.createRange();
      range.setStart(text, m.start);
      range.setEnd(text, m.end);
      this.highlights[m.status].add(range);
      list.push(range);
    }
    this.ranges.set(text, list);
    this.rangeCount += list.length;
  }
}

/**
 * ::highlight() rules must be in the page's own styles (not our shadow root). A
 * constructed stylesheet is not blocked by the page's CSP; <style> is the fallback.
 */
function injectStyle(doc: Document): () => void {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(STYLE);
    doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
    return () => {
      doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((s) => s !== sheet);
    };
  } catch {
    const style = doc.createElement('style');
    style.dataset.textchecker = 'vocab-highlight';
    style.textContent = STYLE;
    (doc.head ?? doc.documentElement).appendChild(style);
    return () => style.remove();
  }
}
