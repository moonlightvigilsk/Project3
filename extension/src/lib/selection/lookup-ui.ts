import type { Translations } from '@/lib/i18n';
import type { DictionaryEntry, Gender, LookupResponse, LookupResult } from '@/lib/dictionary/types';
import type { SourceLink } from '@/lib/dictionary/sources';
import type { SelectionInfo } from './selection-info';

/**
 * Floating button + word card (docs/design/desktop-sidepanel-wordcard.png):
 * white card, rounded, a grey "source" pill with a star at the top, the word in large
 * type, a muted meta line (pos · IPA · gender) and small uppercase section titles.
 */
export const SELECTION_STYLES = `
  .tc-lookup-btn {
    position: fixed;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--tc-surface);
    border: 1px solid var(--tc-border);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.10);
    color: var(--tc-text-2);
    cursor: pointer;
    pointer-events: auto;
    z-index: 2147483647;
    animation: tc-fadeIn 0.12s ease-out;
    padding: 0;
  }
  .tc-lookup-btn:hover { background: var(--tc-surface-2); color: var(--tc-text); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.14); }
  .tc-lookup-btn:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 2px; }
  .tc-lookup-btn svg { width: 15px; height: 15px; }

  .tc-lookup-card {
    position: fixed;
    width: 340px;
    max-width: calc(100vw - 20px);
    max-height: min(72vh, 520px);
    display: flex;
    flex-direction: column;
    background: var(--tc-surface);
    border: 1px solid var(--tc-border);
    border-radius: 16px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.06);
    padding: 10px 12px 16px;
    pointer-events: auto;
    z-index: 2147483647;
    animation: tc-fadeIn 0.15s ease-out;
    color: var(--tc-text);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    /* Pages that disable selection must not stop users copying a definition. */
    -webkit-user-select: text;
    user-select: text;
  }
  .tc-lookup-card:focus { outline: none; }
  .tc-lookup-card:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 2px; }
  .tc-card-bar, .tc-lookup-retry { -webkit-user-select: none; user-select: none; }

  /* Top bar: [☆  source/word  ×] */
  .tc-card-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 30px;
    padding: 0 4px;
    background: var(--tc-surface-2);
    border-radius: 999px;
    flex-shrink: 0;
  }
  .tc-card-iconbtn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    border-radius: 999px;
    color: var(--tc-muted);
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
  }
  .tc-card-iconbtn:hover { background: var(--tc-border); color: var(--tc-text); }
  .tc-card-iconbtn:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 1px; }
  .tc-card-iconbtn svg { width: 14px; height: 14px; }
  .tc-card-iconbtn[aria-pressed="true"] { color: var(--tc-star); }
  .tc-card-iconbtn[aria-pressed="true"] svg { fill: currentColor; }
  .tc-card-star[aria-pressed="true"] { width: auto; gap: 4px; padding: 0 8px 0 6px; }
  .tc-star-label { font-size: 11.5px; font-weight: 600; }
  .tc-star-label[hidden] { display: none; }

  /* Saved word: context sentence + note editor (US-06) */
  .tc-vocab-panel {
    flex-shrink: 0;
    margin: 10px 6px 0;
    padding: 8px 10px 10px;
    background: var(--tc-note-bg);
    border: 1px solid var(--tc-note-border);
    border-radius: 10px;
  }
  .tc-vocab-panel .tc-section-title { margin-top: 4px; display: block; }
  .tc-vocab-context { margin-top: 2px; font-size: 12px; color: var(--tc-text-2); font-style: italic; line-height: 1.4; }
  .tc-vocab-note {
    display: block;
    box-sizing: border-box;
    width: 100%;
    margin-top: 3px;
    padding: 6px 8px;
    font: inherit;
    font-size: 12.5px;
    color: var(--tc-text);
    background: var(--tc-surface);
    border: 1px solid var(--tc-border);
    border-radius: 8px;
    resize: vertical;
  }
  .tc-vocab-note:focus { outline: 2px solid var(--tc-accent); outline-offset: 0; }
  .tc-vocab-actions { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
  .tc-vocab-btn {
    padding: 4px 10px;
    font-size: 11.5px;
    border-radius: 999px;
    border: 1px solid var(--tc-border);
    background: var(--tc-surface);
    color: var(--tc-text-2);
    cursor: pointer;
  }
  .tc-vocab-btn:hover { background: var(--tc-surface-2); }
  .tc-vocab-btn:disabled { opacity: 0.5; cursor: default; }
  .tc-vocab-primary { background: var(--tc-text); border-color: var(--tc-text); color: var(--tc-surface); }
  .tc-vocab-primary:hover { background: var(--tc-text-2); }
  .tc-vocab-status { font-size: 11px; color: var(--tc-muted); }
  .tc-card-source {
    flex: 1;
    min-width: 0;
    text-align: center;
    font-size: 12px;
    color: var(--tc-text-2);
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  a.tc-card-source:hover { color: var(--tc-text); text-decoration: underline; }

  .tc-lookup-head { padding: 18px 6px 0; flex-shrink: 0; }
  .tc-lookup-wordrow { display: flex; align-items: center; gap: 6px; }
  .tc-lookup-speak { width: 28px; height: 28px; color: var(--tc-text-2); }
  .tc-lookup-speak svg { width: 17px; height: 17px; }
  .tc-lookup-speak[hidden] { display: none; }
  .tc-lookup-speak.tc-playing { color: var(--tc-accent); background: var(--tc-accent-soft); }
  .tc-lookup-speak.tc-failed { color: var(--tc-danger); }
  .tc-lookup-word {
    font-size: 20px;
    font-weight: 700;
    line-height: 1.2;
    color: var(--tc-text);
    word-break: break-word;
  }
  .tc-lookup-meta {
    margin-top: 3px;
    font-size: 12px;
    color: var(--tc-muted);
  }
  .tc-lookup-meta .tc-ipa { font-family: 'Charis SIL', 'Doulos SIL', 'Gentium Plus', 'Inter', sans-serif; }

  .tc-lookup-body {
    margin-top: 4px;
    padding: 0 6px;
    font-size: 12.5px;
    line-height: 1.45;
    color: var(--tc-text);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .tc-section-title {
    margin-top: 12px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--tc-muted);
  }
  .tc-section-text { margin-top: 2px; }
  .tc-section-muted { margin-top: 2px; color: var(--tc-muted); }
  .tc-senses { margin: 2px 0 0; padding-left: 16px; }
  .tc-senses li { margin: 2px 0; }
  .tc-senses.tc-single { list-style: none; padding-left: 0; }
  .tc-entry-pos { margin-top: 8px; font-size: 11px; color: var(--tc-muted); font-style: italic; }
  .tc-lookup-formof {
    margin-top: 12px;
    padding: 6px 8px;
    background: var(--tc-surface-2);
    border-radius: 8px;
    color: var(--tc-text-2);
  }
  .tc-lookup-formof b { color: var(--tc-text); }
  .tc-lookup-formof .tc-section-muted { font-size: 11.5px; }

  .tc-lookup-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 0 2px;
    color: var(--tc-muted);
  }
  .tc-lookup-status .tc-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--tc-border);
    border-top-color: var(--tc-muted);
    border-radius: 50%;
    animation: tc-spin 0.8s linear infinite;
  }
  @keyframes tc-spin { to { transform: rotate(360deg); } }
  .tc-lookup-retry {
    margin-left: auto;
    padding: 3px 10px;
    font-size: 11px;
    border-radius: 999px;
    border: 1px solid var(--tc-border);
    background: var(--tc-surface-2);
    color: var(--tc-text-2);
    cursor: pointer;
  }
  .tc-lookup-retry:hover { background: var(--tc-surface-3); }

  /* Always visible under the scrollable body, so the buttons are never scrolled away. */
  .tc-lookup-footer { flex-shrink: 0; padding: 0 6px; }
  .tc-lookup-footer:empty { display: none; }
  .tc-lookup-footer .tc-section-title { margin-top: 10px; }
  .tc-lookup-sources { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .tc-source-link {
    padding: 3px 10px;
    font-size: 11.5px;
    line-height: 1.4;
    border-radius: 999px;
    border: 1px solid var(--tc-border);
    background: var(--tc-surface-2);
    color: var(--tc-text-2);
    text-decoration: none;
    white-space: nowrap;
    -webkit-user-select: none;
    user-select: none;
  }
  .tc-source-link:hover { background: var(--tc-surface-3); color: var(--tc-text); }
  .tc-source-link:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 1px; }

  @keyframes tc-fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const ICON_LOOKUP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
const ICON_ANALYZE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 6H3"></path><path d="M10 12H3"></path><path d="M10 18H3"></path><circle cx="17" cy="15" r="3"></circle><path d="m21 19-1.9-1.9"></path></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
const ICON_SPEAKER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;
export const ICON_STAR =`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

