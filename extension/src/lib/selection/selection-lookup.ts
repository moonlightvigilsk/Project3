import { getT } from '@/lib/i18n';
import type { Settings, VocabEntry } from '@/types';
import type { LookupResponse, LookupResult } from '@/lib/dictionary/types';
import { buildSourceLinks } from '@/lib/dictionary/sources';
import { normalizeLookupQuery } from '@/lib/dictionary/normalize';
import { contextMenuQuery } from './context-menu';
import { commonsFileUrl } from '@/lib/dictionary/wiktionary';
import { createVoiceFinder, pronounce, speakFrench, stopOwnSpeech } from './pronunciation';
import { captureFocusOrigin, containsFocus, focusInto, trapFocus, type FocusOrigin } from '@/lib/focus';
import { getVocabEntry, saveWord, unsaveWord, updateVocabEntry } from '@/lib/vocabulary/client';
import { vocabDraftFromLookup, vocabId, type VocabDraft } from '@/lib/vocabulary/model';
import {
  getSelectionInfo,
  getSentenceAtCaret,
  getSentenceSelection,
  MAX_LOOKUP_WORDS,
  toLookupText,
  type SelectionInfo,
  type SentenceSelection,
} from './selection-info';
import type { AnalyzeGrammarReply } from '@/lib/grammar/types';
import {
  createAnalysisCard,
  ensureAnalysisStyles,
  renderAnalysisLoading,
  renderAnalysisMessage,
  renderAnalysisReply,
  type AnalysisCardHandlers,
} from '@/lib/grammar/analysis-ui';
import { clearGrammarHighlight, highlightGrammar, spanRanges } from '@/lib/grammar/page-highlight';
import { spansOf } from '@/lib/grammar/segments';
import type { DetectedStructure } from '@/lib/grammar/types';
import { ruleToGrammarCard, type GrammarRuleDetail, type GrammarRuleReply } from '@/lib/grammar/rule';
import { createRuleCard, ensureRuleStyles, renderRuleLoading, renderRuleReply, setRuleStar } from '@/lib/grammar/rule-ui';
import { bookmarkId, isBookmarked, toggleBookmark } from '@/lib/bookmarks';
import { isExtensionContextInvalidated } from '@/lib/extension-context';
import { ENABLE_AI } from '@/lib/config';
import type { PracticeReply, PracticeRequest } from '@/lib/grammar/practice';
import { ensurePracticeStyles, showPractice } from '@/lib/grammar/practice-ui';
import {
  createAnalyzeButton,
  createLookupButton,
  createLookupCard,
  ensureSelectionStyles,
  positionLookupCard,
  renderExtensionInvalidated,
  renderLookupLoading,
  renderLookupMessage,
  renderLookupResponse,
  renderSourceLinks,
  hideVocabEditor,
  isVocabEditorOpen,
  setStarState,
  showVocabEditor,
} from './lookup-ui';

export interface SelectionLookupOptions {
  /** Shadow root of the extension overlay (created lazily by the content script). */
  getShadowRoot: () => ShadowRoot;
  /** Host element of that shadow root, used to ignore events coming from our own UI. */
  getHost: () => HTMLElement | null;
  getSettings: () => Settings;
  /** True while another extension UI (grammar popover/panel) owns the interaction. */
  isSuppressed: () => boolean;
  /** Fetches the dictionary entry (runs in the background script). */
  lookup: (text: string) => Promise<LookupResponse>;
  /** Sends a selected sentence to the chat side panel. */
  askAbout: (sentence: SentenceSelection) => void;
  /** US-17: grammar structures of a sentence (backend, through the background script). */
  analyze: (sentence: string) => Promise<AnalyzeGrammarReply>;
  /** Opens the options page (backend URL). */
  openSettings: () => void;
  /** US-18: grammar card of a rule (backend catalog, through the background script). */
  ruleDetail: (ruleId: string) => Promise<GrammarRuleReply>;
  /** US-19: grade a sentence written with a structure (backend, through the background script). */
  practice: (req: PracticeRequest) => Promise<PracticeReply>;
  /** Plays a pronunciation recording (US-04); rejects when it cannot be played. */
  playAudio: (url: string) => Promise<void>;
  /** French speech synthesis voice lookup; defaults to the browser's speechSynthesis. */
  findVoice?: () => Promise<SpeechSynthesisVoice | null>;
}

