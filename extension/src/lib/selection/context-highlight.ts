/**
 * Soft green highlight on the sentence currently discussed in the chat panel
 * (docs/design/desktop-sidepanel-wordcard.png). Uses the CSS Custom Highlight API,
 * so the page DOM is not modified; does nothing on browsers without it.
 */
const HIGHLIGHT_NAME = 'tc-chat-context';
const STYLE_ID = 'tc-chat-context-style';

function supported(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `::highlight(${HIGHLIGHT_NAME}) { background-color: rgba(120, 190, 100, 0.32); }`;
  (document.head ?? document.documentElement).appendChild(style);
}

export function highlightContext(range: Range) {
  if (!supported()) return;
  ensureStyle();
  CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(range));
}

export function clearContextHighlight() {
  if (!supported()) return;
  CSS.highlights.delete(HIGHLIGHT_NAME);
}
