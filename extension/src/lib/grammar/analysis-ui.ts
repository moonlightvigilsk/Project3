import type { Translations } from '@/lib/i18n';
import { createCardBar } from '@/lib/selection/lookup-ui';
import { sentenceSegments } from './segments';
import { BACKEND_START_COMMAND, type AnalyzeGrammarReply, type DetectedStructure } from './types';

/**
 * Grammar analysis card (US-17): same frame as the word card (lookup-ui.ts), with the
 * sentence, its structures highlighted, and the list of structures with their level.
 */
export const ANALYSIS_STYLES = `
  .tc-analysis-card { width: 360px; }
  .tc-analysis-title { font-size: 20px; font-weight: 700; line-height: 1.3; color: var(--tc-text); }
  .tc-analysis-sentence {
    margin-top: 10px;
    padding: 8px 10px;
    font-size: 14px;
    line-height: 1.5;
    background: var(--tc-surface-2);
    border-radius: 10px;
    color: var(--tc-text);
  }
  .tc-analysis-sentence mark {
    background: var(--tc-accent-soft);
    color: inherit;
    border-radius: 3px;
    box-shadow: inset 0 -1.5px 0 var(--tc-accent);
    transition: background 0.12s, box-shadow 0.12s;
  }
  .tc-analysis-sentence mark.tc-dim { background: transparent; box-shadow: none; }
  .tc-structures { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .tc-structure {
    display: block;
    width: 100%;
    text-align: left;
    padding: 6px 8px;
    border: 1px solid var(--tc-border);
    border-radius: 10px;
    background: var(--tc-surface);
    color: var(--tc-text);
    font: inherit;
    cursor: pointer;
  }
  .tc-structure:hover { background: var(--tc-surface-2); border-color: var(--tc-border-strong); }
  .tc-structure:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 1px; }
  .tc-structure-row { display: flex; align-items: baseline; gap: 8px; }
  .tc-structure-row::after { content: '›'; color: var(--tc-muted); font-size: 15px; line-height: 1; }
  .tc-structure-name { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 600; }
  .tc-level {
    flex-shrink: 0;
    padding: 0 6px;
    font-size: 10.5px;
    font-weight: 600;
    line-height: 17px;
    border-radius: 999px;
    border: 1px solid var(--tc-border);
    color: var(--tc-text-2);
    background: var(--tc-surface-2);
  }
  .tc-structure-words { margin-top: 1px; font-size: 11.5px; color: var(--tc-muted); font-style: italic; }
  .tc-analysis-hint { margin-top: 8px; font-size: 11px; color: var(--tc-faint); }
  .tc-analysis-help { margin-top: 6px; font-size: 12px; color: var(--tc-text-2); }
  .tc-analysis-help code {
    display: block;
    margin-top: 4px;
    padding: 5px 8px;
    font: 11.5px ui-monospace, SFMono-Regular, Consolas, monospace;
    background: var(--tc-surface-2);
    border-radius: 6px;
    color: var(--tc-text);
    -webkit-user-select: all;
    user-select: all;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .tc-analysis-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .tc-analysis-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 11px;
    font: inherit;
    font-size: 11.5px;
    border-radius: 999px;
    border: 1px solid var(--tc-border);
    background: var(--tc-surface-2);
    color: var(--tc-text-2);
    cursor: pointer;
  }
  .tc-analysis-btn:hover { background: var(--tc-surface-3); color: var(--tc-text); }
  .tc-analysis-btn:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 1px; }
  .tc-analysis-btn svg { width: 13px; height: 13px; }
  .tc-analysis-error { color: var(--tc-danger); }
`;

const ICON_ASK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;

export function ensureAnalysisStyles(shadow: ShadowRoot) {
  if (shadow.querySelector('style[data-tc="analysis"]')) return;
  const style = document.createElement('style');
  style.dataset.tc = 'analysis';
  style.textContent = ANALYSIS_STYLES;
  shadow.appendChild(style);
}

export interface AnalysisCardHandlers {
  onClose: () => void;
  onRetry: () => void;
  onOpenSettings: () => void;
  onAsk: () => void;
  /** A structure is pointed at (hover / focus / pressed), or none (null): highlight its words. */
  onFocusRule: (ruleId: string | null) => void;
  /** A structure was clicked: open its grammar card (US-18). */
  onOpenRule: (structure: DetectedStructure) => void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', className, label);
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return b;
}

function body(card: HTMLElement): HTMLElement {
  return card.querySelector('.tc-lookup-body') as HTMLElement;
}

function footer(card: HTMLElement): HTMLElement {
  return card.querySelector('.tc-lookup-footer') as HTMLElement;
}

/** Card frame: bar, title, the sentence, a body (structures / status) and the actions. */
export function createAnalysisCard(sentence: string, t: Translations, handlers: AnalysisCardHandlers): HTMLDivElement {
  const card = el('div', 'tc-lookup-card tc-analysis-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', t.analysisTitle);
  card.tabIndex = -1;

  const bar = createCardBar({ sourceLabel: 'grammar/analyse', t, onClose: handlers.onClose });
  const head = el('div', 'tc-lookup-head');
  head.append(el('div', 'tc-analysis-title', t.analysisTitle));
  const text = el('div', 'tc-analysis-sentence');
  text.textContent = sentence;
  head.append(text);

  const ask = button('tc-analysis-btn tc-analysis-ask', t.askButtonTitle, handlers.onAsk);
  ask.insertAdjacentHTML('afterbegin', ICON_ASK);
  const actions = el('div', 'tc-analysis-actions');
  actions.append(ask);
  const foot = el('div', 'tc-lookup-footer');
  foot.append(actions);

  card.append(bar, head, el('div', 'tc-lookup-body'), foot);
  card.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    const target = e.target as Element | null;
    if (target?.closest('.tc-card-bar, button, a')) e.preventDefault();
  });
  return card;
}