const BUTTON_SIZE = 28;
const GAP = 6;
const EDGE = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/** Prevents the page from losing its selection/focus when our UI is pressed. */
function keepSelectionOnPress(el: HTMLElement) {
  el.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
}

export function ensureSelectionStyles(shadow: ShadowRoot) {
  if (shadow.querySelector('style[data-tc="selection"]')) return;
  const style = document.createElement('style');
  style.dataset.tc = 'selection';
  style.textContent = SELECTION_STYLES;
  shadow.appendChild(style);
}

/** `fromKeyboard`: activated with Enter/Space (US-16), so the card that opens should take focus. */
export type ActivateHandler = (fromKeyboard: boolean) => void;

function floatingButton(rect: DOMRect, title: string, icon: string, onActivate: ActivateHandler): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tc-lookup-btn';
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.innerHTML = icon;

  // Above the end of the selection; below it when there is no room at the top.
  const left = clamp(rect.right + 2, EDGE, window.innerWidth - BUTTON_SIZE - EDGE);
  let top = rect.top - BUTTON_SIZE - GAP;
  if (top < EDGE) top = rect.bottom + GAP;
  top = clamp(top, EDGE, window.innerHeight - BUTTON_SIZE - EDGE);
  btn.style.left = `${left}px`;
  btn.style.top = `${top}px`;

  keepSelectionOnPress(btn);
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Clicks from Enter/Space on a focused button have no pointer position (detail 0).
    onActivate(e.detail === 0);
  });
  return btn;
}

