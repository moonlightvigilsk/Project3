/**
 * Keyboard shortcuts of the extension (US-16).
 *
 * Browser-wide shortcuts are declared as `commands` in wxt.config.ts (Chrome allows four
 * with a suggested key); the user changes them at chrome://extensions/shortcuts. The
 * background routes each command to the content script of the focused frame with
 * `RUN_COMMAND`.
 *
 * Alt+Shift+letter avoids Chrome's own shortcuts (Ctrl+Shift+G is "Find previous",
 * Ctrl+Shift+D "Bookmark all tabs", Alt+Shift+A/I/T are taken by Chrome on Windows, and
 * Chrome refuses Alt+Shift+C as a suggested key, hence K for the assistant).
 */
export const COMMANDS = {
  lookup: 'lookup-selection',
  grammar: 'check-grammar',
  assistant: 'open-assistant',
  vocabulary: 'open-vocabulary',
} as const;

export type CommandName = (typeof COMMANDS)[keyof typeof COMMANDS];

/** Default keys, as in the manifest (shown when the browser cannot tell). */
export const DEFAULT_SHORTCUTS: Record<CommandName, string> = {
  'lookup-selection': 'Alt+Shift+D',
  'check-grammar': 'Alt+Shift+G',
  'open-assistant': 'Alt+Shift+K',
  'open-vocabulary': 'Alt+Shift+V',
};

/** Background -> content: run a command in the focused frame. Payload `{ command }`. */
export const RUN_COMMAND = 'RUN_COMMAND';

/** Content reply to `open-assistant`: the sentence to discuss, if any. */
export interface AssistantCommandReply {
  handled: boolean;
  context?: { sentence: string; url: string; title: string } | null;
}

/** Page where the user changes extension shortcuts. */
export function shortcutSettingsUrl(userAgent: string): string {
  if (/Edg\//.test(userAgent)) return 'edge://extensions/shortcuts';
  return 'chrome://extensions/shortcuts';
}

/** "Alt+Shift+D" -> "⌥⇧D" on macOS, unchanged elsewhere. */
export function formatShortcut(shortcut: string, isMac: boolean): string {
  if (!shortcut || !isMac) return shortcut;
  const symbols: Record<string, string> = { Alt: '⌥', Shift: '⇧', Ctrl: '⌃', MacCtrl: '⌃', Command: '⌘' };
  return shortcut
    .split('+')
    .map((part) => symbols[part] ?? part)
    .join('');
}

/**
 * In-panel shortcuts of the side panel menu (Alt+letter, matched on `KeyboardEvent.code`
 * so macOS Option characters do not matter). Alt+E/F are left to the browser menu.
 */
export const PANEL_MENU_KEYS = {
  bookmarks: 'KeyB',
  history: 'KeyH',
  vocab: 'KeyV',
  resources: 'KeyR',
  new: 'KeyN',
  settings: 'KeyS',
} as const;

export type PanelMenuItem = keyof typeof PANEL_MENU_KEYS;

/** Menu item for an Alt+letter key press, or null. */
export function panelMenuItemForKey(e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; code: string }): PanelMenuItem | null {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null;
  for (const [item, code] of Object.entries(PANEL_MENU_KEYS) as [PanelMenuItem, string][]) {
    if (code === e.code) return item;
  }
  return null;
}

/** Label of an in-panel key ("Alt+B", or "⌥B" on macOS). */
export function panelKeyLabel(item: PanelMenuItem, isMac: boolean): string {
  const letter = PANEL_MENU_KEYS[item].slice(3);
  return isMac ? `⌥${letter}` : `Alt+${letter}`;
}

export function isMacPlatform(nav: { platform?: string; userAgent?: string } = globalThis.navigator ?? {}): boolean {
  return /Mac|iPhone|iPad/.test(nav.platform || nav.userAgent || '');
}