/** Where to anchor a card opened without a usable selection: the selection, else top center. */
function selectionRectOrCenter(): DOMRect {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    const rects = sel.getRangeAt(0).getClientRects();
    const last = rects[rects.length - 1];
    if (last && (last.width > 0 || last.height > 0)) return last;
  }
  return new DOMRect(window.innerWidth / 2 - 170, 60, 0, 0);
}

/** Delay after mouseup so double/triple-click selections are final. */
const MOUSEUP_DELAY = 10;
/** Debounce for keyboard selections (Shift+arrows). */
const KEYBOARD_DELAY = 300;
/** A scroll this soon after wheel/touch/scroll-key input is treated as the user's own. */
const USER_SCROLL_WINDOW = 1000;
const SCROLL_KEYS = new Set(['PageUp', 'PageDown', 'Home', 'End', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/**
 * US-01: shows a lookup button (or opens the lookup card directly, depending on
 * settings) when the user selects a word or short phrase anywhere on the page.
 */
export class SelectionLookupController {
  private button: HTMLButtonElement | null = null;
  private card: HTMLDivElement | null = null;
  /** Result shown in the open card, for the ☆ button. */
  private cardResult: LookupResult | null = null;
  /** Word the card's external dictionary buttons open (null while loading). */
  private cardLinkWord: string | null = null;
  private cardAnchor: DOMRect | null = null;
  /** Open note editor: entry id and the note as last saved. */
  private editor: { id: string; saved: string } | null = null;
  /** Selection the open card was made for (its sentence is saved with the word). */
  private cardInfo: SelectionInfo | null = null;
  /** Context menu "Add to vocabulary": save once the lookup resolves. */
  private pendingAutoSave = false;
  private pending: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  /** Where focus was before a card/button took it from the keyboard (US-16); restored on close. */
  private focusOrigin: FocusOrigin | null = null;
  private releaseTrap: (() => void) | null = null;
  /** US-17: sentence of the open analysis card, and its result once known. */
  private analysisTarget: SentenceSelection | null = null;
  private analysisReply: Extract<AnalyzeGrammarReply, { status: 'ok' }> | null = null;
  /** US-18: rule shown in the open grammar card (for its star). */
  private shownRule: GrammarRuleDetail | null = null;
  /** Last wheel/touch/scroll-key input outside our UI, to tell user scrolls from scripted ones. */
  private lastScrollIntent = 0;

  /** French voice lookup, shared by every card (only the first call may wait). */
  private readonly findVoice: () => Promise<SpeechSynthesisVoice | null>;

  constructor(private readonly opts: SelectionLookupOptions) {
    this.findVoice = opts.findVoice ?? createVoiceFinder();
  }

  start() {
    if (this.started) return;
    this.started = true;
    document.addEventListener('mouseup', this.onMouseUp, true);
    document.addEventListener('keyup', this.onKeyUp, true);
    document.addEventListener('mousedown', this.onMouseDown, true);
    document.addEventListener('keydown', this.onKeyDown, true);
    document.addEventListener('selectionchange', this.onSelectionChange);
    window.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
    window.addEventListener('wheel', this.onScrollIntent, { capture: true, passive: true });
    window.addEventListener('touchmove', this.onScrollIntent, { capture: true, passive: true });
    window.addEventListener('resize', this.hideAll, { passive: true });
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    this.clearPending();
    document.removeEventListener('mouseup', this.onMouseUp, true);
    document.removeEventListener('keyup', this.onKeyUp, true);
    document.removeEventListener('mousedown', this.onMouseDown, true);
    document.removeEventListener('keydown', this.onKeyDown, true);
    document.removeEventListener('selectionchange', this.onSelectionChange);
    window.removeEventListener('scroll', this.onScroll, true);
    window.removeEventListener('wheel', this.onScrollIntent, true);
    window.removeEventListener('touchmove', this.onScrollIntent, true);
    window.removeEventListener('resize', this.hideAll);
    this.hideAll();
  }

  /**
   * Context menu "Look up" / "Add to vocabulary" (US-06). Works even when the selection
   * button is turned off: the user asked explicitly. A selection longer than a word or
   * short phrase is neither looked up nor saved: the card says so instead.
   */
  openFromContextMenu(text: string, save: boolean, focus = false) {
    const query = contextMenuQuery(text);
    const current = getSelectionInfo();
    const same = (a: string, b: string) => a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim();
    if (!query) {
      const label = text.replace(/\s+/g, ' ').trim();
      const short = label.length > 40 ? `${label.slice(0, 39)}…` : label;
      this.openMessageCard(
        { text: short, rect: selectionRectOrCenter(), field: null, context: () => null },
        this.t().ctxSelectionTooLong(MAX_LOOKUP_WORDS),
        focus
      );
      return;
    }
    const info: SelectionInfo =
      current && same(current.text, query)
        ? current
        : { text: query, rect: selectionRectOrCenter(), field: null, context: () => null };
    this.openCard(info, { autoSave: save, focus });
  }

  /**
   * Shortcut "Look up the selection" (US-16): opens the card for the selected word and moves
   * focus into it. Works even when the selection button is turned off: the user asked.
   */
  lookupFromCommand() {
    const info = getSelectionInfo();
    if (info) {
      this.openCard(info, { focus: true });
      return;
    }
    const sentence = getSentenceSelection();
    if (sentence) {
      this.openFromContextMenu(sentence.text, false, true);
      return;
    }
    this.openMessageCard(
      { text: this.t().lookupButtonTitle, rect: selectionRectOrCenter(), field: null, context: () => null },
      this.t().lookupNoSelection,
      true
    );
  }

  /**
   * Shortcut "check grammar" outside a text field (US-17): analyzes the selected sentence,
   * or the sentence around the selected word or the caret, in a card that takes focus.
   * Works even when the selection button is turned off: the user asked.
   */
  analyzeFromCommand() {
    const target = getSentenceSelection() ?? getSentenceAtCaret();
    if (target) {
      this.openAnalysis(target, true);
      return;
    }
    this.openAnalysisMessage(this.t().analysisNoSentence, true);
  }

  /** Context menu "Analyze grammar" (US-17): the selected passage, or the sentence of a selected word. */
  analyzeFromContextMenu(text: string) {
    const normalized = text.replace(/\s+/g, ' ').trim();
    const selected = getSentenceSelection();
    let target: SentenceSelection | null = selected && selected.text === normalized ? selected : null;
    if (!target && toLookupText(text)) target = getSentenceAtCaret();
    target ??= { text: normalized, rect: selectionRectOrCenter(), range: null };
    this.openAnalysis(target, false);
  }

  /** The analysis card for a sentence; the structures are fetched from the backend. */
  openAnalysis(target: SentenceSelection, focus: boolean) {
    this.hideButton();
    this.hideCard();
    const shadow = this.opts.getShadowRoot();
    ensureSelectionStyles(shadow);
    ensureAnalysisStyles(shadow);
    const t = this.t();
    const card = createAnalysisCard(target.text, t, this.analysisHandlers(() => card, target));
    card.style.visibility = 'hidden';
    renderAnalysisLoading(card, t);
    shadow.appendChild(card);
    positionLookupCard(card, target.rect);
    card.style.visibility = '';
    this.card = card;
    this.cardAnchor = target.rect;
    this.analysisTarget = target;
    this.attachTrap(card);
    if (focus) this.takeFocus(card, card);
    void this.loadAnalysis(card, target);
  }

  private analysisHandlers(getCard: () => HTMLDivElement, target: SentenceSelection): AnalysisCardHandlers {
    return {
      onClose: () => this.hideCard(),
      onRetry: () => {
        const card = getCard();
        renderAnalysisLoading(card, this.t());
        void this.loadAnalysis(card, target);
      },
      onOpenSettings: () => this.opts.openSettings(),
      onAsk: () => {
        this.hideCard();
        this.opts.askAbout(target);
      },
      onFocusRule: (ruleId) => this.highlightAnalysis(ruleId),
      onOpenRule: (structure) => this.openRule(target, structure),
    };
  }

  /**
   * Replaces the open card by `card` at the same place, keeping where focus came from
   * (analysis card <-> grammar card, US-18). Focus moves along when the old card had it.
   */
  private swapCard(card: HTMLDivElement, preferred?: HTMLElement | null) {
    const old = this.card;
    const hadFocus = containsFocus(old);
    this.releaseTrap?.();
    this.releaseTrap = null;
    old?.remove();
    this.opts.getShadowRoot().appendChild(card);
    this.card = card;
    if (this.cardAnchor) positionLookupCard(card, this.cardAnchor);
    this.attachTrap(card);
    if (hadFocus) focusInto(card, preferred ?? card);
  }

  /** US-18: grammar card of a structure found in the analyzed sentence. */
  private openRule(target: SentenceSelection, structure: DetectedStructure) {
    const shadow = this.opts.getShadowRoot();
    ensureRuleStyles(shadow);
    const t = this.t();
    const card = createRuleCard(structure, t, this.ruleHandlers(() => card, target, structure));
    renderRuleLoading(card, t);
    this.shownRule = null;
    this.swapCard(card);
    this.highlightAnalysis(structure.ruleId);
    void this.loadRule(card, target, structure);
  }

  private ruleHandlers(getCard: () => HTMLDivElement, target: SentenceSelection, structure: DetectedStructure) {
    return {
      onClose: () => this.hideCard(),
      onBack: () => this.backToAnalysis(target, structure.ruleId),
      onRetry: () => {
        const card = getCard();
        renderRuleLoading(card, this.t());
        void this.loadRule(card, target, structure);
      },
      onOpenSettings: () => this.opts.openSettings(),
      onToggleStar: () => {
        const rule = this.shownRule;
        if (rule) void this.toggleRuleStar(getCard(), rule);
      },
      // Catalog examples used up: the assistant can write more (only with AI on).
      onPractice: () => this.openPractice(getCard(), structure),
      onMoreFromAssistant: ENABLE_AI
        ? () => {
            this.hideCard();
            this.opts.askAbout(target);
          }
        : undefined,
    };
  }

  private async loadRule(card: HTMLDivElement, target: SentenceSelection, structure: DetectedStructure) {
    let reply: GrammarRuleReply;
    try {
      reply = await this.opts.ruleDetail(structure.ruleId);
    } catch (error) {
      if (this.card === card && isExtensionContextInvalidated(error)) {
        renderExtensionInvalidated(card, this.t());
        return;
      }
      reply = { status: 'error', backendUrl: '', httpStatus: null, message: error instanceof Error ? error.message : String(error) };
    }
    if (this.card !== card) return;
    const keepFocus = containsFocus(card);
    const handlers = this.ruleHandlers(() => card, target, structure);
    this.shownRule = reply.status === 'ok' ? reply.rule : null;
    renderRuleReply(card, reply, {
      t: this.t(),
      lang: this.opts.getSettings().uiLanguage || 'vi',
      structure,
      sentence: this.analysisReply?.analysis.sentence ?? target.text,
      handlers,
    });
    if (this.cardAnchor) positionLookupCard(card, this.cardAnchor);
    if (keepFocus && !containsFocus(card)) card.focus({ preventScroll: true });
    if (reply.status === 'ok') {
      const saved = await isBookmarked(bookmarkId('grammar', reply.rule.id)).catch(() => false);
      if (this.card === card) setRuleStar(card, saved, this.t());
    }
  }

  /** US-19: the "write a sentence" field of the grammar card. */
  private openPractice(card: HTMLDivElement, structure: DetectedStructure) {
    const rule = this.shownRule;
    if (this.card !== card || !rule) return;
    ensurePracticeStyles(this.opts.getShadowRoot());
    showPractice(card, {
      t: this.t(),
      lang: this.opts.getSettings().uiLanguage || 'vi',
      ruleName: rule.name,
      formula: rule.formula,
      submit: (sentence) =>
        this.opts.practice({
          sentence,
          ruleId: structure.ruleId,
          ruleName: rule.name,
          sourceUrl: location.href,
          sourceTitle: document.title || null,
        }),
      onOpenSettings: () => this.opts.openSettings(),
      onDone: () => this.hideCard(),
    });
  }

  private async toggleRuleStar(card: HTMLDivElement, rule: GrammarRuleDetail) {
    const lang = this.opts.getSettings().uiLanguage || 'vi';
    const grammarCard = ruleToGrammarCard(rule, lang);
    try {
      const saved = await toggleBookmark({
        id: bookmarkId('grammar', grammarCard.id),
        kind: 'grammar',
        title: grammarCard.title,
        subtitle: grammarCard.form,
        url: grammarCard.source?.url,
        card: grammarCard,
      });
      if (this.card === card) setRuleStar(card, saved, this.t());
    } catch (error) {
      console.warn('TextChecker: could not save the grammar card', error);
    }
  }

  /** Back from a grammar card to the analysis of the sentence, focus on the structure it came from. */
  private backToAnalysis(target: SentenceSelection, ruleId: string) {
    const reply = this.analysisReply;
    if (!reply) {
      this.openAnalysis(target, containsFocus(this.card));
      return;
    }
    const t = this.t();
    const card = createAnalysisCard(target.text, t, this.analysisHandlers(() => card, target));
    renderAnalysisReply(card, reply, t, this.analysisHandlers(() => card, target));
    const from = [...card.querySelectorAll<HTMLElement>('.tc-structure')].find((b) => b.dataset.rule === ruleId);
    this.shownRule = null;
    this.swapCard(card, from);
    this.highlightAnalysis(null);
  }

  private openAnalysisMessage(message: string, focus: boolean) {
    this.hideButton();
    this.hideCard();
    const shadow = this.opts.getShadowRoot();
    ensureSelectionStyles(shadow);
    ensureAnalysisStyles(shadow);
    const t = this.t();
    const card = createAnalysisCard('', t, {
      onClose: () => this.hideCard(),
      onRetry: () => {},
      onOpenSettings: () => {},
      onAsk: () => {},
      onFocusRule: () => {},
      onOpenRule: () => {},
    });
    renderAnalysisMessage(card, message);
    shadow.appendChild(card);
    const rect = selectionRectOrCenter();
    positionLookupCard(card, rect);
    this.card = card;
    this.cardAnchor = rect;
    this.attachTrap(card);
    if (focus) this.takeFocus(card, card);
  }

  private async loadAnalysis(card: HTMLDivElement, target: SentenceSelection) {
    let reply: AnalyzeGrammarReply;
    try {
      reply = await this.opts.analyze(target.text);
    } catch (error) {
      if (this.card === card && isExtensionContextInvalidated(error)) {
        renderExtensionInvalidated(card, this.t());
        return;
      }
      reply = {
        status: 'error',
        backendUrl: '',
        httpStatus: null,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    if (this.card !== card) return;
    const keepFocus = containsFocus(card);
    renderAnalysisReply(card, reply, this.t(), this.analysisHandlers(() => card, target));
    this.analysisReply = reply.status === 'ok' ? reply : null;
    this.highlightAnalysis(null);
    if (this.cardAnchor) positionLookupCard(card, this.cardAnchor);
    // The focused retry button was replaced: keep focus in the card.
    if (keepFocus && !containsFocus(card)) card.focus({ preventScroll: true });
  }

  /** Highlights in the page the words of one structure, or of all of them (null). */
  private highlightAnalysis(ruleId: string | null) {
    const target = this.analysisTarget;
    const reply = this.analysisReply;
    if (!target?.range || !reply) {
      clearGrammarHighlight();
      return;
    }
    const { sentence, structures } = reply.analysis;
    try {
      highlightGrammar(spanRanges(target.range, sentence, spansOf(structures, ruleId)));
    } catch {
      clearGrammarHighlight();
    }
  }

  /** Sentence for the assistant: the selected passage, or the sentence around the selected word. */
  selectedSentence(): SentenceSelection | null {
    const sentence = getSentenceSelection();
    if (sentence) return sentence;
    const info = getSelectionInfo();
    if (!info) return null;
    const text = info.context() ?? info.text;
    const sel = window.getSelection();
    const range = !info.field && sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    return { text, rect: info.rect, range };
  }

  /** Remembers the current focus, then moves it into `el` (a card or floating button). */
  private takeFocus(el: HTMLElement, preferred?: HTMLElement | null) {
    this.focusOrigin = captureFocusOrigin(this.opts.getHost());
    focusInto(el, preferred);
  }

  /** Gives focus back when it is still inside `el` (closing with Esc, ×, or a keyboard action). */
  private returnFocus(el: HTMLElement | null) {
    const origin = this.focusOrigin;
    this.focusOrigin = null;
    if (origin && el && containsFocus(el)) origin.restore();
  }

  /** Tab cycles inside the card, Esc closes it (US-16). */
  private attachTrap(card: HTMLElement) {
    this.releaseTrap?.();
    this.releaseTrap = trapFocus(card, { onEscape: () => this.hideCard() });
  }

  /** Card that only shows a message (nothing is looked up). */
  private openMessageCard(info: SelectionInfo, message: string, focus = false) {
    this.hideButton();
    this.hideCard();
    const shadow = this.opts.getShadowRoot();
    ensureSelectionStyles(shadow);
    const t = this.t();
    const card = createLookupCard(info, t, () => this.hideCard(), () => {});
    renderLookupMessage(card, message);
    shadow.appendChild(card);
    positionLookupCard(card, info.rect);
    this.card = card;
    this.cardAnchor = info.rect;
    this.attachTrap(card);
    if (focus) this.takeFocus(card, card);
  }

  /**
   * Opens the lookup card for a selection (also used by the context menu).
   * `autoSave` (context menu "Add to vocabulary") saves the word once it is looked up.
   */
  openCard(info: SelectionInfo, options: { autoSave?: boolean; focus?: boolean } = {}) {
    this.hideButton();
    this.hideCard();
    this.cardInfo = info;
    this.pendingAutoSave = !!options.autoSave;
    const shadow = this.opts.getShadowRoot();
    ensureSelectionStyles(shadow);
    const t = this.t();
    const card = createLookupCard(
      info,
      t,
      () => this.hideCard(),
      () => void this.toggleStar(card)
    );
    card.style.visibility = 'hidden';
    renderLookupLoading(card, t);
    shadow.appendChild(card);
    positionLookupCard(card, info.rect);
    card.style.visibility = '';
    this.card = card;
    this.cardAnchor = info.rect;
    this.attachTrap(card);
    // From the keyboard the card itself takes focus (it announces the word), Tab reaches its buttons.
    if (options.focus) this.takeFocus(card, card);
    void this.loadInto(card, info);
  }

  private async loadInto(card: HTMLDivElement, info: SelectionInfo) {
    let response: LookupResponse;
    try {
      response = await this.opts.lookup(info.text);
    } catch (error) {
      if (this.card === card && isExtensionContextInvalidated(error)) {
        renderExtensionInvalidated(card, this.t());
        return;
      }
      response = {
        status: 'error',
        word: info.text,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    // The card may have been closed or replaced while the request was in flight.
    if (this.card !== card) return;
    const t = this.t();
    this.cardLinkWord = response.status === 'ok' ? response.result.lemma : normalizeLookupQuery(response.word) || response.word;
    renderLookupResponse(
      card,
      response,
      t,
      () => {
        this.cardLinkWord = null;
        renderLookupLoading(card, t);
        void this.loadInto(card, info);
      },
      () => this.sourceLinks()
    );
    positionLookupCard(card, info.rect);
    this.cardResult = response.status === 'ok' ? response.result : null;
    const speak = card.querySelector<HTMLButtonElement>('.tc-lookup-speak');
    if (speak) {
      if (this.cardResult) void this.setupSpeak(card, speak, this.cardResult);
      else speak.hidden = true;
    }
    if (this.cardResult) await this.refreshStar(card, this.cardResult);
    // Context menu "Add to vocabulary": save as soon as the word is known. A network
    // error waits for Retry; a word Wiktionary does not have is saved as typed.
    if (this.pendingAutoSave && response.status !== 'error' && this.card === card) {
      this.pendingAutoSave = false;
      if (response.status === 'ok') await this.saveFromCard(card, response.result, response.result.word, true);
      else await this.saveFromCard(card, null, response.word, true);
    }
  }

  /** Draft for the open card: lookup data, the sentence around the selection and the page. */
  private draftFor(result: LookupResult | null, word: string): VocabDraft {
    const page = { url: location.href, title: document.title || null };
    const base: VocabDraft = result
      ? vocabDraftFromLookup(result, page)
      : { word: normalizeLookupQuery(word) || word, sourceUrl: page.url, sourceTitle: page.title };
    return { ...base, contextSentence: this.cardInfo?.context() ?? null };
  }

  private async saveFromCard(card: HTMLDivElement, result: LookupResult | null, word: string, openEditor: boolean) {
    try {
      const entry = await saveWord(this.draftFor(result, word));
      if (this.card !== card) return;
      const star = card.querySelector<HTMLElement>('.tc-card-star');
      if (star) setStarState(star, true, this.t());
      if (openEditor && entry) this.openEditor(card, entry);
    } catch (error) {
      console.warn('TextChecker: could not save the word', error);
    }
  }

  private openEditor(card: HTMLDivElement, entry: VocabEntry) {
    const t = this.t();
    const editor = { id: entry.id, saved: entry.note };
    this.editor = editor;
    showVocabEditor(card, {
      t,
      context: entry.contextSentence,
      note: entry.note,
      onSaveNote: async (note) => {
        await updateVocabEntry(entry.id, { note });
        editor.saved = note;
      },
      onRemove: async () => {
        this.editor = null; // nothing left to keep
        await unsaveWord(entry.id);
        if (this.card !== card) return;
        hideVocabEditor(card);
        const star = card.querySelector<HTMLElement>('.tc-card-star');
        if (star) setStarState(star, false, this.t());
      },
    });
    if (this.cardAnchor) positionLookupCard(card, this.cardAnchor);
    card.querySelector<HTMLTextAreaElement>('.tc-vocab-note')?.focus({ preventScroll: true });
  }

  /**
   * US-04: wires the 🔊 button. The Wiktionary recording is preferred, the browser's
   * French voice is the fallback; with neither, the button stays hidden.
   */
  private async setupSpeak(card: HTMLDivElement, button: HTMLButtonElement, result: LookupResult) {
    // The card shows the selected word for inflections (mangeons), the lemma otherwise;
    // the recording, when any, belongs to that same page/word.
    const text = result.formOf ? result.word : result.lemma;
    const audioUrl = result.audio ? commonsFileUrl(result.audio.file) : null;
    const t = this.t();
    const label = audioUrl ? t.lookupSpeakRecording(result.audio?.region ?? null) : t.lookupSpeakSynth;
    button.title = label;
    button.setAttribute('aria-label', label);
    // A recording is enough to show the button at once; the voice is only its fallback.
    if (audioUrl) button.hidden = false;
    const voicePromise = this.findVoice();
    if (!audioUrl) {
      const voice = await voicePromise;
      if (this.card !== card) return;
      button.hidden = !voice;
      if (!voice) return;
    }

    let playing = false;
    button.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (playing) return;
      playing = true;
      button.classList.remove('tc-failed');
      button.classList.add('tc-playing');
      try {
        await pronounce(
          { text, audioUrl },
          {
            playAudio: this.opts.playAudio,
            speak: async (s) => {
              const voice = await voicePromise;
              if (!voice) throw new Error('no French voice');
              await speakFrench(s, voice);
            },
          }
        );
        button.title = label;
      } catch (error) {
        console.warn('TextChecker: pronunciation failed', error);
        button.classList.add('tc-failed');
        button.title = this.t().lookupSpeakFailed;
      } finally {
        playing = false;
        button.classList.remove('tc-playing');
      }
    };
  }

  private sourceLinks() {
    if (!this.cardLinkWord) return [];
    const settings = this.opts.getSettings();
    return buildSourceLinks(this.cardLinkWord, settings.selectionLookup.sources, settings.uiLanguage || 'vi');
  }

  /** Call when settings change: the open card's dictionary buttons follow at once. */
  refreshSettings() {
    if (this.card && this.cardLinkWord) {
      renderSourceLinks(this.card, this.sourceLinks(), this.t());
      if (this.cardAnchor) positionLookupCard(this.card, this.cardAnchor);
    }
  }

  private async refreshStar(card: HTMLDivElement, result: LookupResult) {
    const entry = await getVocabEntry(vocabId(result.lemma)).catch(() => null);
    const star = card.querySelector<HTMLElement>('.tc-card-star');
    if (star && this.card === card) setStarState(star, !!entry?.saved, this.t());
  }

  /**
   * ☆ saves the word to the notebook with the sentence around the selection (US-06).
   * On a saved word ("Saved") it opens/closes the editor: note, or remove.
   */
  private async toggleStar(card: HTMLDivElement) {
    const result = this.cardResult;
    if (!result || this.card !== card) return;
    if (isVocabEditorOpen(card)) {
      this.flushEditor(card);
      hideVocabEditor(card);
      return;
    }
    const existing = await getVocabEntry(vocabId(result.lemma)).catch(() => null);
    if (this.card !== card) return;
    if (existing?.saved) this.openEditor(card, existing);
    else await this.saveFromCard(card, result, result.word, false);
  }

  hideButton() {
    const button = this.button;
    this.button = null;
    if (button) this.returnFocus(button);
    button?.remove();
  }

  /**
   * Keeps a note typed but not saved when the editor or the card closes (Esc, ×,
   * clicking elsewhere): it is saved rather than lost.
   */
  private flushEditor(card: HTMLElement) {
    const editor = this.editor;
    this.editor = null;
    const field = card.querySelector<HTMLTextAreaElement>('.tc-vocab-note');
    if (!editor || !field) return;
    const note = field.value.trim();
    if (note !== editor.saved.trim()) {
      void updateVocabEntry(editor.id, { note }).catch((error) =>
        console.warn('TextChecker: could not save the note', error)
      );
    }
  }

  hideCard() {
    if (this.card) {
      stopOwnSpeech();
      this.flushEditor(this.card);
    }
    this.releaseTrap?.();
    this.releaseTrap = null;
    this.returnFocus(this.card);
    this.card?.remove();
    this.card = null;
    this.cardResult = null;
    this.cardLinkWord = null;
    this.cardAnchor = null;
    this.cardInfo = null;
    this.pendingAutoSave = false;
    if (this.analysisTarget) clearGrammarHighlight();
    this.analysisTarget = null;
    this.analysisReply = null;
    this.shownRule = null;
  }

  hideAll = () => {
    this.clearPending();
    this.hideButton();
    this.hideCard();
  };

  get isCardOpen(): boolean {
    return this.card !== null;
  }

  // --- internals -----------------------------------------------------------

  private t() {
    return getT(this.opts.getSettings().uiLanguage || 'vi');
  }

  private isEnabled(): boolean {
    const s = this.opts.getSettings();
    return s.enabled && s.selectionLookup.enabled;
  }

  private isFromOwnUi(e: Event): boolean {
    const host = this.opts.getHost();
    return !!host && e.composedPath().includes(host);
  }

  private clearPending() {
    if (this.pending) {
      clearTimeout(this.pending);
      this.pending = null;
    }
  }

  private schedule(delay: number, fromKeyboard: boolean, altKey: boolean) {
    this.clearPending();
    this.pending = setTimeout(() => {
      this.pending = null;
      this.evaluate(fromKeyboard, altKey);
    }, delay);
  }

  private evaluate(fromKeyboard: boolean, altKey: boolean) {
    if (!this.isEnabled() || this.opts.isSuppressed()) {
      this.hideButton();
      return;
    }
    const { trigger } = this.opts.getSettings().selectionLookup;
    const info = getSelectionInfo();
    if (!info) {
      // Longer selections get the grammar analysis (US-17) instead of the dictionary.
      // Like the lookup button, keyboard selections only get it in "button" mode.
      const sentence = getSentenceSelection();
      if (sentence && (!fromKeyboard || trigger === 'button')) this.showAnalyzeButton(sentence);
      else this.hideButton();
      return;
    }

    // Keyboard selections only ever get the button: opening a card while the
    // user is still extending the selection with Shift+arrows would be intrusive.
    if (trigger === 'button' || fromKeyboard) {
      if (trigger === 'button') this.showButton(info);
      return;
    }
    if (trigger === 'instant' || (trigger === 'alt' && altKey)) {
      this.openCard(info);
    }
  }

  private showButton(info: SelectionInfo) {
    this.hideButton();
    const shadow = this.opts.getShadowRoot();
    ensureSelectionStyles(shadow);
    this.button = createLookupButton(info, this.t(), (fromKeyboard) => this.openCard(info, { focus: fromKeyboard }));
    shadow.appendChild(this.button);
  }

  private showAnalyzeButton(sentence: SentenceSelection, focus = false) {
    this.hideButton();
    const shadow = this.opts.getShadowRoot();
    ensureSelectionStyles(shadow);
    const button = createAnalyzeButton(sentence.rect, this.t(), (fromKeyboard) => this.openAnalysis(sentence, fromKeyboard));
    // Esc on the focused button closes it and gives focus back (US-16).
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.hideButton();
      }
    });
    this.button = button;
    shadow.appendChild(button);
    if (focus) this.takeFocus(button, button);
  }

  private onMouseUp = (e: MouseEvent) => {
    if (e.button !== 0 || this.isFromOwnUi(e)) return;
    this.schedule(MOUSEUP_DELAY, false, e.altKey);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (this.isFromOwnUi(e)) return;
    const selectingKey =
      e.key === 'Shift' ||
      (e.shiftKey && e.key.startsWith('Arrow')) ||
      (e.shiftKey && (e.key === 'Home' || e.key === 'End'));
    if (!selectingKey) return;
    this.schedule(KEYBOARD_DELAY, true, false);
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.isFromOwnUi(e)) return;
    this.hideAll();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.hideAll();
      return;
    }
    if (!e.shiftKey && SCROLL_KEYS.has(e.key) && !this.isFromOwnUi(e)) {
      this.lastScrollIntent = Date.now();
    }
    // Typing replaces the selection: drop the button but keep pending keyboard checks.
    // (Space on our own focused button activates it instead.)
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey && e.key.length === 1 && !this.isFromOwnUi(e)) {
      this.hideButton();
    }
  };

  private onSelectionChange = () => {
    // Focus moved onto our own button (keyboard): the field's selection is no longer visible
    // through getSelection(), but the user has not deselected anything.
    if (containsFocus(this.button)) return;
    if (this.button && !getSelectionInfo() && !getSentenceSelection()) this.hideButton();
  };

  private onScrollIntent = (e: Event) => {
    if (!this.isFromOwnUi(e)) this.lastScrollIntent = Date.now();
  };

  /**
   * Hides on scrolls the user caused. Scripted scrolls (chat feeds, sliders, lazy loading)
   * fire scroll events too and must not close a card the user is reading.
   */
  private onScroll = (e: Event) => {
    if (this.isFromOwnUi(e)) return;
    if (!this.button && !this.card) return;
    if (Date.now() - this.lastScrollIntent < USER_SCROLL_WINDOW) this.hideAll();
  };
}