/** Small floating button shown at the end of a word selection. */
export function createLookupButton(info: SelectionInfo, t: Translations, onActivate: ActivateHandler): HTMLButtonElement {
  return floatingButton(info.rect, t.lookupButtonTitle, ICON_LOOKUP, onActivate);
}

/**
 * Floating button shown at the end of a sentence selection: opens the grammar analysis
 * (US-17), whose card offers "Ask the assistant" (US-15).
 */
export function createAnalyzeButton(rect: DOMRect, t: Translations, onActivate: ActivateHandler): HTMLButtonElement {
  return floatingButton(rect, t.analyzeButtonTitle, ICON_ANALYZE, onActivate);
}

export interface CardBarOptions {
  sourceLabel: string;
  sourceUrl?: string;
  t: Translations;
  onToggleStar?: () => void;
  onClose?: () => void;
}

/** Grey pill at the top of a card: star, source label (link), close. */
export function createCardBar(opts: CardBarOptions): HTMLDivElement {
  const bar = document.createElement('div');
  bar.className = 'tc-card-bar';

  if (opts.onToggleStar) {
    const star = document.createElement('button');
    star.type = 'button';
    star.className = 'tc-card-iconbtn tc-card-star';
    star.innerHTML = ICON_STAR;
    setStarState(star, false, opts.t);
    star.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      opts.onToggleStar?.();
    });
    bar.append(star);
  }

  const source = document.createElement(opts.sourceUrl ? 'a' : 'span');
  source.className = 'tc-card-source';
  source.textContent = opts.sourceLabel;
  if (source instanceof HTMLAnchorElement && opts.sourceUrl) {
    source.href = opts.sourceUrl;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.title = opts.t.openSource;
  }
  bar.append(source);

  if (opts.onClose) {
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'tc-card-iconbtn';
    close.title = opts.t.close;
    close.setAttribute('aria-label', opts.t.close);
    close.innerHTML = ICON_CLOSE;
    close.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      opts.onClose?.();
    });
    bar.append(close);
  }
  return bar;
}

