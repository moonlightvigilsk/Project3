import { rewriteText } from '@/lib/ai/grammar-check';
import { ENABLE_AI } from '@/lib/config';
import { getGrammarChecker } from '@/lib/checker';
import { settingsStorage, apiKeysStorage, getCachedResult, setCachedResult, incrementStats } from '@/lib/storage';
import type { GrammarSuggestion } from '@/types';
import { lookupWord } from '@/lib/dictionary/wiktionary';
import type { LookupResponse } from '@/lib/dictionary/types';
import { VOCABULARY_KEY, parseMeta } from '@/lib/vocabulary/model';
import { CONTEXT_MENU_LOOKUP } from '@/lib/selection/messages';
import { contextMenuFallback, contextMenuQuery } from '@/lib/selection/context-menu';
import { getT } from '@/lib/i18n';
import { normalizeLookupQuery } from '@/lib/dictionary/normalize';
import { isOutdatedLookup, LookupCache } from '@/lib/dictionary/cache';
import { NO_OFFSCREEN, OFFSCREEN_PLAY_AUDIO } from '@/lib/audio-messages';
import { VocabularyStore, type VocabCommand } from '@/lib/vocabulary/store';
import { VOCAB_COMMAND, VOCAB_ENSURE, VOCAB_IMPORT } from '@/lib/vocabulary/client';
import { badgeText } from '@/lib/vocabulary/review';
import { runChat } from '@/lib/chat/chat';
import { setPendingContext } from '@/lib/chat/storage';
import { COMMANDS, RUN_COMMAND, type AssistantCommandReply } from '@/lib/commands';
import { openAssistantPanel } from '@/lib/side-panel';
import type { ChatContext, ChatReply, ChatRequest } from '@/lib/chat/types';
import {
  AnalysisCache,
  analyzeWithBackend,
  backendUrlOrDefault,
  checkBackend,
  fetchRule,
  normalizeBackendUrl,
  normalizeSentence,
  RuleCatalog,
  RuleDetailCache,
  submitPractice,
} from '@/lib/grammar/backend';
import {
  addAttempt,
  attemptFromResult,
  parseHistory,
  PRACTICE_HISTORY_KEY,
  PRACTICE_SUBMIT,
  type PracticeReply,
  type PracticeRequest,
} from '@/lib/grammar/practice';
import { GRAMMAR_RULE, type GrammarRuleReply } from '@/lib/grammar/rule';
import {
  ANALYZE_GRAMMAR,
  CHECK_BACKEND,
  CONTEXT_MENU_ANALYZE,
  OPEN_OPTIONS,
  type AnalyzeGrammarReply,
  type BackendCheckReply,
} from '@/lib/grammar/types';

/** Personal vocabulary notebook (US-05); the background is its only writer. */
const vocabulary = new VocabularyStore({
  get: (keys) => (keys.length > 0 ? browser.storage.local.get(keys) : Promise.resolve({})),
  set: (items) => browser.storage.local.set(items),
  remove: (keys) => browser.storage.local.remove(keys),
  getLegacyDictionary: async () => (await browser.storage.sync.get('dictionary')).dictionary,
});

const lookupCache = new LookupCache({
  get: async (key) => (await browser.storage.local.get(key))[key],
  set: (key, value) => browser.storage.local.set({ [key]: value }),
  remove: (keys) => browser.storage.local.remove(keys),
});

/** Only pronunciation recordings from Wikimedia are played (US-04). */
function isAllowedAudioUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && (hostname === 'commons.wikimedia.org' || hostname === 'upload.wikimedia.org');
  } catch {
    return false;
  }
}

let creatingOffscreen: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<boolean> {
  // Chrome only; Firefox has no offscreen documents (the content script plays audio itself).
  const offscreen = (browser as Partial<typeof browser>).offscreen;
  if (!offscreen) return false;
  if (await offscreen.hasDocument()) return true;
  creatingOffscreen ??= offscreen
    .createDocument({
      url: 'offscreen.html',
      reasons: [offscreen.Reason.AUDIO_PLAYBACK],
      justification: 'Play French pronunciation recordings from Wiktionary',
    })
    .finally(() => {
      creatingOffscreen = null;
    });
  await creatingOffscreen;
  return true;
}

