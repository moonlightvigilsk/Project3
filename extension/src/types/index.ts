export type AIProvider = 'google' | 'openai' | 'anthropic';

export type CheckMode = 'realtime' | 'ondemand';

export type SuggestionType = 'grammar' | 'spelling' | 'style' | 'punctuation';

/** How the selection lookup is triggered: show a button, open the card at once, or only while Alt is held. */
export type SelectionLookupTrigger = 'button' | 'instant' | 'alt';

/** External dictionaries the lookup card links to (US-03). */
export type DictionarySourceId = 'larousse' | 'lerobert' | 'cnrtl' | 'google' | 'wiktionary';

export interface DictionarySourcePref {
  id: DictionarySourceId;
  enabled: boolean;
}

/**
 * Default order. Wiktionary is off by default: the card's top bar already links to it.
 */
export const DEFAULT_SOURCE_PREFS: DictionarySourcePref[] = [
  { id: 'larousse', enabled: true },
  { id: 'lerobert', enabled: true },
  { id: 'cnrtl', enabled: true },
  { id: 'google', enabled: true },
  { id: 'wiktionary', enabled: false },
];

/**
 * Repairs stored preferences: anything but an array is ignored, unknown or duplicate ids
 * are dropped, and sources added by a newer version are appended with their defaults,
 * so every known source appears exactly once. Never throws.
 */
export function normalizeSourcePrefs(stored: unknown): DictionarySourcePref[] {
  const known = new Set<string>(DEFAULT_SOURCE_PREFS.map((p) => p.id));
  const out: DictionarySourcePref[] = [];
  const seen = new Set<string>();
  if (Array.isArray(stored)) {
    for (const item of stored) {
      if (!item || typeof item !== 'object') continue;
      const { id, enabled } = item as Partial<DictionarySourcePref>;
      if (typeof id !== 'string' || !known.has(id) || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, enabled: enabled !== false });
    }
  }
  for (const def of DEFAULT_SOURCE_PREFS) {
    if (!seen.has(def.id)) out.push({ ...def });
  }
  return out;
}

export interface SelectionLookupSettings {
  enabled: boolean;
  trigger: SelectionLookupTrigger;
  /** External dictionary buttons on the card, in display order. */
  sources: DictionarySourcePref[];
}

export type UILanguage = 'vi' | 'en' | 'fr';

export interface APIKeys {
  google?: string;
  openai?: string;
  anthropic?: string;
}

/** Colour theme of the extension UI (US-15). "system" follows the OS / browser setting. */
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  provider: AIProvider;
  model: string;
  customModel?: string;
  checkMode: CheckMode;
  language: string;
  uiLanguage?: UILanguage;
  enabled: boolean;
  realtimeDelay: number;
  selectionLookup: SelectionLookupSettings;
  /** US-09: highlight saved words (not yet known) on pages. Off by default. */
  vocabHighlight: boolean;
  /** US-10: number of words due for review on the toolbar icon. On by default. */
  reviewBadge: boolean;
  /** US-15: light / dark UI. Follows the system by default. */
  theme: ThemePreference;
  /** US-17: base URL of the grammar backend (`backend/`, FastAPI), without `/api`. */
  backendUrl: string;
}

/** Learning state of a vocabulary entry (same values as the backend `vocabulary_items.status`). */
export type VocabStatus = 'new' | 'learning' | 'known';

/**
 * One word of the personal notebook (US-05). A single record serves both uses:
 * - `saved`: the word is in the learner's list (☆ on the lookup card),
 * - `ignoreSpelling`: spelling errors on it are not reported (old "personal dictionary").
 * An entry exists while at least one of the two is true.
 *
 * Field names follow backend/app/models/vocabulary.py (see `toBackendVocabulary`):
 * word ↔ surface_form, definitions ↔ definition, contextSentence ↔ context_sentence,
 * createdAt/updatedAt ↔ created_at/updated_at (epoch ms here, ISO there).
 */
