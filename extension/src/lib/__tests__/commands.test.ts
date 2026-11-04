import { describe, expect, it } from 'vitest';
import {
  COMMANDS,
  DEFAULT_SHORTCUTS,
  formatShortcut,
  isMacPlatform,
  panelKeyLabel,
  panelMenuItemForKey,
  shortcutSettingsUrl,
} from '../commands';

const key = (code: string, mods: Partial<{ altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {}) => ({
  code,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...mods,
});

describe('commands', () => {
  it('has a default key for every command, all distinct', () => {
    const names = Object.values(COMMANDS);
    expect(Object.keys(DEFAULT_SHORTCUTS).sort()).toEqual([...names].sort());
    expect(new Set(Object.values(DEFAULT_SHORTCUTS)).size).toBe(names.length);
  });

  it('formats shortcuts with symbols on macOS only', () => {
    expect(formatShortcut('Alt+Shift+D', true)).toBe('⌥⇧D');
    expect(formatShortcut('Alt+Shift+D', false)).toBe('Alt+Shift+D');
    expect(formatShortcut('', true)).toBe('');
  });

  it('points Edge users to their own shortcuts page', () => {
    expect(shortcutSettingsUrl('Mozilla/5.0 ... Chrome/130.0 Safari/537.36 Edg/130.0')).toBe('edge://extensions/shortcuts');
    expect(shortcutSettingsUrl('Mozilla/5.0 ... Chrome/130.0 Safari/537.36')).toBe('chrome://extensions/shortcuts');
  });

  it('maps Alt+letter to side panel menu items, by key code', () => {
    expect(panelMenuItemForKey(key('KeyB', { altKey: true }))).toBe('bookmarks');
    expect(panelMenuItemForKey(key('KeyH', { altKey: true }))).toBe('history');
    expect(panelMenuItemForKey(key('KeyS', { altKey: true }))).toBe('settings');
    expect(panelMenuItemForKey(key('KeyB'))).toBeNull();
    expect(panelMenuItemForKey(key('KeyB', { altKey: true, shiftKey: true }))).toBeNull();
    expect(panelMenuItemForKey(key('KeyB', { altKey: true, ctrlKey: true }))).toBeNull();
    // Alt+E / Alt+F stay with the browser menu.
    expect(panelMenuItemForKey(key('KeyE', { altKey: true }))).toBeNull();
    expect(panelMenuItemForKey(key('KeyF', { altKey: true }))).toBeNull();
  });

  it('labels panel keys per platform', () => {
    expect(panelKeyLabel('vocab', false)).toBe('Alt+V');
    expect(panelKeyLabel('vocab', true)).toBe('⌥V');
    expect(isMacPlatform({ platform: 'MacIntel' })).toBe(true);
    expect(isMacPlatform({ platform: 'Win32' })).toBe(false);
  });
});
