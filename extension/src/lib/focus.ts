/**
 * Keyboard focus helpers for the cards the extension shows on web pages (US-16):
 * remember where focus was, keep Tab inside a card, and give focus back on close.
 */

const FOCUSABLE = [
  'button:not([disabled])',
  'a[href]',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Focused element, following open shadow roots. */
export function deepActiveElement(root: Document | ShadowRoot = document): Element | null {
  let el = root.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
}

function isHidden(el: Element, root: Element): boolean {
  for (let n: Element | null = el; n && n !== root.parentElement; n = n.parentElement) {
    if ((n as HTMLElement).hidden) return true;
  }
  // Not rendered (display: none somewhere above).
  return el.getClientRects().length === 0;
}

/** Focusable, visible elements of `root`, in DOM order. */
export function focusableIn(root: Element): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !isHidden(el, root));
}

/** True when focus is inside `root` (also across a shadow root). */
export function containsFocus(root: Element | null): boolean {
  if (!root) return false;
  const holder = root.getRootNode() as Document | ShadowRoot;
  const active = holder.activeElement;
  return !!active && root.contains(active);
}

export interface FocusOrigin {
  /** Gives focus (and the text selection) back to where it was. */
  restore(): void;
}

/**
 * Remembers the focused element and its selection: the caret/selection of an input or
 * textarea, or the page/contenteditable range. Elements inside `ignore` (our own overlay)
 * are not recorded.
 */
export function captureFocusOrigin(ignore: Element | null = null): FocusOrigin {
  let active = deepActiveElement() as HTMLElement | null;
  if (active && ignore && (active === ignore || ignore.contains(active))) active = null;
  if (active === document.body) active = null;

  const field =
    active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active : null;
  const fieldSelection =
    field && field.selectionStart !== null && field.selectionEnd !== null
      ? { start: field.selectionStart, end: field.selectionEnd, direction: field.selectionDirection ?? undefined }
      : null;
  const sel = window.getSelection();
  const range = !field && sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;

  return {
    restore() {
      try {
        if (active?.isConnected) active.focus({ preventScroll: true });
        if (field && fieldSelection && field.isConnected) {
          field.setSelectionRange(fieldSelection.start, fieldSelection.end, fieldSelection.direction as 'forward' | 'backward' | 'none' | undefined);
        } else if (range && range.startContainer.isConnected) {
          const current = window.getSelection();
          current?.removeAllRanges();
          current?.addRange(range);
        }
      } catch {
        // The page changed under us: leaving focus where it is is fine.
      }
    },
  };
}

export interface TrapOptions {
  /** Called on Escape (the event is consumed). */
  onEscape?: () => void;
}

/**
 * Keeps Tab / Shift+Tab cycling inside `root` while focus is in it, and handles Escape.
 * Keys typed inside do not reach the page's own shortcuts. Returns a function removing it.
 */
export function trapFocus(root: HTMLElement, options: TrapOptions = {}): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && options.onEscape) {
      e.preventDefault();
      e.stopPropagation();
      options.onEscape();
      return;
    }
    if (e.key === 'Tab') {
      const items = focusableIn(root);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const holder = root.getRootNode() as Document | ShadowRoot;
      const index = items.indexOf(holder.activeElement as HTMLElement);
      const next = e.shiftKey
        ? items[index <= 0 ? items.length - 1 : index - 1]
        : items[index < 0 || index === items.length - 1 ? 0 : index + 1];
      e.preventDefault();
      next.focus();
    }
    // Enter/Space activate the focused button natively; nothing else should trigger page shortcuts.
    e.stopPropagation();
  };
  root.addEventListener('keydown', onKeyDown);
  return () => root.removeEventListener('keydown', onKeyDown);
}

/** Focuses `preferred`, else the first focusable element, else `root` itself (made focusable). */
export function focusInto(root: HTMLElement, preferred?: HTMLElement | null): void {
  const target = preferred && !isHidden(preferred, root) ? preferred : focusableIn(root)[0];
  if (target) {
    target.focus({ preventScroll: true });
    return;
  }
  if (!root.hasAttribute('tabindex')) root.tabIndex = -1;
  root.focus({ preventScroll: true });
}