export interface VocabEntry {
  /** Normalized lemma (NFC, trimmed, lowercase): one entry per word. */
  id: string;
  /** Form as met in the text ("mangeons"). */
  word: string;
  /** Dictionary form ("manger"); equals `word` when unknown. */
  lemma: string;
  pos: string | null;
  gender: 'm' | 'f' | 'mf' | null;
  ipa: string | null;
  definitions: string[];
  note: string;
  contextSentence: string | null;
  /** Page where the word was met. */
  sourceUrl: string | null;
  sourceTitle: string | null;
  status: VocabStatus;
  /** In the learner's word list (flashcards, export). Not in the AC field list: see above. */
  saved: boolean;
  ignoreSpelling: boolean;
  createdAt: number;
  updatedAt: number;
  reviewCount: number;
  /** US-10 flashcards (simplified SM-2): next review time, epoch ms (0 = due now). */
  dueAt: number;
  /** SM-2 ease factor (≥ 1.3, starts at 2.5). */
  ease: number;
  /** Current interval between reviews, in days (0 = not learned yet). */
  intervalDays: number;
}

export interface GrammarSuggestion {
  id: string;
  original: string;
  replacement: string;
  explanation: string;
  type: SuggestionType;
  startIndex: number;
  endIndex: number;
}

export interface GrammarCheckResult {
  suggestions: GrammarSuggestion[];
  text: string;
  language: string;
  timestamp: number;
}

export interface TextFieldInfo {
  id: string;
  element: HTMLElement;
  text: string;
  rect: DOMRect;
}

export interface CacheEntry {
  text: string;
  result: GrammarCheckResult;
  timestamp: number;
}

export const DEFAULT_SETTINGS: Settings = {
  provider: 'google',
  model: 'gemini-2.5-flash',
  checkMode: 'realtime',
  language: 'auto',
  uiLanguage: 'vi',
  enabled: true,
  realtimeDelay: 500,
  selectionLookup: {
    enabled: true,
    trigger: 'button',
    sources: DEFAULT_SOURCE_PREFS,
  },
  vocabHighlight: false,
  reviewBadge: true,
  theme: 'system',
  backendUrl: 'http://127.0.0.1:8000',
};

/** Fill in fields missing from settings saved by an older version of the extension. */
export function withDefaultSettings(stored: Partial<Settings> | null | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...(stored ?? {}),
    selectionLookup: {
      ...DEFAULT_SETTINGS.selectionLookup,
      ...(stored?.selectionLookup ?? {}),
      sources: normalizeSourcePrefs(stored?.selectionLookup?.sources),
    },
    vocabHighlight: stored?.vocabHighlight === true,
    reviewBadge: stored?.reviewBadge !== false,
    theme: stored?.theme === 'light' || stored?.theme === 'dark' ? stored.theme : 'system',
    backendUrl:
      typeof stored?.backendUrl === 'string' && stored.backendUrl.trim() ? stored.backendUrl.trim() : DEFAULT_SETTINGS.backendUrl,
  };
}

export const AVAILABLE_MODELS: Record<AIProvider, { id: string; name: string }[]> = {
  google: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recommended)' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (Fastest)' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Recommended)' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
    { id: 'o1-mini', name: 'o1 Mini (Reasoning)' },
  ],
  anthropic: [
    { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku (Recommended)' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
  ],
};

export const SUPPORTED_LANGUAGES = [
  { code: 'auto', name: 'Auto-detect' },
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French (Français)' },
  { code: 'vi', name: 'Vietnamese (Tiếng Việt)' },
  { code: 'de', name: 'German (Deutsch)' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'it', name: 'Italian (Italiano)' },
  { code: 'pt', name: 'Portuguese (Português)' },
  { code: 'nl', name: 'Dutch (Nederlands)' },
  { code: 'pl', name: 'Polish (Polski)' },
  { code: 'ru', name: 'Russian (Русский)' },
  { code: 'ja', name: 'Japanese (日本語)' },
  { code: 'zh', name: 'Chinese (中文)' },
];

export type MessageType =
  | 'CHECK_GRAMMAR'
  | 'GRAMMAR_RESULT'
  | 'GET_SETTINGS'
  | 'SETTINGS_UPDATED'
  | 'APPLY_SUGGESTION'
  | 'TOGGLE_EXTENSION';

export interface Message<T = unknown> {
  type: MessageType;
  payload?: T;
}