/** Plays a recording in the offscreen document, out of reach of the page's CSP. */
async function playInOffscreen(url: string): Promise<{ success: boolean; error?: string }> {
  if (!isAllowedAudioUrl(url)) return { success: false, error: 'URL not allowed' };
  if (!(await ensureOffscreenDocument())) return { success: false, error: NO_OFFSCREEN };
  const reply = (await browser.runtime.sendMessage({ type: OFFSCREEN_PLAY_AUDIO, url })) as
    | { success: boolean; error?: string }
    | undefined;
  return reply ?? { success: false, error: 'no reply from offscreen document' };
}

/** Dictionary lookup through the cache (used by the card and the context menu). */
async function lookupCached(text: string): Promise<LookupResponse> {
  const query = normalizeLookupQuery(text);
  const cached = await lookupCache.get(query);
  if (cached && !isOutdatedLookup(cached)) return cached;
  const response = await lookupWord(text);
  await lookupCache.set(query, response);
  return response;
}

// --- Grammar analysis (US-17) ---------------------------------------------------

const ruleCatalog = new RuleCatalog((input, init) => fetch(input, init));
// storage.session keeps analyses while the browser runs, across service-worker restarts.
const sessionArea = (browser.storage as Partial<typeof browser.storage>).session;
const analysisCache = new AnalysisCache(
  sessionArea
    ? {
        get: async (key) => (await sessionArea.get(key))[key],
        set: (key, value) => sessionArea.set({ [key]: value }),
      }
    : null
);

async function analyzeGrammar(text: string): Promise<AnalyzeGrammarReply> {
  const baseUrl = backendUrlOrDefault((await settingsStorage.getValue()).backendUrl);
  const sentence = normalizeSentence(text);
  if (!sentence) return { status: 'ok', analysis: { sentence, structures: [] } };
  const cached = await analysisCache.get(baseUrl, sentence);
  if (cached) return { status: 'ok', analysis: cached };
  const reply = await analyzeWithBackend(baseUrl, sentence, (input, init) => fetch(input, init), ruleCatalog);
  if (reply.status === 'ok') await analysisCache.set(baseUrl, sentence, reply.analysis);
  return reply;
}

const ruleCache = new RuleDetailCache();

/** US-18: grammar card of one rule (backend catalog). */
async function grammarRule(ruleId: string): Promise<GrammarRuleReply> {
  const baseUrl = backendUrlOrDefault((await settingsStorage.getValue()).backendUrl);
  const cached = ruleCache.get(baseUrl, ruleId);
  if (cached) return { status: 'ok', rule: cached };
  const reply = await fetchRule(baseUrl, ruleId, (input, init) => fetch(input, init));
  if (reply.status === 'ok') ruleCache.set(baseUrl, ruleId, reply.rule);
  return reply;
}

/** Practice history writes are chained so two quick attempts never overwrite each other. */
let historyWrites: Promise<void> = Promise.resolve();

/** US-19: grade a sentence on the backend, then keep the attempt in storage.local. */
async function practice(req: PracticeRequest): Promise<PracticeReply> {
  const baseUrl = backendUrlOrDefault((await settingsStorage.getValue()).backendUrl);
  const reply = await submitPractice(baseUrl, req, (input, init) => fetch(input, init));
  if (reply.status === 'ok') {
    const attempt = attemptFromResult(reply.result, req);
    historyWrites = historyWrites.then(async () => {
      try {
        const history = parseHistory((await browser.storage.local.get(PRACTICE_HISTORY_KEY))[PRACTICE_HISTORY_KEY]);
        await browser.storage.local.set({ [PRACTICE_HISTORY_KEY]: addAttempt(history, attempt) });
      } catch (error) {
        console.warn('TextChecker: could not save the practice attempt', error);
      }
    });
    await historyWrites;
  }
  return reply;
}

