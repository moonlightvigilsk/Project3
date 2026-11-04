import { settingsStorage } from "@/lib/storage";
import { getT } from "@/lib/i18n";
import {
  debounce,
  isEditableElement,
  getTargetEditableElement,
  getTextFromElement,
  getContenteditableRange,
  applyReplacementToElement,
  getSuggestionColor,
  getSuggestionLabel,
} from "@/lib/utils";
import { getTextareaCharacterRects } from "@/lib/text-rects";
import { SelectionLookupController } from "@/lib/selection/selection-lookup";
import { clearContextHighlight, highlightContext } from "@/lib/selection/context-highlight";
import type { LookupResponse } from "@/lib/dictionary/types";
import { NO_OFFSCREEN } from "@/lib/audio-messages";
import { CONTEXT_MENU_LOOKUP } from "@/lib/selection/messages";
import type { GrammarSuggestion, GrammarCheckResult, Settings } from "@/types";
import { DEFAULT_SETTINGS } from "@/types";
import { buildTextModel, offsetOfPosition, type TextModel } from "@/lib/editable-text";
import { VocabHighlighter, isHighlightSupported } from "@/lib/vocab-highlight/highlighter";
import { getVocabulary, watchVocabulary } from "@/lib/vocabulary/client";
import { savedEntries } from "@/lib/vocabulary/model";
import { OVERLAY_THEME_CSS, setThemeAttribute } from "@/lib/theme";
import { captureFocusOrigin, containsFocus, deepActiveElement, focusInto, trapFocus, type FocusOrigin } from "@/lib/focus";
import { COMMANDS, RUN_COMMAND, type AssistantCommandReply } from "@/lib/commands";
import { nextSuggestion, suggestionAtCaret } from "@/lib/suggestions/navigation";
import { GRAMMAR_RULE, type GrammarRuleReply } from "@/lib/grammar/rule";
import { PRACTICE_SUBMIT, type PracticeReply } from "@/lib/grammar/practice";
import { ANALYZE_GRAMMAR, CONTEXT_MENU_ANALYZE, OPEN_OPTIONS, type AnalyzeGrammarReply } from "@/lib/grammar/types";

