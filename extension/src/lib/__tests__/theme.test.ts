import { describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';
import { OVERLAY_THEME_CSS, normalizeTheme, setThemeAttribute } from '../theme';
import { withDefaultSettings } from '@/types';

describe('theme', () => {
  it('normalizes unknown values to system', () => {
    expect(normalizeTheme('dark')).toBe('dark');
    expect(normalizeTheme('light')).toBe('light');
    expect(normalizeTheme('blue')).toBe('system');
    expect(normalizeTheme(undefined)).toBe('system');
  });

  it('sets data-theme for light/dark and removes it for system', () => {
    const { document } = parseHTML('<html><body><div id="h"></div></body></html>');
    const el = document.getElementById('h') as unknown as HTMLElement;
    setThemeAttribute(el, 'dark');
    expect(el.getAttribute('data-theme')).toBe('dark');
    setThemeAttribute(el, 'system');
    expect(el.hasAttribute('data-theme')).toBe(false);
  });

  it('settings default to system and keep a saved choice', () => {
    expect(withDefaultSettings(null).theme).toBe('system');
    expect(withDefaultSettings({ theme: 'dark' }).theme).toBe('dark');
    expect(withDefaultSettings({ theme: 'nope' as never }).theme).toBe('system');
  });

  it('overlay CSS defines every variable in both themes', () => {
    const blocks = OVERLAY_THEME_CSS.split(/:host/).slice(1);
    const names = (b: string) => [...b.matchAll(/(--tc-[\w-]+):/g)].map((m) => m[1]).sort();
    expect(names(blocks[1])).toEqual(names(blocks[0]));
  });
});