// --- Context menu (US-06) -----------------------------------------------------

const MENU_LOOKUP = 'tc-lookup';
const MENU_SAVE = 'tc-save-vocab';
const MENU_ANALYZE = 'tc-analyze-grammar';

let menusReady: Promise<void> = Promise.resolve();

/** (Re)creates the menus; calls are chained so two rebuilds never race on the same ids. */
function createContextMenus(): Promise<void> {
  menusReady = menusReady.then(async () => {
    try {
      const t = getT((await settingsStorage.getValue()).uiLanguage || 'vi');
      await browser.contextMenus.removeAll();
      browser.contextMenus.create({ id: MENU_LOOKUP, title: t.ctxLookup, contexts: ['selection'] });
      browser.contextMenus.create({ id: MENU_SAVE, title: t.ctxSaveToVocab, contexts: ['selection'] });
      browser.contextMenus.create({ id: MENU_ANALYZE, title: t.ctxAnalyze, contexts: ['selection'] });
    } catch (error) {
      console.warn('TextChecker: could not create the context menu', error);
    }
  });
  return menusReady;
}

/**
 * The content script of the clicked frame opens the card at the selection (and saves
 * the word with its sentence). Where no content script runs (browser pages, the PDF
 * viewer...), lookup opens Wiktionary and saving happens here without the sentence.
 */
async function onContextMenuClick(info: Browser.contextMenus.OnClickData, tab?: Browser.tabs.Tab) {
  const text = (info.selectionText ?? '').trim();
  if (!text) return;
  if (info.menuItemId === MENU_ANALYZE) {
    // Pages without a content script (browser pages, the PDF viewer) have no card to show.
    if (tab?.id !== undefined && tab.id >= 0) {
      await browser.tabs
        .sendMessage(tab.id, { type: CONTEXT_MENU_ANALYZE, payload: { text } }, { frameId: info.frameId ?? 0 })
        .catch(() => {});
    }
    return;
  }
  const save = info.menuItemId === MENU_SAVE;
  if (tab?.id !== undefined && tab.id >= 0) {
    try {
      const reply = (await browser.tabs.sendMessage(
        tab.id,
        { type: CONTEXT_MENU_LOOKUP, payload: { text, save } },
        { frameId: info.frameId ?? 0 }
      )) as { handled?: boolean } | undefined;
      if (reply?.handled) return;
    } catch {
      // No content script in that frame: fall back below.
    }
  }
  const query = contextMenuQuery(text);
  const response = query ? await lookupCached(query) : null;
  const action = contextMenuFallback(text, save, response, { url: tab?.url ?? null, title: tab?.title ?? null });
  if (action.type === 'save') await vocabulary.apply({ op: 'save', draft: action.draft });
  else if (action.type === 'open') await browser.tabs.create({ url: action.url, index: tab ? tab.index + 1 : undefined });
}

// --- Keyboard shortcuts (US-16) -----------------------------------------------

/** Opens the options page on the vocabulary tab, reusing an open options tab. */
async function openVocabularyPage() {
  const url = browser.runtime.getURL('/options.html');
  // runtime.getContexts (Chrome 116+) finds our own tabs without the "tabs" permission.
  const contexts = await browser.runtime.getContexts?.({ contextTypes: ['TAB' as Browser.runtime.ContextType] }).catch(() => []);
  const existing = contexts?.find((c) => c.tabId >= 0 && c.documentUrl?.startsWith(url));
  if (existing) {
    await browser.tabs.update(existing.tabId, { active: true, url: `${url}#vocabulary` });
    if (existing.windowId >= 0) await browser.windows.update(existing.windowId, { focused: true });
  } else {
    await browser.tabs.create({ url: `${url}#vocabulary` });
  }
}

