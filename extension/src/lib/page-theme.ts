import { settingsStorage } from '@/lib/storage';
import { applyCachedPageTheme, applyPageTheme } from '@/lib/theme';

/**
 * Keeps an extension page (popup, options, side panel) in the theme chosen in settings (US-15).
 * The cached value is applied first so the page does not flash light before settings load.
 */
export function initPageTheme(): void {
  applyCachedPageTheme();
  void settingsStorage.getValue().then((s) => applyPageTheme(s.theme));
  settingsStorage.watch((s) => applyPageTheme(s.theme));
}
