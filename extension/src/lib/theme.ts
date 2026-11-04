/**
 * Light / dark theme (US-15).
 *
 * Extension pages (popup, options, side panel) get `data-theme` on <html>; `src/styles.css`
 * swaps the colour tokens for it. The overlay on web pages (lookup card, grammar popover…)
 * lives in a shadow root: its host gets the same attribute and `OVERLAY_THEME_CSS` defines
 * the `--tc-*` variables used by the overlay styles.
 *
 * "system" leaves the attribute off, so `prefers-color-scheme` decides.
 */
import type { ThemePreference } from '@/types';

/** localStorage key: lets a page paint in the right theme before settings are read. */
const CACHE_KEY = 'tc-theme';

export function normalizeTheme(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/** Sets or removes `data-theme` on an element ("system" removes it). */
export function setThemeAttribute(el: HTMLElement, theme: ThemePreference | undefined): void {
  const value = normalizeTheme(theme);
  if (value === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', value);
}

/** Applies the theme to an extension page and remembers it for the next load. */
export function applyPageTheme(theme: ThemePreference | undefined): void {
  setThemeAttribute(document.documentElement, theme);
  try {
    localStorage.setItem(CACHE_KEY, normalizeTheme(theme));
  } catch {
    // Storage blocked: the page still follows settings once they are loaded.
  }
}

/** Applies the last known theme synchronously (call before the first render). */
export function applyCachedPageTheme(): void {
  try {
    setThemeAttribute(document.documentElement, normalizeTheme(localStorage.getItem(CACHE_KEY)));
  } catch {
    // ignore
  }
}

const LIGHT_VARS = `
  --tc-surface: #FFFFFF;
  --tc-surface-2: #F5F5F7;
  --tc-surface-3: #ECECEF;
  --tc-border: #E5E5EA;
  --tc-border-strong: #E0E0E5;
  --tc-text: #1D1D1F;
  --tc-text-2: #3A3A3C;
  --tc-text-3: #545458;
  --tc-muted: #6E6E73;
  --tc-faint: #A1A1A6;
  --tc-accent: #3460C8;
  --tc-accent-soft: #EEF2FC;
  --tc-on-accent: #FFFFFF;
  --tc-star: #C58A00;
  --tc-note-bg: #FBF8EE;
  --tc-note-border: #EFE6C8;
  --tc-success: #15803D;
  --tc-success-icon: #22C55E;
  --tc-danger: #DC2626;
  --tc-danger-icon: #EF4444;
  --tc-danger-bg: #FFF5F5;
  --tc-danger-border: #F87171;
  --tc-ok-bg: #F0FDF4;
  --tc-ok-border: #86EFAC;
  --tc-shadow: rgba(0, 0, 0, 0.12);
  color-scheme: light;
`;

const DARK_VARS = `
  --tc-surface: #1F1F22;
  --tc-surface-2: #2A2A2E;
  --tc-surface-3: #333338;
  --tc-border: #3A3A3F;
  --tc-border-strong: #4A4A50;
  --tc-text: #ECECEF;
  --tc-text-2: #D1D1D6;
  --tc-text-3: #B4B4BA;
  --tc-muted: #9A9AA0;
  --tc-faint: #6E6E75;
  --tc-accent: #86A7F0;
  --tc-accent-soft: #26324D;
  --tc-on-accent: #111114;
  --tc-star: #E3AC35;
  --tc-note-bg: #2B2820;
  --tc-note-border: #4A4331;
  --tc-success: #4ADE80;
  --tc-success-icon: #4ADE80;
  --tc-danger: #F87171;
  --tc-danger-icon: #F87171;
  --tc-danger-bg: #3A2224;
  --tc-danger-border: #8A3B3E;
  --tc-ok-bg: #1C3326;
  --tc-ok-border: #2F6B45;
  --tc-shadow: rgba(0, 0, 0, 0.45);
  color-scheme: dark;
`;

/** Colour variables for the shadow-DOM overlay; prepend to its stylesheet. */
export const OVERLAY_THEME_CSS = `
  :host { ${LIGHT_VARS} }
  :host([data-theme="dark"]) { ${DARK_VARS} }
  @media (prefers-color-scheme: dark) {
    :host(:not([data-theme="light"])) { ${DARK_VARS} }
  }
`;
