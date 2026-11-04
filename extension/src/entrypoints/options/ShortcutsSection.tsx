import { useEffect, useState } from 'react';
import { Keyboard } from 'lucide-react';
import type { Translations } from '@/lib/i18n';
import {
  COMMANDS,
  DEFAULT_SHORTCUTS,
  formatShortcut,
  isMacPlatform,
  shortcutSettingsUrl,
  type CommandName,
} from '@/lib/commands';

const ORDER: CommandName[] = [COMMANDS.lookup, COMMANDS.grammar, COMMANDS.assistant, COMMANDS.vocabulary];

function describe(name: CommandName, t: Translations): string {
  switch (name) {
    case COMMANDS.lookup:
      return t.shortcutLookup;
    case COMMANDS.grammar:
      return t.shortcutGrammar;
    case COMMANDS.assistant:
      return t.shortcutAssistant;
    case COMMANDS.vocabulary:
      return t.shortcutVocabulary;
  }
}

/** US-16: current keys of the extension's shortcuts, with a link to change them. */
export function ShortcutsSection({ t }: { t: Translations }) {
  /** Keys as the browser has them now (the user may have changed or removed them). */
  const [keys, setKeys] = useState<Partial<Record<CommandName, string>> | null>(null);
  const [openFailed, setOpenFailed] = useState(false);
  const isMac = isMacPlatform();
  const settingsUrl = shortcutSettingsUrl(navigator.userAgent);

  useEffect(() => {
    const load = () =>
      void browser.commands
        .getAll()
        .then((commands) => {
          const found: Partial<Record<CommandName, string>> = {};
          for (const c of commands) if (c.name && ORDER.includes(c.name as CommandName)) found[c.name as CommandName] = c.shortcut ?? '';
          setKeys(found);
        })
        .catch(() => setKeys({}));
    load();
    // Keys changed in the browser's shortcuts page show up when the user comes back.
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, []);

  async function openShortcutSettings() {
    setOpenFailed(false);
    try {
      const firefox = (browser.commands as unknown as { openShortcutSettings?: () => Promise<void> }).openShortcutSettings;
      if (firefox) await firefox();
      else await browser.tabs.create({ url: settingsUrl });
    } catch {
      setOpenFailed(true);
    }
  }

  return (
    <div className="pt-2 border-t border-stone-border">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="block text-xs font-semibold text-ink-800 uppercase tracking-wider">{t.shortcutsTitle}</h3>
          <p className="text-[11px] text-ink-500 mt-1">{t.shortcutsDesc}</p>
        </div>
        <button
          type="button"
          onClick={() => void openShortcutSettings()}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-border bg-parchment-100 text-xs font-medium text-ink-800 hover:border-ink-400 focus-visible:outline-2 focus-visible:outline-french-bordeaux"
        >
          <Keyboard className="w-3.5 h-3.5" aria-hidden="true" />
          {t.shortcutsChange}
        </button>
      </div>
      {openFailed && (
        <p className="mt-2 text-[11px] text-ink-600">
          {t.shortcutsOpenFailed} <code className="font-mono select-all">{settingsUrl}</code>
        </p>
      )}

      <dl className="mt-3 divide-y divide-stone-border rounded-lg border border-stone-border">
        {ORDER.map((name) => {
          const key = keys ? keys[name] ?? '' : DEFAULT_SHORTCUTS[name];
          return (
            <div key={name} className="flex items-center justify-between gap-4 px-3 py-2">
              <dt className="text-xs text-ink-800">{describe(name, t)}</dt>
              <dd>
                {key ? (
                  <kbd className="px-1.5 py-0.5 rounded border border-stone-border bg-parchment-100 font-mono text-[11px] text-ink-900 whitespace-nowrap">
                    {formatShortcut(key, isMac)}
                  </kbd>
                ) : (
                  <span className="text-[11px] italic text-ink-400">{t.shortcutNotSet}</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="text-[11px] text-ink-500 mt-2">{t.shortcutsInCards}</p>
      <p className="text-[11px] text-ink-500 mt-1">{t.shortcutsInPanel}</p>
    </div>
  );
}
