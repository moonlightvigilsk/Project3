import { useEffect, useState } from 'react';
import { Server } from 'lucide-react';
import type { Translations } from '@/lib/i18n';
import type { Settings } from '@/types';
import { normalizeBackendUrl } from '@/lib/grammar/backend';
import { BACKEND_START_COMMAND, CHECK_BACKEND, DEFAULT_BACKEND_URL, type BackendCheckReply } from '@/lib/grammar/types';

type Status = { kind: 'idle' } | { kind: 'testing' } | { kind: 'done'; reply: BackendCheckReply } | { kind: 'invalid' };

/** US-17: address of the grammar backend, with a connection test. */
export function BackendSection({
  settings,
  saveSettings,
  t,
}: {
  settings: Settings;
  saveSettings: (s: Settings) => void | Promise<void>;
  t: Translations;
}) {
  const [value, setValue] = useState(settings.backendUrl);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  // Follow changes made elsewhere (another options tab, a reset).
  useEffect(() => setValue(settings.backendUrl), [settings.backendUrl]);

  /** Saves the typed address when valid; returns the normalized URL. */
  function commit(raw: string): string | null {
    const url = normalizeBackendUrl(raw);
    if (!url) {
      setStatus({ kind: 'invalid' });
      return null;
    }
    setValue(url);
    if (url !== settings.backendUrl) void saveSettings({ ...settings, backendUrl: url });
    return url;
  }

  async function test() {
    const url = commit(value);
    if (!url) return;
    setStatus({ kind: 'testing' });
    try {
      const reply = (await browser.runtime.sendMessage({ type: CHECK_BACKEND, payload: { backendUrl: url } })) as
        | { success?: boolean; reply?: BackendCheckReply }
        | undefined;
      setStatus({ kind: 'done', reply: reply?.reply ?? { status: 'unreachable' } });
    } catch {
      setStatus({ kind: 'done', reply: { status: 'unreachable' } });
    }
  }

  let message: { text: string; ok: boolean } | null = null;
  if (status.kind === 'invalid') message = { text: t.backendInvalidUrl, ok: false };
  else if (status.kind === 'testing') message = { text: t.backendTesting, ok: true };
  else if (status.kind === 'done') {
    const r = status.reply;
    message =
      r.status === 'ok'
        ? { text: t.backendOk(r.rules), ok: true }
        : r.status === 'unreachable'
          ? { text: t.backendUnreachable, ok: false }
          : { text: t.backendError(r.httpStatus, r.message), ok: false };
  }

  return (
    <div className="pt-2 border-t border-stone-border">
      <label htmlFor="backend-url" className="block text-xs font-semibold text-ink-800 uppercase tracking-wider">
        {t.backendTitle}
      </label>
      <p className="text-[11px] text-ink-500 mt-1">{t.backendDesc}</p>
      <div className="mt-2 flex items-center gap-2">
        <input
          id="backend-url"
          type="url"
          inputMode="url"
          spellCheck={false}
          value={value}
          placeholder={DEFAULT_BACKEND_URL}
          onChange={(e) => {
            setValue(e.target.value);
            setStatus({ kind: 'idle' });
          }}
          onBlur={() => {
            if (value.trim()) commit(value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void test();
            }
          }}
          className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-stone-border bg-white text-xs font-mono text-ink-900 focus:outline-2 focus:outline-french-bordeaux"
        />
        <button
          type="button"
          onClick={() => void test()}
          disabled={status.kind === 'testing'}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-border bg-parchment-100 text-xs font-medium text-ink-800 hover:border-ink-400 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-french-bordeaux"
        >
          <Server className="w-3.5 h-3.5" aria-hidden="true" />
          {t.backendTest}
        </button>
        {settings.backendUrl !== DEFAULT_BACKEND_URL && (
          <button
            type="button"
            onClick={() => {
              setValue(DEFAULT_BACKEND_URL);
              setStatus({ kind: 'idle' });
              void saveSettings({ ...settings, backendUrl: DEFAULT_BACKEND_URL });
            }}
            className="shrink-0 px-2 py-1.5 text-xs text-ink-600 hover:text-ink-900 underline-offset-2 hover:underline"
          >
            {t.backendReset}
          </button>
        )}
      </div>
      {message && (
        <p role="status" className={`mt-1.5 text-[11px] ${message.ok ? 'text-ink-600' : 'text-french-bordeaux'}`}>
          {message.text}
        </p>
      )}
      {status.kind === 'done' && status.reply.status === 'unreachable' && (
        <p className="mt-1 text-[11px] text-ink-600">
          {t.analysisStartHint} <code className="font-mono select-all">{BACKEND_START_COMMAND}</code>
        </p>
      )}
    </div>
  );
}