async function onCommand(command: string, commandTab?: Browser.tabs.Tab) {
  // open-assistant: sidePanel.open() needs the shortcut's user gesture, so it runs before any await.
  const tabId = commandTab?.id;
  const opening =
    command === COMMANDS.assistant && tabId !== undefined && tabId >= 0
      ? openAssistantPanel({ tabId })
      : null;

  if (command === COMMANDS.vocabulary) {
    await openVocabularyPage();
    return;
  }
  const tab = commandTab?.id !== undefined ? commandTab : (await browser.tabs.query({ active: true, currentWindow: true }))[0];
  if (tab?.id === undefined || tab.id < 0) return;
  let reply: AssistantCommandReply | undefined;
  try {
    reply = (await browser.tabs.sendMessage(tab.id, { type: RUN_COMMAND, payload: { command } })) as AssistantCommandReply | undefined;
  } catch {
    // No content script on this page (browser pages, the PDF viewer): nothing to act on.
  }
  if (command === COMMANDS.assistant) {
    await opening;
    if (reply?.context) await setPendingContext({ ...reply.context, tabId: tab.id, sentAt: Date.now() });
  }
}

// --- Review badge (US-10) ------------------------------------------------------

const DUE_ALARM = 'tc-vocab-due';
const BADGE_COLOR = '#3460C8';
let badgeUpdates: Promise<void> = Promise.resolve();

/**
 * Shows the number of words due for review on the toolbar icon, and sets an alarm for
 * the moment the next word becomes due (the count changes with time, not only with
 * storage). Updates are chained so an older count never overwrites a newer one.
 */
function updateReviewBadge(): Promise<void> {
  badgeUpdates = badgeUpdates.then(async () => {
    try {
      // No notebook yet: nothing due. Not loading here keeps the first-run migration where
      // it was (first real use), instead of running it on every service-worker start.
      const settings = await settingsStorage.getValue();
      const hasNotebook = !!parseMeta((await browser.storage.local.get(VOCABULARY_KEY))[VOCABULARY_KEY]);
      const { due, nextDueAt } =
        settings.reviewBadge && hasNotebook ? await vocabulary.dueSummary() : { due: 0, nextDueAt: null };
      const t = getT(settings.uiLanguage || 'vi');
      await browser.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
      await browser.action.setBadgeTextColor?.({ color: '#FFFFFF' });
      await browser.action.setBadgeText({ text: badgeText(due) });
      await browser.action.setTitle({ title: due > 0 ? `TextChecker · ${t.reviewBadgeTitle(due)}` : 'TextChecker' });
      await browser.alarms.clear(DUE_ALARM);
      // Chrome fires alarms at most every 30 s.
      if (nextDueAt !== null) await browser.alarms.create(DUE_ALARM, { when: Math.max(nextDueAt, Date.now() + 30_000) });
    } catch (error) {
      console.warn('TextChecker: could not update the review badge', error);
    }
  });
  return badgeUpdates;
}

