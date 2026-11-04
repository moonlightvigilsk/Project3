import { buildTextModel, rangeForModelOffsets, type TextModel } from './editable-text';
import type { SuggestionType, UILanguage } from '@/types';

export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getSuggestionColor(type: SuggestionType): string {
  switch (type) {
    case 'spelling':
      return '#800020'; // French Bordeaux
    case 'grammar':
      return '#854D0E'; // French Ochre
    case 'punctuation':
      return '#1E293B'; // French Navy
    case 'style':
      return '#44403C'; // Deep Ink
    default:
      return '#78716C'; // Ink muted
  }
}

export function getSuggestionLabel(type: SuggestionType, lang: UILanguage = 'vi'): string {
  const labels: Record<UILanguage, Record<SuggestionType, string>> = {
    vi: {
      spelling: 'Chính tả',
      grammar: 'Ngữ pháp',
      punctuation: 'Dấu câu',
      style: 'Văn phong',
    },
    en: {
      spelling: 'Spelling',
      grammar: 'Grammar',
      punctuation: 'Punctuation',
      style: 'Style',
    },
    fr: {
      spelling: 'Orthographe',
      grammar: 'Grammaire',
      punctuation: 'Ponctuation',
      style: 'Style',
    },
  };
  return labels[lang]?.[type] || labels.vi[type] || 'Lỗi';
}


export function getTargetEditableElement(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null;
  const tagName = element.tagName.toLowerCase();
  if (tagName === 'textarea' || tagName === 'input') {
    return element;
  }
  if (element.isContentEditable) {
    const root = element.closest('[contenteditable="true"]') as HTMLElement | null;
    if (root) return root;
    const roleRoot = element.closest('[role="textbox"]') as HTMLElement | null;
    if (roleRoot) return roleRoot;
    return element;
  }
  return element;
}

export function isEditableElement(element: Element): boolean {
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();

  // Standard editable elements
  if (tagName === 'textarea') return true;
  if (tagName === 'input') {
    const type = (element as HTMLInputElement).type.toLowerCase();
    return ['text', 'email', 'search', 'url', 'tel'].includes(type);
  }

  // Contenteditable elements
  if (element.getAttribute('contenteditable') === 'true' || (element as HTMLElement).isContentEditable) return true;

  // Check for common rich text editor patterns
  if (element.getAttribute('role') === 'textbox') return true;

  // Gmail-specific editable attribute
  if (element.getAttribute('g_editable') === 'true') return true;

  return false;
}

export function getTextFromElement(element: HTMLElement): string {
  if (element.tagName.toLowerCase() === 'textarea' || element.tagName.toLowerCase() === 'input') {
    return (element as HTMLInputElement | HTMLTextAreaElement).value;
  }

  // contenteditable: same text model as the underline positions and Apply (US-11)
  return getContenteditableWalkerText(element);
}

export function setTextInElement(element: HTMLElement, text: string): void {
  if (element.tagName.toLowerCase() === 'textarea' || element.tagName.toLowerCase() === 'input') {
    (element as HTMLInputElement | HTMLTextAreaElement).value = text;
    // Trigger input event for frameworks that listen to it
    element.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  // For contenteditable
  element.innerText = text;
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Range of model offsets [startIndex, endIndex) in a contenteditable (US-11 text model). */
export function getContenteditableRange(
  element: HTMLElement,
  startIndex: number,
  endIndex: number,
  model: TextModel = buildTextModel(element)
): Range | null {
  return rangeForModelOffsets(model, startIndex, endIndex, element.ownerDocument);
}

/**
 * Text of a contenteditable in the shared model (src/lib/editable-text.ts): the text
 * sent to the checker, so its offsets are the ones used for underlines and Apply.
 */
export function getContenteditableWalkerText(element: HTMLElement): string {
  return buildTextModel(element).text;
}

function normalizeSpaces(s: string): string {
  return s.replace(/ /g, ' ');
}

/** Index of the occurrence of `needle` in `haystack` closest to `hint`, or -1. */
function findClosestOccurrence(haystack: string, needle: string, hint: number): number {
  if (!needle) return -1;
  let best = -1;
  let bestDiff = Infinity;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    const diff = Math.abs(idx - hint);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = idx;
    }
    idx = haystack.indexOf(needle, idx + 1);
  }
  return best;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Polls `done` a few times to give async frameworks (React, Lexical, Draft) time to re-render. */
async function settle(done: () => boolean): Promise<boolean> {
  if (done()) return true;
  for (const ms of [16, 50, 120]) {
    await wait(ms);
    if (done()) return true;
  }
  return false;
}

function applyToInput(
  inputEl: HTMLInputElement | HTMLTextAreaElement,
  startIndex: number,
  originalText: string,
  replacement: string
): boolean {
  const currentVal = inputEl.value;
  let actualStart = startIndex;
  if (currentVal.substring(actualStart, actualStart + originalText.length) !== originalText) {
    actualStart = findClosestOccurrence(currentVal, originalText, startIndex);
    if (actualStart === -1) {
      console.warn('[TextChecker] Original text no longer present, skip apply:', originalText);
      return false;
    }
  }
  const actualEnd = actualStart + originalText.length;
  const expected =
    currentVal.substring(0, actualStart) + replacement + currentVal.substring(actualEnd);

  inputEl.setSelectionRange(actualStart, actualEnd);
  try {
    document.execCommand('insertText', false, replacement);
  } catch {
    /* ignore */
  }
  if (inputEl.value === expected) return true;

  // Fallback: native value setter so React-controlled inputs pick up the change.
  const proto = Object.getPrototypeOf(inputEl);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(inputEl, expected);
  else inputEl.value = expected;
  const caret = actualStart + replacement.length;
  inputEl.setSelectionRange(caret, caret);
  inputEl.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertReplacementText',
      data: replacement,
    })
  );
  inputEl.dispatchEvent(new Event('change', { bubbles: true }));
  return inputEl.value === expected;
}