/** ☆ state (US-06): saved words show "Saved"; clicking then opens the note editor. */
export function setStarState(star: HTMLElement, saved: boolean, t: Translations) {
  star.setAttribute('aria-pressed', String(saved));
  const label = saved ? t.vocabSavedHint : t.vocabSave;
  star.title = label;
  star.setAttribute('aria-label', label);
  let text = star.querySelector<HTMLElement>('.tc-star-label');
  if (!text) {
    text = document.createElement('span');
    text.className = 'tc-star-label';
    star.append(text);
  }
  text.textContent = saved ? t.vocabSaved : '';
  text.hidden = !saved;
}

export interface VocabEditorOptions {
  t: Translations;
  /** Sentence the word was saved with. */
  context: string | null;
  note: string;
  onSaveNote: (note: string) => Promise<void>;
  onRemove: () => Promise<void>;
}

/** Note editor shown under the head of a saved word's card (US-06). */
export function showVocabEditor(card: HTMLElement, opts: VocabEditorOptions): HTMLElement {
  hideVocabEditor(card);
  const { t } = opts;
  const panel = el('div', 'tc-vocab-panel');
  if (opts.context) {
    panel.append(el('div', 'tc-section-title', t.vocabContext), el('div', 'tc-vocab-context', `« ${opts.context} »`));
  }
  const label = el('label', 'tc-section-title', t.vocabNote);
  const note = el('textarea', 'tc-vocab-note');
  note.rows = 3;
  note.maxLength = 1000;
  note.placeholder = t.vocabNotePlaceholder;
  note.value = opts.note;
  note.id = 'tc-vocab-note';
  label.htmlFor = note.id;
  // Keystrokes typed here must not reach page shortcuts (the shadow host bubbles them).
  for (const type of ['keydown', 'keyup', 'keypress'] as const) {
    note.addEventListener(type, (e) => {
      if ((e as KeyboardEvent).key !== 'Escape') e.stopPropagation();
    });
  }

  const status = el('span', 'tc-vocab-status');
  status.setAttribute('role', 'status');
  const save = el('button', 'tc-vocab-btn tc-vocab-primary', t.vocabSaveNote);
  save.type = 'button';
  const remove = el('button', 'tc-vocab-btn', t.vocabRemove);
  remove.type = 'button';
  const run = async (button: HTMLButtonElement, task: () => Promise<void>, done: string) => {
    button.disabled = true;
    status.textContent = '';
    try {
      await task();
      status.textContent = done;
    } catch {
      status.textContent = t.vocabSaveFailed;
    } finally {
      button.disabled = false;
    }
  };
  save.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    void run(save, () => opts.onSaveNote(note.value.trim()), t.vocabNoteSaved);
  });
  remove.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    void run(remove, opts.onRemove, '');
  });
  const actions = el('div', 'tc-vocab-actions');
  actions.append(save, remove, status);
  panel.append(label, note, actions);
  card.querySelector('.tc-lookup-head')?.after(panel);
  return panel;
}

export function hideVocabEditor(card: HTMLElement) {
  card.querySelector('.tc-vocab-panel')?.remove();
}

export function isVocabEditorOpen(card: HTMLElement): boolean {
  return !!card.querySelector('.tc-vocab-panel');
}

/**
 * Lookup card anchored under the selection: top bar, head (word + meta line) and a
 * body filled by `renderLookupLoading` / `renderLookupResponse`.
 */
export function createLookupCard(
  info: SelectionInfo,
  t: Translations,
  onClose: () => void,
  onToggleStar: () => void
): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'tc-lookup-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', info.text);
  // Focusable itself, so a card opened from the keyboard can take focus while it loads (US-16).
  card.tabIndex = -1;

  const bar = createCardBar({ sourceLabel: `Wiktionary/${info.text}`, t, onClose, onToggleStar });
  const star = bar.querySelector('.tc-card-star') as HTMLElement;
  star.hidden = true; // shown once the word is resolved

  const head = document.createElement('div');
  head.className = 'tc-lookup-head';
  const word = document.createElement('div');
  word.className = 'tc-lookup-word';
  word.textContent = info.text;
  const meta = document.createElement('div');
  meta.className = 'tc-lookup-meta';
  meta.hidden = true;
  // US-04: 🔊 next to the word, shown once the lookup tells what can be played.
  const speak = document.createElement('button');
  speak.type = 'button';
  speak.className = 'tc-card-iconbtn tc-lookup-speak';
  speak.innerHTML = ICON_SPEAKER;
  speak.title = t.lookupSpeak;
  speak.setAttribute('aria-label', t.lookupSpeak);
  speak.hidden = true;
  const wordRow = document.createElement('div');
  wordRow.className = 'tc-lookup-wordrow';
  wordRow.append(word, speak);
  head.append(wordRow, meta);

  const body = document.createElement('div');
  body.className = 'tc-lookup-body';
  const footer = document.createElement('div');
  footer.className = 'tc-lookup-footer';

  card.append(bar, head, body, footer);
  // Pressing the top bar or a control keeps the page selection; the word, meta line and
  // body stay selectable so definitions can be copied.
  card.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    const target = e.target as Element | null;
    if (target?.closest('.tc-card-bar, button, a')) e.preventDefault();
  });
  return card;
}

