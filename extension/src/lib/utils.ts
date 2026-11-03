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
  if (element.getAttribute('contenteditable') === 'true') return true;

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

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