export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: true,
  runAt: "document_idle",

  async main(ctx) {
    console.log("TextChecker content script loaded", window.location.href);

    let settings: Settings = DEFAULT_SETTINGS;
    let currentSuggestions: GrammarSuggestion[] = [];
    let activeElement: HTMLElement | null = null;
    let overlayContainer: HTMLDivElement | null = null;
    let statusButton: HTMLDivElement | null = null;
    let suggestionPanel: HTMLDivElement | null = null;
    let isChecking = false;
    let activeElementResizeObserver: ResizeObserver | null = null;
    let currentRequestId = 0;
    let unwatchSettings: (() => void) | null = null;
    let popoverCloseTimeout: ReturnType<typeof setTimeout> | null = null;
    let selectionLookup: SelectionLookupController | null = null;
    /** Where the user dragged the status button, per text field (see makeStatusButtonDraggable). */
    const statusButtonOffsets = new WeakMap<HTMLElement, { dx: number; dy: number }>();

    // Load initial settings
    try {
      settings = await settingsStorage.getValue();
    } catch (error) {
      console.error("Failed to load settings:", error);
    }

    // Watch for settings changes
    try {
      unwatchSettings = settingsStorage.watch((newSettings) => {
        if (newSettings) {
          settings = newSettings;
          if (!settings.enabled) {
            cleanup();
          }
          if (!settings.enabled || !settings.selectionLookup.enabled) {
            selectionLookup?.hideAll();
          } else {
            selectionLookup?.refreshSettings();
          }
          syncVocabHighlight();
          if (overlayContainer) setThemeAttribute(overlayContainer, settings.theme);
        }
      });
    } catch (error) {
      console.error("Failed to watch settings:", error);
    }

    // US-09: highlight saved words (new / learning) on the page, when enabled in the options.
    const vocabHighlighter = isHighlightSupported() ? new VocabHighlighter(document) : null;
    let unwatchVocabHighlight: (() => void) | null = null;

    function syncVocabHighlight() {
      if (!vocabHighlighter) return;
      const on = settings.enabled && settings.vocabHighlight;
      if (on && !unwatchVocabHighlight) {
        let changed = false;
        unwatchVocabHighlight = watchVocabulary((state) => {
          changed = true;
          vocabHighlighter.update(savedEntries(state));
        });
        void getVocabulary()
          .then((state) => {
            // Skipped when stopped meanwhile, or when a newer notebook already arrived.
            if (unwatchVocabHighlight && !changed) vocabHighlighter.update(savedEntries(state));
          })
          .catch(() => undefined);
      } else if (!on) {
        stopVocabHighlight();
      }
    }

    function stopVocabHighlight() {
      unwatchVocabHighlight?.();
      unwatchVocabHighlight = null;
      vocabHighlighter?.stop();
    }

    syncVocabHighlight();

    // TextareaObserver for dynamic element detection & removal
    class TextareaObserver {
      private observer: MutationObserver | null = null;

      start() {
        if (this.observer) return;

        this.observer = new MutationObserver(() => {
          // If activeElement was detached from DOM, clean up
          if (activeElement && !document.contains(activeElement)) {
            cleanup();
            activeElement = null;
          }
        });

        this.observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
      }

      stop() {
        if (this.observer) {
          this.observer.disconnect();
          this.observer = null;
        }
      }
    }

    const textareaObserver = new TextareaObserver();
    textareaObserver.start();

    // US-01: lookup button/card when the user selects a word or short phrase
    selectionLookup = new SelectionLookupController({
      getShadowRoot: () => createOverlayContainer().shadowRoot!,
      getHost: () => overlayContainer,
      getSettings: () => settings,
      isSuppressed: () => !!currentPopover || !!suggestionPanel,
      lookup: async (text) => {
        const reply = await browser.runtime.sendMessage({
          type: "LOOKUP_WORD",
          payload: { text },
        });
        if (reply?.success && reply.response) return reply.response as LookupResponse;
        throw new Error(reply?.error ?? "Lookup failed");
      },
      playAudio: async (url) => {
        const reply = await browser.runtime.sendMessage({ type: "PLAY_AUDIO", payload: { url } });
        if (reply?.success) return;
        // No offscreen documents (Firefox): play here; the page's CSP may still block it.
        if (reply?.error === NO_OFFSCREEN) {
          await new Promise<void>((resolve, reject) => {
            const audio = new Audio(url);
            audio.addEventListener("ended", () => resolve());
            audio.addEventListener("error", () => reject(new Error("audio error")));
            audio.play().catch(reject);
          });
          return;
        }
        throw new Error(reply?.error ?? "Audio playback failed");
      },
      askAbout: (sentence) => {
        if (sentence.range) highlightContext(sentence.range);
        void browser.runtime
          .sendMessage({
            type: "OPEN_CHAT",
            payload: { sentence: sentence.text, url: location.href, title: document.title },
          })
          .catch((error: unknown) => console.warn("TextChecker: could not open the chat panel", error));
      },
      // US-17: grammar structures of a sentence (backend /api/grammar/analyze via the background).
      analyze: async (sentence) => {
        const reply = (await browser.runtime.sendMessage({
          type: ANALYZE_GRAMMAR,
          payload: { sentence },
        })) as { success?: boolean; reply?: AnalyzeGrammarReply; error?: string } | undefined;
        if (reply?.success && reply.reply) return reply.reply;
        throw new Error(reply?.error ?? "Analysis failed");
      },
      openSettings: () => {
        void browser.runtime.sendMessage({ type: OPEN_OPTIONS }).catch(() => {});
      },
      // US-18: grammar card of one rule (backend /api/grammar/rules/{id} via the background).
      ruleDetail: async (ruleId) => {
        const reply = (await browser.runtime.sendMessage({ type: GRAMMAR_RULE, payload: { ruleId } })) as
          | { success?: boolean; reply?: GrammarRuleReply; error?: string }
          | undefined;
        if (reply?.success && reply.reply) return reply.reply;
        throw new Error(reply?.error ?? "Grammar card failed");
      },
      // US-19: grade a sentence (backend /api/practice/submit via the background, which keeps the history).
      practice: async (req) => {
        const reply = (await browser.runtime.sendMessage({ type: PRACTICE_SUBMIT, payload: req })) as
          | { success?: boolean; reply?: PracticeReply; error?: string }
          | undefined;
        if (reply?.success && reply.reply) return reply.reply;
        throw new Error(reply?.error ?? "Practice failed");
      },
    });
    selectionLookup.start();

    // Google Docs Handler - special support for Google Docs canvas-based editor
    class GoogleDocsHandler {
      private observer: MutationObserver | null = null;
      private checkDebounceTimer: ReturnType<typeof setTimeout> | null = null;
      private isActive = false;
      private lastText = "";

      isGoogleDocs(): boolean {
        return (
          window.location.hostname === "docs.google.com" &&
          window.location.pathname.includes("/document/")
        );
      }

      getDocMode(): "canvas" | "legacy" | "unknown" {
        if (document.querySelector(".kix-canvas-tile-content svg")) {
          return "canvas";
        } else if (document.querySelector(".kix-paragraphrenderer")) {
          return "legacy";
        }
        return "unknown";
      }

      extractText(): string {
        const mode = this.getDocMode();

        if (mode === "canvas") {
          return this.extractTextFromCanvas();
        } else if (mode === "legacy") {
          return this.extractTextFromDOM();
        }
        return "";
      }

      private extractTextFromCanvas(): string {
        const paragraphs: string[] = [];
        const svgGroups = document.querySelectorAll(
          ".kix-canvas-tile-content svg > g[role=paragraph]"
        );

        svgGroups.forEach((group) => {
          const rects = group.querySelectorAll("rect[aria-label]");
          let prevText = "";
          const words: string[] = [];

          rects.forEach((rect) => {
            const text = rect.getAttribute("aria-label");
            if (text && text !== prevText) {
              words.push(text);
              prevText = text;
            }
          });

          if (words.length > 0) {
            paragraphs.push(words.join(""));
          }
        });

        return paragraphs.join("\n");
      }

      private extractTextFromDOM(): string {
        const paragraphs: string[] = [];
        const paraElements = document.querySelectorAll(".kix-paragraphrenderer");

        paraElements.forEach((para) => {
          const lines = para.querySelectorAll(".kix-lineview");
          const lineTexts: string[] = [];

          lines.forEach((line) => {
            const words = line.querySelectorAll(
              ".kix-wordhtmlgenerator-word-node"
            );
            let lineText = "";

            words.forEach((word) => {
              let text = word.textContent || "";
              text = text.replace(/[\u200B\u200C]/g, "").replace(/\u00A0/g, " ");
              lineText += text;
            });

            if (lineText) {
              lineTexts.push(lineText);
            }
          });

          if (lineTexts.length > 0) {
            paragraphs.push(lineTexts.join(" "));
          }
        });

        return paragraphs.join("\n");
      }

      getEditorElement(): HTMLElement | null {
        return document.querySelector(".kix-appview-editor");
      }

      start() {
        if (!this.isGoogleDocs() || this.isActive) return;

        const editor = this.getEditorElement();
        if (!editor) {
          setTimeout(() => this.start(), 1000);
          return;
        }

        this.isActive = true;
        activeElement = editor;

        this.observer = new MutationObserver(() => {
          this.scheduleCheck();
        });

        this.observer.observe(editor, {
          childList: true,
          subtree: true,
          characterData: true,
        });

        if (settings.checkMode === "realtime") {
          this.scheduleCheck();
        }
      }

      private scheduleCheck() {
        if (!settings.enabled || settings.checkMode !== "realtime") return;

        if (this.checkDebounceTimer) {
          clearTimeout(this.checkDebounceTimer);
        }

        this.checkDebounceTimer = setTimeout(() => {
          this.performCheck();
        }, settings.realtimeDelay);
      }

      private async performCheck() {
        if (isChecking) return;

        const text = this.extractText();
        if (text.length < 10 || text === this.lastText) return;

        this.lastText = text;
        isChecking = true;
        showStatusButton("loading");

        try {
          const result = await checkGrammarRequest(text);
          if (result) {
            currentSuggestions = result.suggestions;
            if (currentSuggestions.length > 0) {
              showStatusButton("errors", currentSuggestions.length);
            } else {
              showStatusButton("clean");
            }
          }
        } catch (error) {
          console.error("Google Docs grammar check error:", error);
          hideStatusButton();
        } finally {
          isChecking = false;
        }
      }

      triggerManualCheck() {
        if (!this.isActive) return;
        this.performCheck();
      }

      stop() {
        if (this.checkDebounceTimer) {
          clearTimeout(this.checkDebounceTimer);
          this.checkDebounceTimer = null;
        }
        if (this.observer) {
          this.observer.disconnect();
          this.observer = null;
        }
        this.isActive = false;
        this.lastText = "";
      }
    }

    const googleDocsHandler = new GoogleDocsHandler();
    googleDocsHandler.start();

    // Styles for Shadow DOM
    const STYLES = `
      * {
        box-sizing: border-box;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .tc-underline {
        position: fixed;
        height: 3px;
        border-radius: 2px;
        pointer-events: auto;
        cursor: pointer;
        transition: opacity 0.2s, height 0.1s;
      }

      .tc-underline:hover {
        height: 4px;
        opacity: 0.9;
      }

      /* Status Button */
      .tc-status-btn {
        position: fixed;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        background: var(--tc-surface);
        border: 1px solid var(--tc-border);
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        cursor: pointer;
        pointer-events: auto;
        font-size: 12px;
        font-family: 'JetBrains Mono', monospace;
        color: var(--tc-text-2);
        /* Not left/top: the button must jump to its spot and follow drags without lag. */
        transition: box-shadow 0.2s, background 0.2s, border-color 0.2s;
        z-index: 2147483646;
      }

      .tc-status-btn.tc-dragging {
        cursor: grabbing;
        transition: none;
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.18);
      }

      .tc-status-btn:hover {
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
        border-color: var(--tc-border-strong);
        background: var(--tc-surface-2);
      }

      .tc-status-btn.tc-loading {
        color: var(--tc-muted);
      }

      .tc-status-btn.tc-has-errors {
        border-color: var(--tc-danger-border);
        background: var(--tc-danger-bg);
      }

      .tc-status-btn.tc-no-errors {
        border-color: var(--tc-ok-border);
        background: var(--tc-ok-bg);
      }

      .tc-status-icon {
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .tc-status-icon svg {
        width: 15px;
        height: 15px;
      }

      .tc-spinner {
        width: 14px;
        height: 14px;
        border: 2px solid var(--tc-border-strong);
        border-top-color: var(--tc-accent);
        border-radius: 50%;
        animation: tc-spin 0.8s linear infinite;
      }

      @keyframes tc-spin {
        to { transform: rotate(360deg); }
      }

      .tc-error-count {
        background: var(--tc-accent);
        color: var(--tc-surface);
        font-size: 11px;
        font-weight: 600;
        font-family: 'JetBrains Mono', monospace;
        padding: 1px 5px;
        border-radius: 6px;
        min-width: 18px;
        text-align: center;
      }

      /* Suggestion Panel */
      .tc-panel {
        position: fixed;
        background: var(--tc-surface);
        border: 1px solid var(--tc-border);
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04);
        width: 360px;
        max-height: 420px;
        overflow: hidden;
        pointer-events: auto;
        animation: tc-slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        z-index: 2147483647;
      }

      @keyframes tc-slideUp {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .tc-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        border-bottom: 1px solid var(--tc-border);
        background: var(--tc-surface-2);
      }

      .tc-panel-title {
        font-family: 'Lora', Georgia, serif;
        font-weight: 700;
        font-size: 14px;
        color: var(--tc-text);
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
      }

      .tc-panel-title svg {
        width: 16px;
        height: 16px;
        color: var(--tc-accent);
      }

      .tc-panel-close {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        color: var(--tc-muted);
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
      }

      .tc-panel-close:hover {
        background: var(--tc-surface-3);
        color: var(--tc-text);
      }

      .tc-panel-body {
        max-height: 350px;
        overflow-y: auto;
        background: var(--tc-surface);
      }

      .tc-panel-empty {
        padding: 32px 16px;
        text-align: center;
        color: var(--tc-muted);
        font-family: 'Lora', Georgia, serif;
      }

      .tc-panel-empty-icon {
        font-size: 28px;
        margin-bottom: 8px;
      }

      /* Individual suggestion card in panel */
      .tc-suggestion-card {
        padding: 12px 14px;
        border-bottom: 1px solid var(--tc-surface-3);
        cursor: pointer;
        transition: background 0.15s;
      }

      .tc-suggestion-card:hover {
        background: var(--tc-surface-2);
      }

      .tc-suggestion-card:last-child {
        border-bottom: none;
      }

      .tc-suggestion-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }

      .tc-badge {
        font-size: 10px;
        font-family: 'JetBrains Mono', monospace;
        font-weight: 600;
        text-transform: uppercase;
        padding: 2px 6px;
        border-radius: 4px;
        color: white;
      }

      .tc-suggestion-text {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        flex-wrap: wrap;
      }

      .tc-original {
        color: var(--tc-accent);
        text-decoration: line-through;
        font-family: 'Lora', Georgia, serif;
      }

      .tc-arrow {
        color: var(--tc-faint);
      }

      .tc-replacement {
        color: var(--tc-success);
        font-weight: 600;
        font-family: 'Lora', Georgia, serif;
      }

      .tc-explanation {
        color: var(--tc-text-3);
        font-size: 12px;
        margin-top: 4px;
        line-height: 1.45;
      }

      .tc-suggestion-actions {
        display: flex;
        gap: 8px;
        margin-top: 8px;
      }

      .tc-btn {
        padding: 5px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 0.15s;
        font-family: 'Inter', sans-serif;
      }

      .tc-btn-primary {
        background: var(--tc-text);
        color: var(--tc-surface-2);
        border-color: var(--tc-text);
      }

      .tc-btn-primary:hover {
        background: var(--tc-text-2);
      }

      .tc-btn-secondary {
        background: var(--tc-surface-3);
        color: var(--tc-text-2);
        border-color: var(--tc-border-strong);
      }

      .tc-btn-secondary:hover {
        background: var(--tc-border-strong);
        color: var(--tc-text);
      }

      .tc-btn-sm {
        padding: 3px 8px;
        font-size: 11px;
      }

      /* Keyboard focus (US-16) */
      .tc-btn:focus-visible,
      .tc-panel-close:focus-visible,
      .tc-status-btn:focus-visible {
        outline: 2px solid var(--tc-accent);
        outline-offset: 2px;
      }

      /* Inline Popover (shown on underline click) */
      .tc-popover {
        position: fixed;
        background: var(--tc-surface);
        border: 1px solid var(--tc-border);
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14), 0 0 0 1px rgba(0, 0, 0, 0.04);
        padding: 12px;
        min-width: 280px;
        max-width: 380px;
        z-index: 2147483647;
        pointer-events: auto;
        animation: tc-fadeIn 0.15s ease-out;
      }

      @keyframes tc-fadeIn {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .tc-popover-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        flex-wrap: wrap;
      }

      .tc-popover-actions {
        display: flex;
        gap: 8px;
        margin-top: 10px;
      }

      .tc-popover-actions .tc-btn {
        flex: 1;
      }

      .tc-btn-text {
        background: none;
        color: var(--tc-muted);
        padding: 5px 8px;
        flex: 0 !important;
        border: none;
      }

      .tc-btn-text:hover {
        color: var(--tc-text);
        background: var(--tc-surface-3);
      }
    `;

    // Create Shadow DOM container
    function createOverlayContainer(): HTMLDivElement {
      if (overlayContainer && document.body.contains(overlayContainer)) {
        return overlayContainer;
      }

      overlayContainer = document.createElement("div");
      overlayContainer.id = "textchecker-overlay";
      overlayContainer.style.cssText =
        "position: fixed; top: 0; left: 0; width: 0; height: 0; pointer-events: none; z-index: 2147483647;";
      setThemeAttribute(overlayContainer, settings.theme);

      const shadow = overlayContainer.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = OVERLAY_THEME_CSS + STYLES;
      shadow.appendChild(style);
      document.body.appendChild(overlayContainer);

      return overlayContainer;
    }

    function cleanup() {
      currentSuggestions = [];
      hideStatusButton();
      hideSuggestionPanel();
      hidePopover();
      if (activeElementResizeObserver) {
        activeElementResizeObserver.disconnect();
        activeElementResizeObserver = null;
      }
      if (overlayContainer?.shadowRoot) {
        overlayContainer.shadowRoot
          .querySelectorAll(".tc-underline")
          .forEach((el) => el.remove());
      }
    }

    // Check grammar via background script
    async function checkGrammarRequest(
      text: string,
      forceCheck = false
    ): Promise<GrammarCheckResult | null> {
      if (!text.trim()) return null;

      try {
        const response = await browser.runtime.sendMessage({
          type: "CHECK_GRAMMAR",
          payload: { text, forceCheck },
        });

        if (response && response.success) {
          return response.result;
        } else {
          console.error("Grammar check failed:", response?.error);
          showStatusButton("error");
          return null;
        }
      } catch (error) {
        console.error("Failed to send message to background:", error);
        showStatusButton("error");
        return null;
      }
    }

    // SVG Icons
    const ICONS = {
      check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
      alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
      close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
      pencil: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    };

    // Show/update status button near the active element
    function showStatusButton(
      state: "loading" | "errors" | "clean" | "error",
      errorCount = 0
    ) {
      if (!activeElement) return;

      const uiLang = settings.uiLanguage || "vi";
      const t = getT(uiLang);

      const container = createOverlayContainer();
      const shadow = container.shadowRoot!;

      // Remove existing button
      shadow.querySelectorAll(".tc-status-btn").forEach((el) => el.remove());

      const rect = activeElement.getBoundingClientRect();
      statusButton = document.createElement("div");
      statusButton.className = `tc-status-btn ${
        state === "loading"
          ? "tc-loading"
          : state === "errors" || state === "error"
          ? "tc-has-errors"
          : "tc-no-errors"
      }`;

      // Bottom-right of the element, shifted by wherever the user dragged it
      statusButton.style.cssText = "left: -9999px; top: -9999px;";

      if (state === "loading") {
        statusButton.innerHTML = `
          <div class="tc-status-icon"><div class="tc-spinner"></div></div>
        `;
      } else if (state === "errors") {
        statusButton.innerHTML = `
          <div class="tc-status-icon" style="color: var(--tc-danger-icon);">${ICONS.alert}</div>
          <span class="tc-error-count">${errorCount}</span>
        `;
        statusButton.title = `${t.issuesFound(errorCount)}\n${t.statusDragHint}`;
      } else if (state === "error") {
        statusButton.innerHTML = `
          <div class="tc-status-icon" style="color: var(--tc-danger-icon);">${ICONS.alert}</div>
          <span style="color: var(--tc-danger); font-size: 11px; font-weight: 600;">${t.errorState}</span>
        `;
        statusButton.title = `${t.errorState}\n${t.statusDragHint}`;
      } else {
        statusButton.title = t.statusDragHint;
        statusButton.innerHTML = `
          <div class="tc-status-icon" style="color: var(--tc-success-icon);">${ICONS.check}</div>
          <span style="color: var(--tc-success);">${t.allGood}</span>
        `;
      }

      // Prevent mousedown from triggering outside-click handlers
      statusButton.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      const btn = statusButton;
      const dragged = makeStatusButtonDraggable(btn);

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragged()) return; // the press ended a drag, not a click
        if (state === "errors" && currentSuggestions.length > 0) {
          toggleSuggestionPanel();
        }
      });

      // US-16: the status button is a real button for keyboard and screen reader users.
      btn.setAttribute("role", "button");
      btn.tabIndex = 0;
      btn.setAttribute("aria-label", (btn.title || t.allGood).split("\n")[0]);
      btn.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        if (state === "errors" && currentSuggestions.length > 0) {
          if (suggestionPanel) hideSuggestionPanel();
          else showSuggestionPanel({ focus: true });
        }
      });

      btn.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeElement) statusButtonOffsets.delete(activeElement);
        updateStatusButtonPosition();
      });

      shadow.appendChild(btn);
      updateStatusButtonPosition();
    }

    /**
     * Lets the user drag the status button away from text it covers. The offset is kept
     * per field (relative to its default bottom-right spot) so the button follows the
     * field when it scrolls or resizes, and survives the button being re-rendered.
     */
    function makeStatusButtonDraggable(btn: HTMLDivElement): () => boolean {
      const DRAG_THRESHOLD = 4;
      let start: { x: number; y: number; left: number; top: number } | null = null;
      let moved = false;

      btn.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        moved = false;
        start = { x: e.clientX, y: e.clientY, left: btn.offsetLeft, top: btn.offsetTop };
        btn.setPointerCapture(e.pointerId);
      });

      btn.addEventListener("pointermove", (e) => {
        if (!start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        if (!moved) {
          moved = true;
          btn.classList.add("tc-dragging");
          hideSuggestionPanel();
        }
        const pos = clampStatusButton(btn, start.left + dx, start.top + dy);
        btn.style.left = `${pos.left}px`;
        btn.style.top = `${pos.top}px`;
      });

      const end = (e: PointerEvent) => {
        if (!start) return;
        start = null;
        if (btn.hasPointerCapture(e.pointerId)) btn.releasePointerCapture(e.pointerId);
        btn.classList.remove("tc-dragging");
        if (moved && activeElement) {
          const base = defaultStatusButtonPosition(activeElement.getBoundingClientRect());
          statusButtonOffsets.set(activeElement, {
            dx: btn.offsetLeft - base.left,
            dy: btn.offsetTop - base.top,
          });
        }
      };
      btn.addEventListener("pointerup", end);
      btn.addEventListener("pointercancel", end);

      return () => moved;
    }

    function hideStatusButton() {
      if (overlayContainer?.shadowRoot) {
        overlayContainer.shadowRoot
          .querySelectorAll(".tc-status-btn")
          .forEach((el) => el.remove());
      }
      statusButton = null;
    }

    // Suggestion Panel (shows all suggestions)
    function toggleSuggestionPanel() {
      if (suggestionPanel) {
        hideSuggestionPanel();
      } else {
        showSuggestionPanel();
      }
    }

    let releasePanelTrap: (() => void) | null = null;
    let panelOrigin: FocusOrigin | null = null;

    function showSuggestionPanel(options: { focus?: boolean } = {}) {
      if (!activeElement || currentSuggestions.length === 0) return;
      selectionLookup?.hideAll();

      const uiLang = settings.uiLanguage || "vi";
      const t = getT(uiLang);

      hideSuggestionPanel();
      hidePopover();

      const container = createOverlayContainer();
      const shadow = container.shadowRoot!;

      // Anchor to the status button once the user has dragged it away, so the panel
      // opens next to it instead of covering it; otherwise under the field as before.
      const moved = statusButton && statusButtonOffsets.has(activeElement);
      const rect = moved ? statusButton!.getBoundingClientRect() : activeElement.getBoundingClientRect();
      suggestionPanel = document.createElement("div");
      suggestionPanel.className = "tc-panel";
      suggestionPanel.setAttribute("role", "dialog");

      // Position panel
      let left = moved ? Math.min(rect.left, window.innerWidth - 370) : rect.right - 370;
      let top = rect.bottom + 8;

      if (left < 10) left = 10;
      if (top + 400 > window.innerHeight) {
        top = rect.top - 410;
        if (top < 10) top = 10;
      }

      suggestionPanel.style.cssText = `left: ${left}px; top: ${top}px;`;

      const errorCount = currentSuggestions.length;
      suggestionPanel.innerHTML = `
        <div class="tc-panel-header">
          <div class="tc-panel-title">
            ${ICONS.pencil}
            <span>${t.issuesFound(errorCount)}</span>
          </div>
          <button class="tc-panel-close" data-action="close-panel" title="${escapeHtml(t.close)}" aria-label="${escapeHtml(t.close)}">${
            ICONS.close
          }</button>
        </div>
        <div class="tc-panel-body">
          ${currentSuggestions
            .map(
              (s, i) => `
            <div class="tc-suggestion-card" data-index="${i}">
              <div class="tc-suggestion-header">
                <span class="tc-badge" style="background: ${getSuggestionColor(
                  s.type
                )}">${getSuggestionLabel(s.type, uiLang)}</span>
              </div>
              <div class="tc-suggestion-text">
                <span class="tc-original">${escapeHtml(s.original)}</span>
                <span class="tc-arrow">→</span>
                <span class="tc-replacement">${escapeHtml(s.replacement)}</span>
              </div>
              <div class="tc-explanation">${escapeHtml(s.explanation)}</div>
              <div class="tc-suggestion-actions">
                <button class="tc-btn tc-btn-primary tc-btn-sm" data-action="apply" data-index="${i}">${t.applyCorrection}</button>
                <button class="tc-btn tc-btn-secondary tc-btn-sm" data-action="ignore" data-index="${i}">${t.ignore}</button>
                ${
                  s.type === "spelling"
                    ? `<button class="tc-btn tc-btn-text tc-btn-sm" data-action="dictionary" data-index="${i}">+ ${t.addToDict}</button>`
                    : ""
                }
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      `;

      // Event delegation for panel actions
      suggestionPanel.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      suggestionPanel.addEventListener("click", async (e) => {
        const target = e.target as HTMLElement;
        const btn = target.closest('[data-action]') as HTMLElement | null;
        const action = btn?.dataset.action || target.dataset.action;
        const indexStr = target.dataset.index;

        e.preventDefault();
        e.stopPropagation();

        if (action === "close-panel") {
          hideSuggestionPanel();
          return;
        }

        if (!indexStr) return;
        const index = parseInt(indexStr, 10);
        const suggestion = currentSuggestions[index];
        if (!suggestion) return;

        if (action === "apply") {
          await applySuggestion(suggestion);
          updatePanelAfterChange();
        } else if (action === "ignore") {
          ignoreSuggestion(suggestion);
          updatePanelAfterChange();
        } else if (action === "dictionary") {
          await addToDictionary(suggestion.original);
          ignoreSuggestion(suggestion);
          updatePanelAfterChange();
        }
      });

      // Highlight text when hovering over suggestion card
      suggestionPanel.addEventListener("mouseover", (e) => {
        const card = (e.target as HTMLElement).closest(
          ".tc-suggestion-card"
        ) as HTMLElement;
        if (card) {
          const index = parseInt(card.dataset.index || "0", 10);
          highlightSuggestion(index);
        }
      });

      shadow.appendChild(suggestionPanel);
      suggestionPanel.setAttribute("aria-label", t.issuesFound(errorCount));
      releasePanelTrap = trapFocus(suggestionPanel, { onEscape: () => hideSuggestionPanel() });
      if (options.focus) {
        panelOrigin = captureFocusOrigin(overlayContainer);
        focusInto(suggestionPanel, suggestionPanel.querySelector<HTMLElement>('[data-action="apply"]'));
      }

      // Close panel when clicking outside
      setTimeout(() => {
        document.addEventListener("mousedown", handlePanelOutsideClick, true);
      }, 10);
    }

    function handlePanelOutsideClick(e: MouseEvent) {
      // Use composedPath to properly detect clicks inside shadow DOM
      const path = e.composedPath();
      const clickedInPanel = suggestionPanel && path.includes(suggestionPanel);
      const clickedOnStatusBtn = statusButton && path.includes(statusButton);

      if (!clickedInPanel && !clickedOnStatusBtn) {
        hideSuggestionPanel();
        document.removeEventListener(
          "mousedown",
          handlePanelOutsideClick,
          true
        );
      }
    }

    function hideSuggestionPanel() {
      releasePanelTrap?.();
      releasePanelTrap = null;
      const origin = panelOrigin;
      panelOrigin = null;
      if (origin && containsFocus(suggestionPanel)) origin.restore();
      if (suggestionPanel?.parentNode) {
        suggestionPanel.remove();
      }
      suggestionPanel = null;
      document.removeEventListener("mousedown", handlePanelOutsideClick, true);
    }

    function updatePanelAfterChange() {
      // A panel used from the keyboard keeps focus after re-rendering.
      const keyboard = containsFocus(suggestionPanel);
      if (currentSuggestions.length === 0) {
        hideSuggestionPanel();
        showStatusButton("clean");
      } else {
        // Re-render panel
        hideSuggestionPanel();
        showSuggestionPanel({ focus: keyboard });
        showStatusButton("errors", currentSuggestions.length);
      }
      renderUnderlines();
    }

    function highlightSuggestion(index: number) {
      const suggestion = currentSuggestions[index];
      if (!suggestion || !activeElement) return;

      // Scroll the text into view if needed
      if (activeElement.tagName.toLowerCase() === "textarea") {
        // Could implement scroll to position for textarea
      }
    }

    // Get character position rectangles
    function getCharacterRects(
      element: HTMLElement,
      startIndex: number,
      endIndex: number,
      model?: TextModel
    ): DOMRect[] {
      const tagName = element.tagName.toLowerCase();

      if (tagName === "textarea" || tagName === "input") {
        return getTextareaCharacterRects(
          element as HTMLTextAreaElement | HTMLInputElement,
          startIndex,
          endIndex
        );
      }

      // contenteditable: offsets of the shared text model (US-11), the one the checked text came from.
      const range = getContenteditableRange(element, startIndex, endIndex, model);
      return range ? Array.from(range.getClientRects()) : [];
    }

    // Inline popover (shown on underline click)
    let currentPopover: HTMLDivElement | null = null;
    /** Suggestion shown in the popover (the shortcut moves to the next one, US-16). */
    let popoverSuggestion: GrammarSuggestion | null = null;
    let releasePopoverTrap: (() => void) | null = null;
    /** Where focus was before the popover took it from the keyboard; restored on close. */
    let popoverOrigin: FocusOrigin | null = null;

    function showPopover(
      suggestion: GrammarSuggestion,
      anchorRect: DOMRect,
      boundElement: HTMLElement | null = activeElement,
      options: { focus?: boolean } = {}
    ) {
      hidePopover();
      hideSuggestionPanel();
      selectionLookup?.hideAll();

      const container = createOverlayContainer();
      const shadow = container.shadowRoot!;

      currentPopover = document.createElement("div");
      currentPopover.className = "tc-popover";
      currentPopover.setAttribute("role", "dialog");

      // Position
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - anchorRect.bottom;
      const showAbove = spaceBelow < 180;

      let left = anchorRect.left;
      if (left + 300 > viewportWidth) left = viewportWidth - 310;
      if (left < 10) left = 10;

      currentPopover.style.left = `${left}px`;
      if (showAbove) {
        currentPopover.style.bottom = `${
          viewportHeight - anchorRect.top + 8
        }px`;
      } else {
        currentPopover.style.top = `${anchorRect.bottom + 8}px`;
      }

      const uiLang = settings.uiLanguage || "vi";
      const t = getT(uiLang);
      const color = getSuggestionColor(suggestion.type);
      const label = getSuggestionLabel(suggestion.type, uiLang);

      currentPopover.innerHTML = `
        <div class="tc-popover-header">
          <span class="tc-badge" style="background: ${color}">${label}</span>
          <span class="tc-original">${escapeHtml(suggestion.original)}</span>
          <span class="tc-arrow">→</span>
          <span class="tc-replacement">${escapeHtml(
            suggestion.replacement
          )}</span>
        </div>
        <div class="tc-explanation">${escapeHtml(suggestion.explanation)}</div>
        <div class="tc-popover-actions">
          <button class="tc-btn tc-btn-primary" data-action="apply">${t.applyCorrection}</button>
          <button class="tc-btn tc-btn-secondary" data-action="ignore">${t.ignore}</button>
          ${
            suggestion.type === "spelling"
              ? `<button class="tc-btn tc-btn-text" data-action="dictionary">+ ${t.addToDict}</button>`
              : ""
          }
        </div>
      `;

      currentPopover.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      currentPopover.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const target = e.target as HTMLElement;
        const btn = target.closest('[data-action]') as HTMLElement | null;
        const action = btn?.dataset.action || target.dataset.action;

        if (action === "apply") {
          hidePopover();
          await applySuggestion(suggestion, boundElement);
          updateStatusAfterChange();
        } else if (action === "ignore") {
          ignoreSuggestion(suggestion);
          hidePopover();
          updateStatusAfterChange();
        } else if (action === "dictionary") {
          await addToDictionary(suggestion.original);
          ignoreSuggestion(suggestion);
          hidePopover();
          updateStatusAfterChange();
        }
      });

      shadow.appendChild(currentPopover);
      currentPopover.setAttribute("aria-label", `${label}: ${suggestion.original} → ${suggestion.replacement}`);
      popoverSuggestion = suggestion;
      // US-16: Tab stays on the popover's buttons, Esc closes it.
      releasePopoverTrap = trapFocus(currentPopover, { onEscape: () => hidePopover() });
      if (options.focus) {
        popoverOrigin = captureFocusOrigin(overlayContainer);
        focusInto(currentPopover, currentPopover.querySelector<HTMLElement>('[data-action="apply"]'));
      }

      // Close on outside click - with delay to prevent immediate close
      if (popoverCloseTimeout) clearTimeout(popoverCloseTimeout);
      popoverCloseTimeout = setTimeout(() => {
        document.addEventListener("mousedown", handlePopoverOutsideClick, true);
      }, 100);
    }

    function handlePopoverOutsideClick(e: MouseEvent) {
      // Use composedPath to properly detect clicks inside shadow DOM
      const path = e.composedPath();

      // Check if click is inside popover
      if (currentPopover && path.includes(currentPopover)) {
        return;
      }

      // Check if click is on an underline (will open new popover)
      const shadow = overlayContainer?.shadowRoot;
      if (shadow) {
        const underlines = shadow.querySelectorAll(".tc-underline");
        for (const underline of underlines) {
          if (path.includes(underline)) {
            return;
          }
        }
      }

      hidePopover();
    }

    function hidePopover() {
      if (popoverCloseTimeout) {
        clearTimeout(popoverCloseTimeout);
        popoverCloseTimeout = null;
      }
      document.removeEventListener(
        "mousedown",
        handlePopoverOutsideClick,
        true
      );

      releasePopoverTrap?.();
      releasePopoverTrap = null;
      // Focus goes back to the text field (caret where it was) when the popover had it.
      const origin = popoverOrigin;
      popoverOrigin = null;
      if (origin && containsFocus(currentPopover)) origin.restore();

      if (currentPopover?.parentNode) {
        currentPopover.remove();
      }
      currentPopover = null;
      popoverSuggestion = null;
    }

    function updateStatusAfterChange() {
      if (currentSuggestions.length === 0) {
        showStatusButton("clean");
      } else {
        showStatusButton("errors", currentSuggestions.length);
      }
      renderUnderlines();
    }

    function escapeHtml(text: string): string {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    async function applySuggestion(
      suggestion: GrammarSuggestion,
      targetOverride: HTMLElement | null = null
    ): Promise<boolean> {
      const targetEl = targetOverride || activeElement;
      if (!targetEl) return false;

      let ok = false;
      try {
        ok = await applyReplacementToElement(
          targetEl,
          suggestion.startIndex,
          suggestion.endIndex,
          suggestion.original,
          suggestion.replacement
        );
      } catch (error) {
        console.error("[TextChecker] Apply failed:", error);
      }
      if (!ok) {
        console.warn("[TextChecker] Could not apply suggestion:", suggestion);
        return false;
      }

      const lengthDiff =
        suggestion.replacement.length - suggestion.original.length;
      currentSuggestions = currentSuggestions
        .filter((s) => s.id !== suggestion.id)
        .map((s) => {
          if (s.startIndex >= suggestion.endIndex) {
            return {
              ...s,
              startIndex: s.startIndex + lengthDiff,
              endIndex: s.endIndex + lengthDiff,
            };
          }
          return s;
        });

      browser.runtime
        .sendMessage({ type: "CORRECTION_APPLIED" })
        .catch(() => {});
      return true;
    }

    function ignoreSuggestion(suggestion: GrammarSuggestion) {
      currentSuggestions = currentSuggestions.filter(
        (s) => s.id !== suggestion.id
      );
    }

    /**
     * "+ Add to dictionary" on a spelling error: saves the word with ignoreSpelling
     * (US-05/06) and drops its other occurrences in the current results at once.
     */
    async function addToDictionary(word: string) {
      try {
        await browser.runtime.sendMessage({
          type: "ADD_TO_DICTIONARY",
          payload: { word },
        });
        const key = word.trim().toLowerCase();
        currentSuggestions = currentSuggestions.filter(
          (s) => s.type !== "spelling" || s.original.trim().toLowerCase() !== key
        );
      } catch (error) {
        console.error("Failed to add to dictionary:", error);
      }
    }

    function renderUnderlines() {
      const container = createOverlayContainer();
      const shadow = container.shadowRoot!;

      shadow.querySelectorAll(".tc-underline").forEach((el) => el.remove());

      if (!activeElement || currentSuggestions.length === 0) return;

      // One text model for all underlines of a contenteditable (built once per render).
      const tag = activeElement.tagName.toLowerCase();
      const model = tag === "textarea" || tag === "input" ? undefined : buildTextModel(activeElement);

      currentSuggestions.forEach((suggestion) => {
        const rects = getCharacterRects(
          activeElement!,
          suggestion.startIndex,
          suggestion.endIndex,
          model
        );

        rects.forEach((rect) => {
          if (rect.width <= 0 || rect.height <= 0) return;

          const underline = document.createElement("div");
          underline.className = "tc-underline";
          underline.style.cssText = `
            left: ${rect.left}px;
            top: ${rect.bottom - 2}px;
            width: ${Math.max(rect.width, 4)}px;
            background: ${getSuggestionColor(suggestion.type)};
          `;

          underline.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
          });

          underline.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            showPopover(suggestion, rect);
          });

          shadow.appendChild(underline);
        });
      });
    }

    // Event handlers
    function defaultStatusButtonPosition(rect: DOMRect) {
      return {
        left: Math.min(rect.right - 80, window.innerWidth - 90),
        top: Math.min(rect.bottom - 32, window.innerHeight - 40),
      };
    }

    /** Keeps the whole button inside the viewport. */
    function clampStatusButton(btn: HTMLElement, left: number, top: number) {
      const margin = 4;
      const maxLeft = window.innerWidth - (btn.offsetWidth || 80) - margin;
      const maxTop = window.innerHeight - (btn.offsetHeight || 28) - margin;
      return {
        left: Math.max(margin, Math.min(left, maxLeft)),
        top: Math.max(margin, Math.min(top, maxTop)),
      };
    }

    function updateStatusButtonPosition() {
      if (statusButton && activeElement) {
        const base = defaultStatusButtonPosition(activeElement.getBoundingClientRect());
        const offset = statusButtonOffsets.get(activeElement) ?? { dx: 0, dy: 0 };
        const pos = clampStatusButton(statusButton, base.left + offset.dx, base.top + offset.dy);
        statusButton.style.left = `${pos.left}px`;
        statusButton.style.top = `${pos.top}px`;
      }
    }

    function attachElementObservers(el: HTMLElement) {
      if (activeElementResizeObserver) {
        activeElementResizeObserver.disconnect();
      }
      activeElementResizeObserver = new ResizeObserver(() => {
        if (activeElement && currentSuggestions.length > 0) {
          renderUnderlines();
          updateStatusButtonPosition();
        }
      });
      activeElementResizeObserver.observe(el);
    }

    function handleFocus(element: HTMLElement) {
      const target = getTargetEditableElement(element) || element;
      if (!settings.enabled || !isEditableElement(target)) return;

      activeElement = target;
      attachElementObservers(element);

      if (settings.checkMode === "realtime") {
        const text = getTextFromElement(target);
        if (text.trim().length > 0) {
          debouncedCheck(text);
        }
      }
    }

    function handleBlur(e?: FocusEvent) {
      const related = e?.relatedTarget as HTMLElement | null;
      if (
        related &&
        (overlayContainer?.contains(related) ||
          overlayContainer?.shadowRoot?.contains(related) ||
          related === activeElement)
      ) {
        return;
      }

      setTimeout(() => {
        if (
          document.activeElement === activeElement ||
          currentPopover ||
          suggestionPanel
        ) {
          return;
        }

        cleanup();
        activeElement = null;
      }, 200);
    }

    function handleInput(element: HTMLElement) {
      const target = getTargetEditableElement(element) || element;
      if (!settings.enabled || !isEditableElement(target)) return;

      activeElement = target;
      hideSuggestionPanel();
      hidePopover();

      if (settings.checkMode === "realtime") {
        const text = getTextFromElement(target);
        if (text.trim().length > 0) {
          debouncedCheck(text);
        } else {
          cleanup();
        }
      }
    }

    const debouncedCheck = debounce(async (text: string) => {
      if (!activeElement) return;

      const requestId = ++currentRequestId;
      showStatusButton("loading");

      try {
        const result = await checkGrammarRequest(text);
        if (requestId !== currentRequestId) {
          return;
        }

        if (result && activeElement) {
          const currentText = getTextFromElement(activeElement);
          if (currentText === result.text) {
            currentSuggestions = result.suggestions;
            renderUnderlines();

            if (currentSuggestions.length > 0) {
              showStatusButton("errors", currentSuggestions.length);
            } else {
              showStatusButton("clean");
            }
          }
        }
      } catch (error) {
        if (requestId === currentRequestId) {
          console.error("Grammar check error:", error);
          showStatusButton("error");
        }
      }
    }, settings.realtimeDelay);

    /** Checks the focused field now (shortcut / manual mode); resolves when results are shown. */
    async function runManualCheck(): Promise<void> {
      if (!activeElement) return;
      const text = getTextFromElement(activeElement);
      if (text.trim().length === 0) return;
      showStatusButton("loading");
      try {
        const result = await checkGrammarRequest(text, true);
        if (result) {
          currentSuggestions = result.suggestions;
          renderUnderlines();
          if (currentSuggestions.length > 0) {
            showStatusButton("errors", currentSuggestions.length);
          } else {
            showStatusButton("clean");
          }
        }
      } catch {
        showStatusButton("error");
      }
    }

    /** Caret offset in the field's checked text (input/textarea value, or the shared text model). */
    function caretOffset(el: HTMLElement): number | null {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.selectionStart;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      const range = sel.getRangeAt(0);
      if (!el.contains(range.startContainer)) return null;
      return offsetOfPosition(buildTextModel(el), range.startContainer, range.startOffset);
    }

    /** Opens the popover of one suggestion with focus on "Apply" (keyboard flow, US-16). */
    function openSuggestionFromKeyboard(index: number) {
      const el = activeElement;
      const suggestion = currentSuggestions[index];
      if (!el || !suggestion) return;
      const rects = getCharacterRects(el, suggestion.startIndex, suggestion.endIndex);
      const anchor = rects.find((r) => r.width > 0 || r.height > 0) ?? el.getBoundingClientRect();
      showPopover(suggestion, anchor, el, { focus: true });
    }

    /**
     * Shortcut "check grammar" (US-16). In a text field: check it and open the error at the
     * caret; each further press opens the next error. Elsewhere: analyze the grammar of the
     * selected sentence, or of the sentence around the caret (US-17).
     */
    async function grammarFromKeyboard() {
      if (googleDocsHandler.isGoogleDocs()) {
        googleDocsHandler.triggerManualCheck();
        return;
      }
      // Popover already open (focused or not): next error.
      if (currentPopover && popoverSuggestion && currentSuggestions.length > 0) {
        openSuggestionFromKeyboard(nextSuggestion(currentSuggestions, popoverSuggestion));
        return;
      }
      const focused = deepActiveElement();
      const ownUi = !!overlayContainer && (focused === overlayContainer || !!overlayContainer.shadowRoot?.contains(focused));
      const field = focused instanceof HTMLElement && !ownUi ? getTargetEditableElement(focused) || focused : null;
      if (field && isEditableElement(field)) {
        if (!settings.enabled) return;
        activeElement = field;
        attachElementObservers(field);
        const caret = caretOffset(field);
        await runManualCheck();
        if (activeElement === field && currentSuggestions.length > 0) {
          openSuggestionFromKeyboard(suggestionAtCaret(currentSuggestions, caret));
        }
        return;
      }
      selectionLookup?.analyzeFromCommand();
    }

    // Esc closes the grammar popover/panel opened with the mouse (focus still in the field).
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Escape" || (!currentPopover && !suggestionPanel)) return;
        if (overlayContainer && e.composedPath().includes(overlayContainer)) return; // trapFocus handles it
        e.preventDefault();
        e.stopPropagation();
        hidePopover();
        hideSuggestionPanel();
      },
      true
    );

    // Message listener for keyboard shortcut
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === RUN_COMMAND) {
        // The background sends to every frame of the tab: only the focused one acts.
        if (!document.hasFocus()) return;
        const command = (message.payload as { command?: string } | undefined)?.command;
        if (command === COMMANDS.lookup) {
          selectionLookup?.lookupFromCommand();
          sendResponse({ handled: true });
        } else if (command === COMMANDS.grammar) {
          void grammarFromKeyboard();
          sendResponse({ handled: true });
        } else if (command === COMMANDS.assistant) {
          const sentence = selectionLookup?.selectedSentence() ?? null;
          if (sentence?.range) highlightContext(sentence.range);
          const reply: AssistantCommandReply = {
            handled: true,
            context: sentence ? { sentence: sentence.text, url: location.href, title: document.title } : null,
          };
          sendResponse(reply);
        }
        return;
      }
      if (message.type === CONTEXT_MENU_ANALYZE) {
        const { text } = message.payload as { text: string };
        if (!selectionLookup) return;
        selectionLookup.analyzeFromContextMenu(text);
        sendResponse({ handled: true });
        return;
      }
      if (message.type === CONTEXT_MENU_LOOKUP) {
        const { text, save } = message.payload as { text: string; save: boolean };
        if (!selectionLookup) return;
        selectionLookup.openFromContextMenu(text, save);
        sendResponse({ handled: true });
        return;
      }
      if (message.type === "CLEAR_CHAT_HIGHLIGHT") {
        clearContextHighlight();
        return;
      }
      if (message.type === "TRIGGER_CHECK") {
        if (googleDocsHandler.isGoogleDocs()) {
          googleDocsHandler.triggerManualCheck();
        } else {
          void runManualCheck();
        }
      }
    });

    // Setup event listeners
    document.addEventListener(
      "focusin",
      (e) => {
        if (e.target instanceof HTMLElement) handleFocus(e.target);
      },
      true
    );

    document.addEventListener(
      "focusout",
      (e) => handleBlur(e as FocusEvent),
      true
    );

    document.addEventListener(
      "input",
      (e) => {
        if (e.target instanceof HTMLElement) handleInput(e.target);
      },
      true
    );

    const handleScroll = debounce(() => {
      if (activeElement && currentSuggestions.length > 0) {
        renderUnderlines();
        updateStatusButtonPosition();
      }
    }, 50);

    window.addEventListener("scroll", handleScroll, {
      passive: true,
      capture: true,
    });
    document.addEventListener("scroll", handleScroll, {
      passive: true,
      capture: true,
    });

    window.addEventListener(
      "resize",
      () => {
        if (activeElement && currentSuggestions.length > 0) {
          renderUnderlines();
          updateStatusButtonPosition();
        }
      },
      { passive: true }
    );

    ctx.onInvalidated(() => {
      textareaObserver.stop();
      googleDocsHandler.stop();
      selectionLookup?.stop();
      stopVocabHighlight();
      cleanup();
      if (unwatchSettings) unwatchSettings();
    });
  },
});
