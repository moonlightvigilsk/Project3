import type { Translations } from '@/lib/i18n';
import type { UILanguage } from '@/types';
import { createCardBar } from '@/lib/selection/lookup-ui';
import { sentenceSegments } from './segments';
import { BACKEND_START_COMMAND, type DetectedStructure } from './types';
import { catalogExamples, EXAMPLES_PER_PAGE, explanationFor, type GrammarRuleReply, type RuleExample } from './rule';

/**
 * Grammar card of one structure (US-18), opened from the analysis card: same frame as
 * the word card (bar ☆ grammar/<id> ×, name, meta line, sections), styles in
 * ANALYSIS_STYLES (analysis-ui.ts) and SELECTION_STYLES (lookup-ui.ts).
 */
export const RULE_STYLES = `
  .tc-rule-card { max-height: min(80vh, 600px); }
  .tc-rule-card .tc-lookup-head { padding-top: 8px; }
  .tc-rule-back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin: 0 0 6px -2px;
    padding: 2px 6px;
    font: inherit;
    font-size: 11.5px;
    color: var(--tc-muted);
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }
  .tc-rule-back:hover { color: var(--tc-text); background: var(--tc-surface-2); }
  .tc-rule-back:focus-visible { outline: 2px solid var(--tc-accent); outline-offset: 1px; }
  .tc-rule-name { font-size: 18px; font-weight: 700; line-height: 1.25; color: var(--tc-text); }
  .tc-rule-form {
    margin-top: 8px;
    padding: 6px 10px;
    font-size: 12.5px;
    background: var(--tc-surface-2);
    border-radius: 8px;
    color: var(--tc-text);
  }
  .tc-rule-form b { font-weight: 600; color: var(--tc-text-2); }
  .tc-rule-list { margin: 2px 0 0; padding-left: 16px; }
  .tc-rule-list li { margin: 2px 0; }
  .tc-rule-patterns { list-style: none; padding-left: 0; font-size: 12px; color: var(--tc-text-2); }
  .tc-rule-examples { list-style: none; margin: 2px 0 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
  .tc-rule-example-note { display: block; font-size: 11px; color: var(--tc-muted); }
  .tc-rule-context {
    padding: 6px 8px;
    border-left: 3px solid var(--tc-accent);
    background: var(--tc-accent-soft);
    border-radius: 0 8px 8px 0;
  }
  .tc-rule-context-label { display: block; font-size: 10.5px; color: var(--tc-muted); margin-bottom: 1px; }
  .tc-rule-context mark { background: transparent; color: inherit; font-weight: 600; text-decoration: underline; text-decoration-color: var(--tc-accent); text-underline-offset: 3px; }
  .tc-rule-lang { margin-left: 4px; font-size: 10px; color: var(--tc-faint); text-transform: none; letter-spacing: 0; font-weight: 500; }
  .tc-rule-more { margin-top: 6px; }
`;

export function ensureRuleStyles(shadow: ShadowRoot) {
  if (shadow.querySelector('style[data-tc="rule"]')) return;
  const style = document.createElement('style');
  style.dataset.tc = 'rule';
  style.textContent = RULE_STYLES;
  shadow.appendChild(style);
}

export interface RuleCardHandlers {
  onClose: () => void;
  /** Back to the analysis of the sentence. */
  onBack: () => void;
  onRetry: () => void;
  onOpenSettings: () => void;
  onToggleStar: () => void;
  /** Catalog examples used up: ask the assistant for more (only when AI is on). */
  onMoreFromAssistant?: () => void;
  /** "Write a sentence" (US-19); the button is shown only when given. */
  onPractice?: () => void;
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

const section = (title: string, ...content: HTMLElement[]) => [el('div', 'tc-section-title', title), ...content];

const body = (card: HTMLElement) => card.querySelector('.tc-lookup-body') as HTMLElement;
const footer = (card: HTMLElement) => card.querySelector('.tc-lookup-footer') as HTMLElement;

/** Card frame for `structure`; filled by renderRuleLoading / renderRuleReply. */
export function createRuleCard(structure: DetectedStructure, t: Translations, handlers: RuleCardHandlers): HTMLDivElement {
  const card = el('div', 'tc-lookup-card tc-analysis-card tc-rule-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', structure.name);
  card.tabIndex = -1;
  card.dataset.rule = structure.ruleId;

  const bar = createCardBar({ sourceLabel: `grammar/${structure.ruleId}`, t, onClose: handlers.onClose, onToggleStar: handlers.onToggleStar });
  (bar.querySelector('.tc-card-star') as HTMLElement).hidden = true; // shown once the rule is loaded

  const head = el('div', 'tc-lookup-head');
  const back = button('tc-rule-back', `← ${t.ruleBack}`, handlers.onBack);
  const meta = el('div', 'tc-lookup-meta', structure.level ?? '');
  meta.hidden = !structure.level;
  head.append(back, el('div', 'tc-rule-name', structure.name), meta);

  card.append(bar, head, el('div', 'tc-lookup-body'), el('div', 'tc-lookup-footer'));
  card.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    const target = e.target as Element | null;
    if (target?.closest('.tc-card-bar, button, a')) e.preventDefault();
  });
  return card;
}

