import type { Translations } from '@/lib/i18n';
import type { UILanguage } from '@/types';
import { getSuggestionColor } from '@/lib/utils';
import { BACKEND_START_COMMAND } from './types';
import { errorSegments, errorSuggestionType, MAX_PRACTICE_CHARS, type PracticeError, type PracticeReply, type PracticeResult } from './practice';

/**
 * "Write a sentence" inside the grammar card (US-19): a field (Enter sends), then the
 * feedback: structure used or not, errors underlined like the grammar check, the
 * correction and explanations. "Try again" keeps the sentence, "Keep reading" closes.
 */
export const PRACTICE_STYLES = `
  .tc-practice { margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--tc-border); }
  .tc-practice-label { display: block; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--tc-muted); }
  .tc-practice-input {
    display: block;
    box-sizing: border-box;
    width: 100%;
    margin-top: 4px;
    padding: 7px 9px;
    font: inherit;
    font-size: 13px;
    line-height: 1.45;
    color: var(--tc-text);
    background: var(--tc-surface);
    border: 1px solid var(--tc-border-strong);
    border-radius: 10px;
    resize: vertical;
  }
  .tc-practice-input:focus { outline: 2px solid var(--tc-accent); outline-offset: 0; }
  .tc-practice-input:disabled { opacity: 0.6; }
  .tc-practice-row { display: flex; align-items: center; gap: 8px; margin-top: 5px; }
  .tc-practice-hint { flex: 1; font-size: 10.5px; color: var(--tc-faint); }
  .tc-practice-send { background: var(--tc-text); border-color: var(--tc-text); color: var(--tc-surface); }
  .tc-practice-send:hover { background: var(--tc-text-2); color: var(--tc-surface); }
  .tc-practice-result { margin-top: 10px; }
  .tc-practice-result:empty { display: none; }
  .tc-practice-verdict { font-weight: 600; font-size: 12.5px; }
  .tc-practice-verdict.tc-ok { color: var(--tc-success); }
  .tc-practice-verdict.tc-bad { color: var(--tc-danger); }
  .tc-practice-sentence { margin-top: 6px; padding: 6px 9px; background: var(--tc-surface-2); border-radius: 8px; line-height: 1.7; }
  .tc-practice-err { text-decoration-line: underline; text-decoration-thickness: 3px; text-underline-offset: 4px; text-decoration-skip-ink: none; }
  .tc-practice-fix { margin-top: 6px; }
  .tc-practice-fix b { font-weight: 600; color: var(--tc-text-2); }
  .tc-practice-errors { margin: 6px 0 0; padding-left: 16px; }
  .tc-practice-errors li { margin: 3px 0; }
  .tc-practice-span { font-weight: 600; }
  .tc-practice-note { margin-top: 6px; font-size: 11.5px; color: var(--tc-muted); font-style: italic; }
  .tc-practice-lang { margin-left: 4px; font-size: 10px; color: var(--tc-faint); font-style: normal; }
`;

export function ensurePracticeStyles(shadow: ShadowRoot) {
  if (shadow.querySelector('style[data-tc="practice"]')) return;
  const style = document.createElement('style');
  style.dataset.tc = 'practice';
  style.textContent = PRACTICE_STYLES;
  shadow.appendChild(style);
}