export default defineBackground(() => {
  console.log('TextChecker background script loaded (ENABLE_AI =', ENABLE_AI, ')');

  // Vocabulary (US-05): reload when storage is changed by anything but the store itself
  // (clear data, imports), and import words another computer adds to the old dictionary.
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[VOCABULARY_KEY]) {
      vocabulary.onStorageChanged(changes[VOCABULARY_KEY].newValue);
      void updateReviewBadge();
    }
    if (area === 'sync' && changes.dictionary) void vocabulary.importLegacy();
  });

  // US-10: due-word badge.
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === DUE_ALARM) void updateReviewBadge();
  });
  browser.runtime.onStartup.addListener(() => void updateReviewBadge());
  void updateReviewBadge();

  browser.runtime.onInstalled.addListener(() => void createContextMenus());
  browser.contextMenus.onClicked.addListener((info, tab) => void onContextMenuClick(info, tab));
  // Menu titles follow the interface language; the badge its setting (and tooltip language).
  let menuLanguage: string | undefined;
  let badgeSetting: boolean | undefined;
  settingsStorage.watch((s) => {
    const languageChanged = s.uiLanguage !== menuLanguage;
    if (languageChanged) {
      menuLanguage = s.uiLanguage;
      void createContextMenus();
    }
    if (languageChanged || s.reviewBadge !== badgeSetting) {
      badgeSetting = s.reviewBadge;
      void updateReviewBadge();
    }
  });

  // Handle messages from content scripts and popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // Keep the message channel open for async response
  });

  // US-16: keyboard shortcuts (src/lib/commands.ts).
  browser.commands.onCommand.addListener((command, tab) => void onCommand(command, tab));

  async function handleMessage(
    message: { type: string; payload?: unknown },
    sender: Browser.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) {
    try {
      switch (message.type) {
        case 'OPEN_CHAT': {
          // sidePanel.open() needs the user gesture of the click that sent this message,
          // so it is called before any await.
          const tabId = sender.tab?.id ?? null;
          const opening = tabId !== null ? openAssistantPanel({ tabId }) : Promise.resolve(false);
          const context = message.payload as ChatContext;
          await setPendingContext({ ...context, tabId, sentAt: Date.now() });
          await opening;
          sendResponse({ success: true });
          break;
        }

        case 'CHAT_SEND': {
          const request = message.payload as ChatRequest;
          let reply: ChatReply;
          if (!ENABLE_AI) {
            reply = { status: 'ai_disabled' };
          } else {
            const settings = await settingsStorage.getValue();
            const apiKey = (await apiKeysStorage.getValue())[settings.provider];
            if (!apiKey) {
              reply = { status: 'no_api_key', provider: settings.provider };
            } else {
              const modelId = settings.model === 'custom' ? settings.customModel : settings.model;
              try {
                reply = await runChat(request, {
                  provider: settings.provider,
                  model: modelId || settings.model,
                  apiKey,
                });
              } catch (error) {
                reply = { status: 'error', message: error instanceof Error ? error.message : String(error) };
              }
            }
          }
          sendResponse({ success: true, reply });
          break;
        }

        case 'CHECK_GRAMMAR': {
          const { text, forceCheck } = message.payload as { text: string; forceCheck?: boolean };

          // Check cache first (unless force check is requested)
          if (!forceCheck) {
            const cached = await getCachedResult(text);
            if (cached) {
              // Filter again: a word may have been ignored since the result was cached.
              const ignored = await vocabulary.ignoredSpellings();
              const result = {
                ...cached.result,
                suggestions: cached.result.suggestions.filter(
                  (s: GrammarSuggestion) => s.type !== 'spelling' || !ignored.has(s.original.trim().toLowerCase())
                ),
              };
              sendResponse({ success: true, result });
              return;
            }
          }

          // Get settings and API keys
          const settings = await settingsStorage.getValue();
          let apiKey: string | undefined;

          if (ENABLE_AI) {
            const apiKeys = await apiKeysStorage.getValue();
            apiKey = apiKeys[settings.provider];

            if (!apiKey) {
              sendResponse({
                success: false,
                error: `No API key configured for ${settings.provider}. Please add your API key in the extension settings.`,
              });
              return;
            }
          }

          // Perform grammar check using current checker (Mock or AI)
          const checker = getGrammarChecker();
          const modelId = settings.model === 'custom' ? settings.customModel : settings.model;
          const result = await checker.check(text, {
            language: settings.language,
            provider: settings.provider,
            model: modelId || settings.model,
            apiKey,
          });

          // Filter out words the user chose to ignore (vocabulary entries with ignoreSpelling)
          const ignored = await vocabulary.ignoredSpellings();
          result.suggestions = result.suggestions.filter((s: GrammarSuggestion) => {
            if (s.type === 'spelling') {
              return !ignored.has(s.original.trim().toLowerCase());
            }
            return true;
          });

          // Cache the result
          await setCachedResult(text, {
            text,
            result,
            timestamp: Date.now(),
          });

          // Update stats
          await incrementStats('checksPerformed');
          await incrementStats('errorsFound', result.suggestions.length);

          sendResponse({ success: true, result });
          break;
        }

        case 'REWRITE_TEXT': {
          if (!ENABLE_AI) {
            sendResponse({
              success: false,
              error: 'Rewrite feature is disabled in offline mode.',
            });
            return;
          }

          const { text, style } = message.payload as {
            text: string;
            style: 'formal' | 'casual' | 'concise' | 'elaborate';
          };

          const settings = await settingsStorage.getValue();
          const apiKeys = await apiKeysStorage.getValue();
          const apiKey = apiKeys[settings.provider];

          if (!apiKey) {
            sendResponse({
              success: false,
              error: `No API key configured for ${settings.provider}.`,
            });
            return;
          }

          const modelId = settings.model === 'custom' ? settings.customModel : settings.model;
          const rewritten = await rewriteText(text, style, {
            provider: settings.provider,
            model: modelId || settings.model,
            apiKey,
          });

          sendResponse({ success: true, result: rewritten });
          break;
        }

        case 'GET_SETTINGS': {
          const settings = await settingsStorage.getValue();
          const apiKeys = await apiKeysStorage.getValue();
          sendResponse({
            success: true,
            settings,
            enableAi: ENABLE_AI,
            hasApiKey: {
              google: !!apiKeys.google,
              openai: !!apiKeys.openai,
              anthropic: !!apiKeys.anthropic,
            },
          });
          break;
        }

        case 'ADD_TO_DICTIONARY': {
          // "+ Add to dictionary" on a spelling error: stop reporting this word.
          const { word } = message.payload as { word: string };
          await vocabulary.apply({ op: 'ignoreSpelling', word });
          sendResponse({ success: true });
          break;
        }

        case VOCAB_ENSURE: {
          await vocabulary.ensureReady();
          sendResponse({ success: true });
          break;
        }

        case VOCAB_COMMAND: {
          const entry = await vocabulary.apply(message.payload as VocabCommand);
          sendResponse({ success: true, entry });
          break;
        }

        case VOCAB_IMPORT: {
          sendResponse({ success: true, summary: await vocabulary.importEntries(message.payload) });
          break;
        }

        case ANALYZE_GRAMMAR: {
          const { sentence } = message.payload as { sentence: string };
          sendResponse({ success: true, reply: await analyzeGrammar(String(sentence ?? '')) });
          break;
        }

        case PRACTICE_SUBMIT: {
          const req = message.payload as PracticeRequest;
          if (!req || typeof req.sentence !== 'string' || !req.sentence.trim() || typeof req.ruleId !== 'string') {
            sendResponse({ success: false, error: 'invalid practice request' });
            break;
          }
          sendResponse({ success: true, reply: await practice(req) });
          break;
        }

        case GRAMMAR_RULE: {
          const { ruleId } = message.payload as { ruleId: string };
          sendResponse({ success: true, reply: await grammarRule(String(ruleId ?? '')) });
          break;
        }

        case CHECK_BACKEND: {
          const { backendUrl } = message.payload as { backendUrl: string };
          const url = normalizeBackendUrl(backendUrl);
          const reply: BackendCheckReply = url
            ? await checkBackend(url, (input, init) => fetch(input, init))
            : { status: 'error', httpStatus: null, message: 'invalid URL' };
          sendResponse({ success: true, reply });
          break;
        }

        case OPEN_OPTIONS: {
          await browser.runtime.openOptionsPage();
          sendResponse({ success: true });
          break;
        }

        case 'LOOKUP_WORD': {
          const { text } = message.payload as { text: string };
          sendResponse({ success: true, response: await lookupCached(text) });
          break;
        }

        case 'PLAY_AUDIO': {
          const { url } = message.payload as { url: string };
          sendResponse(await playInOffscreen(url));
          break;
        }

        case 'CORRECTION_APPLIED': {
          await incrementStats('correctionsApplied');
          sendResponse({ success: true });
          break;
        }

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }
});