// --- card content ------------------------------------------------------------

const MAX_ENTRIES_SHOWN = 3;
const MAX_SENSES_SHOWN = 3;
const MAX_EXAMPLES_SHOWN = 2;
const MAX_EXAMPLE_CHARS = 160;
const MAX_ETYMOLOGY_CHARS = 260;

/** Gender as written in French dictionaries; the card's content language is French. */
const GENDER_LABEL: Record<Gender, string> = { m: 'masculin', f: 'féminin', mf: 'masculin et féminin' };

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function cardBody(card: HTMLElement): HTMLElement {
  return card.querySelector('.tc-lookup-body') as HTMLElement;
}

function setFooter(card: HTMLElement, nodes: HTMLElement[]) {
  card.querySelector('.tc-lookup-footer')?.replaceChildren(...nodes);
}

/** Replaces the external dictionary buttons only (e.g. after the settings changed). */
export function renderSourceLinks(card: HTMLElement, links: SourceLink[], t: Translations) {
  setFooter(card, sourceLinksSection(links, t));
}

/** Body with a single message (e.g. a context-menu selection too long to look up). */
export function renderLookupMessage(card: HTMLElement, message: string) {
  cardBody(card).replaceChildren(el('div', 'tc-lookup-status', message));
  setFooter(card, []);
}

export function renderLookupLoading(card: HTMLElement, t: Translations) {
  const status = el('div', 'tc-lookup-status');
  status.append(el('div', 'tc-spinner'), el('span', undefined, t.lookupLoading));
  cardBody(card).replaceChildren(status);
  setFooter(card, []);
}

function metaLine(entry: DictionaryEntry | undefined, ipa: string | null): HTMLElement[] {
  const parts: HTMLElement[] = [];
  if (entry) parts.push(el('span', undefined, entry.pos));
  const shownIpa = ipa ?? entry?.ipa ?? null;
  if (shownIpa) parts.push(el('span', 'tc-ipa', `/${shownIpa}/`));
  if (entry?.gender) parts.push(el('span', undefined, GENDER_LABEL[entry.gender]));
  const out: HTMLElement[] = [];
  parts.forEach((p, i) => {
    if (i > 0) out.push(el('span', undefined, ' · '));
    out.push(p);
  });
  return out;
}

function sensesList(entry: DictionaryEntry): HTMLElement {
  const senses = entry.senses.slice(0, MAX_SENSES_SHOWN);
  const list = el('ol', senses.length === 1 ? 'tc-senses tc-single' : 'tc-senses');
  for (const sense of senses) list.append(el('li', undefined, sense.definition));
  return list;
}

function section(title: string, ...content: HTMLElement[]): HTMLElement[] {
  return [el('div', 'tc-section-title', title), ...content];
}