export interface PracticeContext {
  t: Translations;
  lang: UILanguage;
  ruleName: string;
  formula: string;
  submit: (sentence: string) => Promise<PracticeReply>;
  onOpenSettings: () => void;
  /** "Keep reading": close the card. */
  onDone: () => void;
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

/** Explanation of an error in the interface language when the backend only has rule-check texts. */
function explain(error: PracticeError, result: PracticeResult, ctx: PracticeContext): { text: string; tag: string | null } {
  const { t } = ctx;
  if (!result.aiFeedback) {
    if (error.type === 'conjugation') return { text: t.practiceErrConjugation(result.check.auxiliary ?? error.span, result.check.subject), tag: null };
    if (error.type === 'infinitive') return { text: t.practiceErrInfinitive(result.check.infinitive ?? error.span), tag: null };
    if (error.type === 'missing_construct') return { text: t.practiceErrMissing(ctx.ruleName, ctx.formula), tag: null };
  }
  // Model feedback is written in Vietnamese by the backend.
  return { text: error.explanation, tag: ctx.lang === 'vi' || !error.explanation ? null : 'VI' };
}

function renderResult(box: HTMLElement, result: PracticeResult, ctx: PracticeContext, actions: HTMLElement[]) {
  const { t } = ctx;
  const nodes: HTMLElement[] = [];
  const verdict = result.isCorrect
    ? el('div', 'tc-practice-verdict tc-ok', `✓ ${t.practiceCorrect}`)
    : el('div', 'tc-practice-verdict tc-bad', result.usesConstruct ? t.practiceUsesWithErrors : t.practiceMissing(ctx.ruleName));
  nodes.push(verdict);

  // The sentence with its errors underlined (same colours as the grammar check).
  const sentence = el('div', 'tc-practice-sentence');
  for (const seg of errorSegments(result.sentence, result.errors)) {
    if (!seg.error) {
      sentence.append(document.createTextNode(seg.text));
      continue;
    }
    const mark = el('span', 'tc-practice-err', seg.text);
    mark.style.textDecorationColor = getSuggestionColor(errorSuggestionType(seg.error.type));
    mark.title = seg.error.suggestion ? `→ ${seg.error.suggestion}` : seg.error.type;
    sentence.append(mark);
  }
  nodes.push(sentence);

  if (result.corrected) {
    const fix = el('div', 'tc-practice-fix');
    fix.append(el('b', undefined, `${t.practiceCorrection}: `), document.createTextNode(result.corrected));
    nodes.push(fix);
  }

  if (result.errors.length > 0) {
    const list = el('ul', 'tc-practice-errors');
    for (const e of result.errors) {
      const item = el('li');
      if (e.type !== 'missing_construct' && e.span) {
        item.append(el('span', 'tc-practice-span', `« ${e.span} »`));
        if (e.suggestion && e.suggestion !== e.span) item.append(document.createTextNode(` → ${e.suggestion}`));
        item.append(document.createTextNode(' · '));
      }
      const { text, tag } = explain(e, result, ctx);
      item.append(document.createTextNode(text));
      if (tag) item.append(el('span', 'tc-practice-lang', tag));
      list.append(item);
    }
    nodes.push(list);
  }

  if (result.aiFeedback) {
    if (result.comment) {
      const comment = el('div', 'tc-section-text tc-practice-comment', result.comment);
      if (ctx.lang !== 'vi') comment.append(el('span', 'tc-practice-lang', 'VI'));
      nodes.push(comment);
    }
  } else {
    nodes.push(el('div', 'tc-practice-note', t.practiceNoAi));
  }
  const row = el('div', 'tc-analysis-actions');
  row.append(...actions);
  nodes.push(row);
  box.replaceChildren(...nodes);
}

/**
 * Shows the practice field at the end of the card body (once) and focuses it.
 * Returns the field.
 */
export function showPractice(card: HTMLElement, ctx: PracticeContext): HTMLTextAreaElement {
  const existing = card.querySelector<HTMLTextAreaElement>('.tc-practice-input');
  if (existing) {
    existing.focus();
    existing.scrollIntoView({ block: 'nearest' });
    return existing;
  }
  const { t } = ctx;
  const section = el('div', 'tc-practice');
  const label = el('label', 'tc-practice-label', t.practiceTitle);
  const input = el('textarea', 'tc-practice-input');
  input.id = 'tc-practice-input';
  label.htmlFor = input.id;
  input.rows = 2;
  input.maxLength = MAX_PRACTICE_CHARS;
  input.placeholder = t.practicePlaceholder(ctx.ruleName);
  input.spellcheck = false;
  input.lang = 'fr';
  const hint = el('span', 'tc-practice-hint', t.practiceHint);
  const send = button('tc-analysis-btn tc-practice-send', t.practiceSend, () => void submit());
  const row = el('div', 'tc-practice-row');
  row.append(hint, send);
  const result = el('div', 'tc-practice-result');
  result.setAttribute('aria-live', 'polite');
  section.append(label, input, row, result);
  (card.querySelector('.tc-lookup-body') as HTMLElement).append(section);
  // The field is open: the footer's "Write a sentence" button has done its job.
  card.querySelector('.tc-rule-practice')?.closest('.tc-analysis-actions')?.remove();

  let busy = false;
  const retry = () => {
    result.replaceChildren();
    input.disabled = false;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  };

  async function submit() {
    const sentence = input.value.replace(/\s+/g, ' ').trim();
    if (!sentence || busy) {
      input.focus();
      return;
    }
    busy = true;
    input.disabled = true;
    send.disabled = true;
    const status = el('div', 'tc-lookup-status');
    status.append(el('div', 'tc-spinner'), el('span', undefined, t.practiceChecking));
    result.replaceChildren(status);
    let reply: PracticeReply;
    try {
      reply = await ctx.submit(sentence);
    } catch (error) {
      reply = { status: 'error', backendUrl: '', httpStatus: null, message: error instanceof Error ? error.message : String(error) };
    }
    busy = false;
    send.disabled = false;
    if (!card.isConnected) return;
    const again = button('tc-analysis-btn tc-practice-retry', t.practiceRetry, retry);
    if (reply.status === 'ok') {
      const done = button('tc-analysis-btn tc-practice-done', t.practiceDone, ctx.onDone);
      renderResult(result, reply.result, ctx, [again, done]);
      again.focus({ preventScroll: true });
      result.scrollIntoView({ block: 'nearest' });
      return;
    }
    // Not graded: the field stays editable so the sentence can be sent again.
    input.disabled = false;
    const nodes: HTMLElement[] = [];
    if (reply.status === 'unreachable') {
      nodes.push(el('div', 'tc-lookup-status tc-analysis-error', t.analysisUnreachable(reply.backendUrl)));
      const help = el('div', 'tc-analysis-help', t.analysisStartHint);
      help.append(el('code', undefined, BACKEND_START_COMMAND));
      nodes.push(help);
      const row = el('div', 'tc-analysis-actions');
      row.append(button('tc-analysis-btn tc-analysis-settings', t.analysisOpenSettings, ctx.onOpenSettings));
      nodes.push(row);
    } else {
      const text = reply.message === 'timeout' ? t.analysisTimeout : t.analysisBackendError(reply.httpStatus, reply.message);
      nodes.push(el('div', 'tc-lookup-status tc-analysis-error', text));
    }
    result.replaceChildren(...nodes);
    input.focus();
  }

  // Enter sends, Shift+Enter is a new line; keys typed here must not reach page shortcuts.
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      e.stopPropagation();
      void submit();
      return;
    }
    if (e.key !== 'Escape' && e.key !== 'Tab') e.stopPropagation();
  });
  for (const type of ['keyup', 'keypress'] as const) {
    input.addEventListener(type, (e) => {
      if ((e as KeyboardEvent).key !== 'Escape') e.stopPropagation();
    });
  }

  input.focus();
  section.scrollIntoView({ block: 'nearest' });
  return input;
}