export function renderRuleLoading(card: HTMLElement, t: Translations) {
  const status = el('div', 'tc-lookup-status');
  status.append(el('div', 'tc-spinner'), el('span', undefined, t.lookupLoading));
  body(card).replaceChildren(status);
  footer(card).replaceChildren();
}

/** The page sentence, with the words of the structure underlined. */
function contextExample(sentence: string, structure: DetectedStructure, t: Translations): HTMLElement {
  const item = el('li', 'tc-rule-context');
  item.append(el('span', 'tc-rule-context-label', t.ruleContextExample));
  const text = el('span', 'tc-rule-example-text');
  text.append(
    ...sentenceSegments(sentence, [structure]).map((seg) =>
      seg.ruleIds.length > 0 ? el('mark', undefined, seg.text) : document.createTextNode(seg.text)
    )
  );
  item.append(text);
  return item;
}

function exampleItem(example: RuleExample): HTMLElement {
  const item = el('li', 'tc-rule-example');
  item.append(el('span', 'tc-rule-example-text', example.text));
  if (example.note) item.append(el('span', 'tc-rule-example-note', example.note));
  return item;
}

const LANGUAGE_TAG: Record<UILanguage, string> = { vi: 'VI', en: 'EN', fr: 'FR' };

export interface RuleRenderContext {
  t: Translations;
  lang: UILanguage;
  structure: DetectedStructure;
  /** Analyzed page sentence (shown first as an example), null when unknown. */
  sentence: string | null;
  handlers: RuleCardHandlers;
}