async function applyToContentEditable(
  targetEl: HTMLElement,
  startIndex: number,
  originalText: string,
  replacement: string
): Promise<boolean> {
  const readText = () => normalizeSpaces(getContenteditableWalkerText(targetEl));
  const before = readText();
  const orig = normalizeSpaces(originalText);

  // startIndex is an offset in this same model (US-11). The closest occurrence is still
  // looked up in case the user typed since the check.
  const pos = findClosestOccurrence(before, orig, startIndex);
  if (pos === -1) {
    console.warn('[TextChecker] Original text no longer present, skip apply:', originalText);
    return false;
  }
  const expected = normalizeSpaces(
    before.substring(0, pos) + replacement + before.substring(pos + orig.length)
  );
  const isDone = () => readText() === expected;
  const hasChanged = () => readText() !== before;

  const selectTarget = (): Range | null => {
    const range = getContenteditableRange(targetEl, pos, pos + orig.length);
    const sel = window.getSelection();
    if (!range || !sel) return null;
    sel.removeAllRanges();
    sel.addRange(range);
    return range;
  };

  if (!selectTarget()) return false;
  // Let the editor process `selectionchange` so its internal selection
  // (Draft.js / Lexical / Slate) matches the DOM selection before inserting.
  await wait(20);
  if (!selectTarget()) return false;

  // 1. Native editing command. It fires the real beforeinput/input events the
  //    editor listens to. Never dispatch a synthetic `beforeinput` as well:
  //    editors like Lexical handle both and insert the text twice.
  try {
    document.execCommand('insertText', false, replacement);
  } catch {
    /* ignore */
  }
  if (await settle(isDone)) return true;
  if (hasChanged()) {
    console.warn('[TextChecker] Editor changed text unexpectedly after insertText');
    return false;
  }

  // 2. Simulated paste - most rich editors implement their own paste handler.
  if (selectTarget()) {
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', replacement);
      targetEl.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
      );
    } catch {
      /* ignore */
    }
    if (await settle(isDone)) return true;
    if (hasChanged()) return false;
  }

  // 3. Last resort: direct DOM edit (plain contenteditable without a framework).
  const range = selectTarget();
  if (!range) return false;
  try {
    range.deleteContents();
    const textNode = document.createTextNode(replacement);
    range.insertNode(textNode);
    const sel = window.getSelection();
    if (sel) {
      const caret = document.createRange();
      caret.setStartAfter(textNode);
      caret.collapse(true);
      sel.removeAllRanges();
      sel.addRange(caret);
    }
    targetEl.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: replacement })
    );
  } catch (e) {
    console.warn('[TextChecker] DOM fallback replacement failed:', e);
    return false;
  }
  // A framework may revert the foreign DOM mutation on its next render.
  await wait(120);
  return isDone();
}

/**
 * Replace `originalText` (expected near `startIndex`) with `replacement` inside an
 * input/textarea or a contenteditable rich-text editor (React, Draft.js, Lexical,
 * Slate, Zalo Web, Messenger...). Resolves to true only if the text really changed.
 */
export async function applyReplacementToElement(
  element: HTMLElement,
  startIndex: number,
  _endIndex: number,
  originalText: string,
  replacement: string
): Promise<boolean> {
  const targetEl = getTargetEditableElement(element) || element;
  try {
    targetEl.focus({ preventScroll: true });
  } catch {
    /* ignore */
  }

  const tagName = targetEl.tagName.toLowerCase();
  if (tagName === 'textarea' || tagName === 'input') {
    return applyToInput(
      targetEl as HTMLInputElement | HTMLTextAreaElement,
      startIndex,
      originalText,
      replacement
    );
  }
  return applyToContentEditable(targetEl, startIndex, originalText, replacement);
}

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