function renderResult(card: HTMLElement, result: LookupResult, t: Translations): HTMLElement[] {
  const entries = result.entries.slice(0, MAX_ENTRIES_SHOWN);
  const first = entries[0];

  (card.querySelector('.tc-lookup-word') as HTMLElement).textContent = result.formOf ? result.word : result.lemma;
  const meta = card.querySelector('.tc-lookup-meta') as HTMLElement;
  meta.replaceChildren(...metaLine(first, result.ipa));
  meta.hidden = meta.childElementCount === 0;
  const source = card.querySelector('.tc-card-source') as HTMLAnchorElement;
  source.textContent = `Wiktionary/${result.lemma}`;
  if (source instanceof HTMLAnchorElement) source.href = result.sourceUrl;

  const nodes: HTMLElement[] = [];
  if (result.formOf) {
    const formOf = el('div', 'tc-lookup-formof');
    formOf.append(`${t.lookupFormOf} `, el('b', undefined, result.formOf.lemma));
    formOf.append(el('div', 'tc-section-muted', result.formOf.description));
    nodes.push(formOf);
  }

  if (entries.length > 0) {
    const definition: HTMLElement[] = [];
    entries.forEach((entry, i) => {
      if (i > 0) {
        const pos = [entry.pos, entry.gender ? GENDER_LABEL[entry.gender] : ''].filter(Boolean).join(' · ');
        definition.push(el('div', 'tc-entry-pos', pos));
      }
      definition.push(sensesList(entry));
    });
    nodes.push(...section(t.cardDefinition, ...definition));
  }

  const examples = entries
    .flatMap((e) => e.senses.slice(0, MAX_SENSES_SHOWN))
    .map((s) => s.example)
    .filter((x): x is string => !!x)
    .slice(0, MAX_EXAMPLES_SHOWN);
  if (examples.length > 0) {
    nodes.push(
      ...section(t.cardExample, ...examples.map((x) => el('div', 'tc-section-text', truncate(x, MAX_EXAMPLE_CHARS))))
    );
  }

  if (result.etymology) {
    nodes.push(...section(t.cardEtymology, el('div', 'tc-section-text', truncate(result.etymology, MAX_ETYMOLOGY_CHARS))));
  }

  if (result.english.length > 0) {
    const lines = result.english.map((gloss) =>
      el('div', 'tc-section-muted', `${gloss.pos.toLowerCase()} — ${gloss.definitions.join('; ')}`)
    );
    nodes.push(...section(t.cardTranslations, ...lines));
  }
  return nodes;
}

/** US-03: row of buttons opening the word in other dictionaries (new tab). */
export function sourceLinksSection(links: SourceLink[], t: Translations): HTMLElement[] {
  if (links.length === 0) return [];
  const row = el('div', 'tc-lookup-sources');
  for (const link of links) {
    const a = el('a', 'tc-source-link', link.label);
    a.href = link.href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = t.lookupOpenIn(link.label);
    a.dataset.source = link.id;
    // Keep the card open: the page-level mousedown handler must not see this press.
    a.addEventListener('click', (e) => e.stopPropagation());
    row.append(a);
  }
  return section(t.lookupSourcesTitle, row);
}

/**
 * Renders a lookup response. `links` builds the external dictionary buttons for the
 * word to open (the lemma when found, otherwise the normalized selection).
 */
export function renderLookupResponse(
  card: HTMLElement,
  response: LookupResponse,
  t: Translations,
  onRetry: () => void,
  links: (word: string) => SourceLink[] = () => []
) {
  const body = cardBody(card);
  const star = card.querySelector('.tc-card-star') as HTMLElement | null;
  if (response.status === 'ok') {
    body.replaceChildren(...renderResult(card, response.result, t));
    setFooter(card, sourceLinksSection(links(response.result.lemma), t));
    if (star) star.hidden = false;
    return;
  }
  if (star) star.hidden = true;
  const status = el('div', 'tc-lookup-status');
  if (response.status === 'not_found') {
    status.textContent = t.lookupNotFound(response.word);
  } else {
    status.append(el('span', undefined, t.lookupError));
    const retry = el('button', 'tc-lookup-retry', t.lookupRetry);
    retry.type = 'button';
    retry.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onRetry();
    });
    status.append(retry);
  }
  // Not on Wiktionary (or unreachable): the other dictionaries may still have it.
  body.replaceChildren(status);
  setFooter(card, sourceLinksSection(links(response.word), t));
}

/** Places the card below the selection, or above it when it would overflow the viewport. */
export function positionLookupCard(card: HTMLElement, anchor: DOMRect) {
  const width = card.offsetWidth || 340;
  const height = card.offsetHeight || 140;
  const left = clamp(anchor.left, EDGE, window.innerWidth - width - EDGE);
  let top = anchor.bottom + GAP;
  if (top + height > window.innerHeight - EDGE) {
    top = anchor.top - height - GAP;
  }
  top = clamp(top, EDGE, Math.max(EDGE, window.innerHeight - height - EDGE));
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}