export function renderRuleReply(card: HTMLElement, reply: GrammarRuleReply, ctx: RuleRenderContext) {
  const { t, handlers } = ctx;
  const star = card.querySelector<HTMLElement>('.tc-card-star');
  if (reply.status !== 'ok') {
    if (star) star.hidden = true;
    const nodes: HTMLElement[] = [];
    const actions = el('div', 'tc-analysis-actions');
    if (reply.status === 'not_found') {
      nodes.push(el('div', 'tc-lookup-status', t.ruleNotFound));
    } else if (reply.status === 'unreachable') {
      nodes.push(el('div', 'tc-lookup-status tc-analysis-error', t.analysisUnreachable(reply.backendUrl)));
      const help = el('div', 'tc-analysis-help', t.analysisStartHint);
      help.append(el('code', undefined, BACKEND_START_COMMAND));
      nodes.push(help);
      actions.append(
        button('tc-analysis-btn tc-analysis-retry', t.lookupRetry, handlers.onRetry),
        button('tc-analysis-btn tc-analysis-settings', t.analysisOpenSettings, handlers.onOpenSettings)
      );
    } else {
      const text = reply.message === 'timeout' ? t.analysisTimeout : t.analysisBackendError(reply.httpStatus, reply.message);
      nodes.push(el('div', 'tc-lookup-status tc-analysis-error', text));
      actions.append(button('tc-analysis-btn tc-analysis-retry', t.lookupRetry, handlers.onRetry));
    }
    // The page sentence is still useful as an example of the structure.
    if (ctx.sentence && reply.status === 'not_found') {
      const list = el('ul', 'tc-rule-examples');
      list.append(contextExample(ctx.sentence, ctx.structure, t));
      nodes.push(...section(t.cardExamples, list));
    }
    body(card).replaceChildren(...nodes);
    footer(card).replaceChildren(...(actions.childElementCount ? [actions] : []));
    return;
  }

  const { rule } = reply;
  if (star) star.hidden = false;
  card.querySelector('.tc-rule-name')!.textContent = rule.name;
  const meta = card.querySelector<HTMLElement>('.tc-lookup-meta');
  if (meta) {
    meta.textContent = [rule.level, rule.category].filter(Boolean).join(' · ');
    meta.hidden = !meta.textContent;
  }
  const source = card.querySelector('.tc-card-source');
  if (source && rule.links[0]) {
    const a = el('a', 'tc-card-source', `grammar/${rule.id}`);
    a.href = rule.links[0].url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = rule.links[0].title;
    a.addEventListener('click', (e) => e.stopPropagation());
    source.replaceWith(a);
  }

  const nodes: HTMLElement[] = [];
  if (rule.formula) {
    const form = el('div', 'tc-rule-form');
    form.append(el('b', undefined, `${t.cardForm}:`), document.createTextNode(' ' + rule.formula));
    nodes.push(form);
  }

  const explanation = explanationFor(rule, ctx.lang);
  if (explanation) {
    const title = el('div', 'tc-section-title', t.ruleExplanation);
    if (explanation.lang !== ctx.lang) title.append(el('span', 'tc-rule-lang', LANGUAGE_TAG[explanation.lang]));
    nodes.push(title, el('div', 'tc-section-text tc-rule-explanation', explanation.text));
  }

  if (rule.patterns.length > 0) {
    const list = el('ul', 'tc-rule-list tc-rule-patterns');
    for (const p of rule.patterns) list.append(el('li', undefined, p));
    nodes.push(...section(t.cardPatterns, list));
  }

  if (rule.keyPoints.length > 0) {
    const list = el('ul', 'tc-rule-list');
    for (const p of rule.keyPoints) list.append(el('li', undefined, p));
    nodes.push(...section(t.ruleKeyPoints, list));
  }

  // Examples: the page sentence first, then the catalog's, a few at a time.
  const examples = catalogExamples(rule, ctx.sentence);
  const list = el('ul', 'tc-rule-examples');
  list.setAttribute('aria-live', 'polite');
  if (ctx.sentence) list.append(contextExample(ctx.sentence, ctx.structure, t));
  let shown = 0;
  const more = el('div', 'tc-analysis-actions tc-rule-more');
  const showMore = () => {
    const next = examples.slice(shown, shown + EXAMPLES_PER_PAGE);
    for (const e of next) list.append(exampleItem(e));
    shown += next.length;
    const hadFocus = !!more.querySelector(':focus');
    more.replaceChildren();
    if (shown < examples.length) {
      more.append(button('tc-analysis-btn tc-rule-more-btn', t.ruleMoreExamples, showMore));
    } else if (handlers.onMoreFromAssistant) {
      more.append(button('tc-analysis-btn tc-rule-more-ai', t.ruleMoreFromAssistant, handlers.onMoreFromAssistant));
    }
    if (hadFocus) (more.querySelector('button') ?? (card as HTMLElement)).focus({ preventScroll: true });
  };
  showMore();
  if (list.childElementCount > 0) nodes.push(...section(t.cardExamples, list));
  if (more.childElementCount > 0) nodes.push(more);
  body(card).replaceChildren(...nodes);

  // Footer: practice (US-19) and "Read more" links.
  const foot: HTMLElement[] = [];
  if (handlers.onPractice) {
    const actions = el('div', 'tc-analysis-actions');
    actions.append(button('tc-analysis-btn tc-rule-practice', t.rulePractice, handlers.onPractice));
    foot.push(actions);
  }
  if (rule.links.length > 0) {
    const row = el('div', 'tc-lookup-sources');
    for (const link of rule.links) {
      const a = el('a', 'tc-source-link tc-rule-link', link.title);
      a.href = link.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.addEventListener('click', (e) => e.stopPropagation());
      row.append(a);
    }
    foot.push(...section(t.ruleReadMore, row));
  }
  footer(card).replaceChildren(...foot);
}

/** ☆ of the grammar card: saved in the bookmarks (listed in the side panel). */
export function setRuleStar(card: HTMLElement, saved: boolean, t: Translations) {
  const star = card.querySelector<HTMLElement>('.tc-card-star');
  if (!star) return;
  star.setAttribute('aria-pressed', String(saved));
  const label = saved ? t.bookmarkRemove : t.bookmarkAdd;
  star.title = label;
  star.setAttribute('aria-label', label);
}
