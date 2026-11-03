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

  // For contenteditable
  return element.innerText || element.textContent || '';
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

export function getContenteditableRange(
  element: HTMLElement,
  startIndex: number,
  endIndex: number
): Range | null {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          return NodeFilter.FILTER_ACCEPT;
        }
        if (node.nodeName === 'BR') {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    }
  );

  let currentIndex = 0;
  let startNode: Node | null = null;
  let startOffset = 0;
  let endNode: Node | null = null;
  let endOffset = 0;

  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.nodeName === 'BR') {
      currentIndex += 1;
      continue;
    }

    const textNode = node as Text;
    const nodeLength = textNode.length;

    if (!startNode && currentIndex + nodeLength > startIndex) {
      startNode = textNode;
      startOffset = Math.max(0, startIndex - currentIndex);
    }

    if (!endNode && currentIndex + nodeLength >= endIndex) {
      endNode = textNode;
      endOffset = Math.min(nodeLength, endIndex - currentIndex);
      break;
    }

    currentIndex += nodeLength;
  }

  if (startNode && endNode) {
    try {
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      return range;
    } catch (e) {
      console.warn('Failed to construct range in contenteditable:', e);
    }
  }

  return null;
}

/**
 * Robustly replace a text range inside both standard inputs/textareas and modern
 * contenteditable rich-text frameworks (React, Draft.js, Lexical, Slate, Zalo Web, Messenger).
 */
export function applyReplacementToElement(
  element: HTMLElement,
  startIndex: number,
  endIndex: number,
  originalText: string,
  replacement: string
): boolean {
  try {
    element.focus();
  } catch (e) {}

  const tagName = element.tagName.toLowerCase();
  const isInputOrTextarea = tagName === 'textarea' || tagName === 'input';

  if (isInputOrTextarea) {
    const inputEl = element as HTMLInputElement | HTMLTextAreaElement;
    let actualStart = startIndex;
    let actualEnd = endIndex;
    const currentVal = inputEl.value;

    if (currentVal.substring(actualStart, actualEnd) !== originalText) {
      let bestIdx = -1;
      let minDiff = Infinity;
      let idx = currentVal.indexOf(originalText);
      while (idx !== -1) {
        const diff = Math.abs(idx - startIndex);
        if (diff < minDiff) {
          minDiff = diff;
          bestIdx = idx;
        }
        idx = currentVal.indexOf(originalText, idx + 1);
      }
      if (bestIdx !== -1) {
        actualStart = bestIdx;
        actualEnd = bestIdx + originalText.length;
      }
    }

    inputEl.setSelectionRange(actualStart, actualEnd);

    let applied = false;
    try {
      applied = document.execCommand('insertText', false, replacement);
    } catch (e) {
      applied = false;
    }

    // Fallback for React controlled inputs where execCommand may be bypassed
    if (!applied || inputEl.value === currentVal) {
      const nextVal =
        currentVal.substring(0, actualStart) +
        replacement +
        currentVal.substring(actualEnd);

      const proto = Object.getPrototypeOf(inputEl);
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) {
        setter.call(inputEl, nextVal);
      } else {
        inputEl.value = nextVal;
      }

      inputEl.setSelectionRange(
        actualStart + replacement.length,
        actualStart + replacement.length
      );

      inputEl.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertReplacementText',
          data: replacement,
        })
      );
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }

  // --- CONTENTEDITABLE SUPPORT (Zalo Web, Messenger, etc.) ---
  const fullText = getTextFromElement(element);
  let actualStart = startIndex;
  let actualEnd = endIndex;

  if (fullText.substring(actualStart, actualEnd) !== originalText) {
    let bestIdx = -1;
    let minDiff = Infinity;
    let idx = fullText.indexOf(originalText);
    while (idx !== -1) {
      const diff = Math.abs(idx - startIndex);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = idx;
      }
      idx = fullText.indexOf(originalText, idx + 1);
    }
    if (bestIdx !== -1) {
      actualStart = bestIdx;
      actualEnd = bestIdx + originalText.length;
    }
  }

  const range = getContenteditableRange(element, actualStart, actualEnd);
  if (range) {
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);

      let applied = false;
      try {
        applied = document.execCommand('insertText', false, replacement);
      } catch (e) {
        applied = false;
      }

      if (applied) {
        element.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertReplacementText',
            data: replacement,
          })
        );
        return true;
      }

      // Fallback 1: DOM range replacement
      try {
        range.deleteContents();
        const textNode = document.createTextNode(replacement);
        range.insertNode(textNode);
        sel.removeAllRanges();
        const caretRange = document.createRange();
        caretRange.setStartAfter(textNode);
        caretRange.collapse(true);
        sel.addRange(caretRange);

        element.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: replacement,
          })
        );
        return true;
      } catch (e) {
        console.warn('Fallback range replacement failed:', e);
      }
    }
  }

  // Final fallback: bulk replace
  const currentText = getTextFromElement(element);
  const nextText =
    currentText.substring(0, actualStart) +
    replacement +
    currentText.substring(actualEnd);
  setTextInElement(element, nextText);
  return true;
}

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