export function renderAnalysisLoading(card: HTMLElement, t: Translations) {
  const status = el('div', 'tc-lookup-status');
  status.append(el('div', 'tc-spinner'), el('span', undefined, t.analysisLoading));
  body(card).replaceChildren(status);
  setActions(card, []);
}

/** Message only (no sentence to analyze). */
export function renderAnalysisMessage(card: HTMLElement, message: string) {
  card.querySelector('.tc-analysis-sentence')?.remove();
  body(card).replaceChildren(el('div', 'tc-lookup-status', message));
  footer(card).remove();
}

/** Extra buttons before "Ask the assistant". */
function setActions(card: HTMLElement, extra: HTMLElement[]) {
  const actions = card.querySelector('.tc-analysis-actions');
  if (!actions) return;
  const ask = actions.querySelector('.tc-analysis-ask');
  actions.replaceChildren(...extra, ...(ask ? [ask] : []));
}

/** The sentence with the words of every structure marked (`data-rules` lists their ids). */
function renderSentence(card: HTMLElement, sentence: string, structures: DetectedStructure[]) {
  const box = card.querySelector('.tc-analysis-sentence');
  if (!box) return;
  box.replaceChildren(
    ...sentenceSegments(sentence, structures).map((seg) => {
      if (seg.ruleIds.length === 0) return document.createTextNode(seg.text);
      const mark = el('mark', undefined, seg.text);
      mark.dataset.rules = seg.ruleIds.join(' ');
      return mark;
    })
  );
}

/** Dims the marks of the other structures while one is pointed at. */
export function showRuleInCard(card: HTMLElement, ruleId: string | null) {
  card.querySelectorAll<HTMLElement>('.tc-analysis-sentence mark').forEach((mark) => {
    const rules = (mark.dataset.rules ?? '').split(' ');
    mark.classList.toggle('tc-dim', ruleId !== null && !rules.includes(ruleId));
  });
}

function structureList(card: HTMLElement, structures: DetectedStructure[], t: Translations, handlers: AnalysisCardHandlers): HTMLElement {
  const list = el('ul', 'tc-structures');
  const point = (ruleId: string | null) => {
    showRuleInCard(card, ruleId);
    handlers.onFocusRule(ruleId);
  };
  for (const s of structures) {
    const item = el('li');
    const b = el('button', 'tc-structure');
    b.type = 'button';
    b.dataset.rule = s.ruleId;
    b.setAttribute('aria-haspopup', 'dialog');
    const row = el('div', 'tc-structure-row');
    row.append(el('span', 'tc-structure-name', s.name));
    if (s.level) {
      const level = el('span', 'tc-level', s.level);
      level.title = t.analysisLevel(s.level);
      level.setAttribute('aria-label', t.analysisLevel(s.level));
      row.append(level);
    }
    b.append(row, el('div', 'tc-structure-words', s.spans.map((x) => `« ${x.text} »`).join(' · ')));
    b.addEventListener('mouseenter', () => point(s.ruleId));
    b.addEventListener('mouseleave', () => point(null));
    b.addEventListener('focus', () => point(s.ruleId));
    b.addEventListener('blur', () => point(null));
    // US-18: the grammar card of the structure (explanation, formula, examples).
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handlers.onOpenRule(s);
    });
    item.append(b);
    list.append(item);
  }
  return list;
}

export function renderAnalysisReply(card: HTMLElement, reply: AnalyzeGrammarReply, t: Translations, handlers: AnalysisCardHandlers) {
  const content: HTMLElement[] = [];
  const retry = () => button('tc-analysis-btn tc-analysis-retry', t.lookupRetry, handlers.onRetry);

  if (reply.status === 'ok') {
    const { sentence, structures } = reply.analysis;
    renderSentence(card, sentence, structures);
    if (structures.length === 0) {
      content.push(el('div', 'tc-lookup-status', t.analysisNone));
    } else {
      content.push(el('div', 'tc-section-title', t.analysisStructures), structureList(card, structures, t, handlers));
      content.push(el('div', 'tc-analysis-hint', t.analysisHint));
    }
    body(card).replaceChildren(...content);
    setActions(card, []);
    return;
  }

  if (reply.status === 'unreachable') {
    const message = el('div', 'tc-lookup-status tc-analysis-error', t.analysisUnreachable(reply.backendUrl));
    const help = el('div', 'tc-analysis-help', t.analysisStartHint);
    help.append(el('code', undefined, BACKEND_START_COMMAND));
    content.push(message, help);
    const settings = button('tc-analysis-btn tc-analysis-settings', t.analysisOpenSettings, handlers.onOpenSettings);
    setActions(card, [retry(), settings]);
  } else {
    const text =
      reply.message === 'timeout' ? t.analysisTimeout : t.analysisBackendError(reply.httpStatus, reply.message);
    content.push(el('div', 'tc-lookup-status tc-analysis-error', text));
    setActions(card, [retry()]);
  }
  body(card).replaceChildren(...content);
}
