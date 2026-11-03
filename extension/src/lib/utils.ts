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
  const targetEl = getTargetEditableElement(element) || element;
  try {
    targetEl.focus();
  } catch (e) {}

  const tagName = targetEl.tagName.toLowerCase();
  const isInputOrTextarea = tagName === 'textarea' || tagName === 'input';

  if (isInputOrTextarea) {
    const inputEl = targetEl as HTMLInputElement | HTMLTextAreaElement;
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

  // --- CONTENTEDITABLE SUPPORT (Zalo Web, Messenger, React, etc.) ---
  const fullText = getTextFromElement(targetEl);
  let actualStart = startIndex;
  let actualEnd = endIndex;

  // Normalized search (handles non-breaking spaces   from rich editors)
  const normFull = fullText.replace(/\u00A0/g, ' ');
  const normOrig = originalText.replace(/\u00A0/g, ' ');

  if (normFull.substring(actualStart, actualEnd) !== normOrig) {
    let bestIdx = -1;
    let minDiff = Infinity;
    let idx = normFull.indexOf(normOrig);
    while (idx !== -1) {
      const diff = Math.abs(idx - startIndex);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = idx;
      }
      idx = normFull.indexOf(normOrig, idx + 1);
    }
    if (bestIdx !== -1) {
      actualStart = bestIdx;
      actualEnd = bestIdx + originalText.length;
    }
  }

  const range = getContenteditableRange(targetEl, actualStart, actualEnd);
  if (range) {
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);

      // Dispatch standard beforeinput first
      try {
        const beforeEvt = new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: replacement,
        });
        targetEl.dispatchEvent(beforeEvt);
      } catch (e) {}

      let applied = false;
      try {
        applied = document.execCommand('insertText', false, replacement);
      } catch (e) {
        applied = false;
      }

      // Check if text actually updated
      const textAfter = getTextFromElement(targetEl).replace(/\u00A0/g, ' ');
      if (applied && textAfter.includes(replacement)) {
        try {
          targetEl.dispatchEvent(
            new InputEvent('input', {
              bubbles: true,
              cancelable: false,
              inputType: 'insertText',
              data: replacement,
            })
          );
        } catch (e) {}
        return true;
      }

      // Fallback: DOM Range replacement
      try {
        range.deleteContents();
        const textNode = document.createTextNode(replacement);
        range.insertNode(textNode);
        sel.removeAllRanges();
        const caretRange = document.createRange();
        caretRange.setStartAfter(textNode);
        caretRange.collapse(true);
        sel.addRange(caretRange);

        targetEl.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            cancelable: false,
            inputType: 'insertText',
            data: replacement,
          })
        );
        targetEl.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      } catch (e) {
        console.warn('Fallback range replacement failed:', e);
      }
    }
  }

  // Final fallback
  const currentText = getTextFromElement(targetEl);
  const nextText =
    currentText.substring(0, actualStart) +
    replacement +
    currentText.substring(actualEnd);
  setTextInElement(targetEl, nextText);
  return true;
}

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
