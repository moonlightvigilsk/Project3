import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import type { VocabEntry } from '@/types';
import type { Translations } from '@/lib/i18n';
import { downloadText } from '@/lib/download';
import { importVocabulary } from '@/lib/vocabulary/client';
import {
  MAX_IMPORT_BYTES,
  exportFileName,
  parseImport,
  toAnkiTsv,
  toCsv,
  toJsonBackup,
} from '@/lib/vocabulary/transfer';

type Message = { kind: 'ok' | 'error'; text: string } | null;

/** US-08: export the words shown (CSV, Anki, JSON backup) and import a JSON backup. */
export function VocabTransfer({
  entries,
  filtered,
  t,
}: {
  /** Words exported: the rows matching the current search and filter. */
  entries: readonly VocabEntry[];
  filtered: boolean;
  t: Translations;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);

  function exportAs(kind: 'csv' | 'anki' | 'json') {
    const now = Date.now();
    if (kind === 'csv') downloadText(exportFileName('vocab_export', now, 'csv'), toCsv(entries), 'text/csv;charset=utf-8');
    if (kind === 'anki')
      downloadText(exportFileName('vocab_anki', now, 'tsv'), toAnkiTsv(entries), 'text/tab-separated-values;charset=utf-8');
    if (kind === 'json')
      downloadText(exportFileName('vocab_backup', now, 'json'), toJsonBackup(entries, now), 'application/json');
  }

  async function importFile(file: File) {
    setMessage(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setMessage({ kind: 'error', text: t.vocabImportTooLarge(MAX_IMPORT_BYTES / 1024 / 1024) });
      return;
    }
    let value: unknown;
    try {
      value = JSON.parse(await file.text());
      // Checked here for a clear message; the background validates again before merging.
      if (parseImport(value).entries.length === 0) throw new Error('empty');
    } catch {
      setMessage({ kind: 'error', text: t.vocabImportInvalid });
      return;
    }
    setBusy(true);
    try {
      const s = await importVocabulary(value);
      setMessage({ kind: 'ok', text: t.vocabImportDone(s.added, s.merged, s.skipped) });
    } catch {
      setMessage({ kind: 'error', text: t.vocabSaveFailed });
    } finally {
      setBusy(false);
    }
  }

  const button =
    'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-border bg-parchment-100 text-xs font-medium text-ink-800 hover:bg-parchment-200 disabled:opacity-40 disabled:hover:bg-parchment-100';

  return (
    <div className="rounded-xl border border-stone-border bg-parchment-100/60 px-4 py-3 space-y-2" data-testid="vocab-transfer">
      <div className="flex flex-wrap items-center gap-2">
        {entries.length > 0 && (
          <>
            <span className="text-xs text-ink-600 mr-1">{t.vocabExportLabel(entries.length, filtered)}</span>
            <button type="button" className={button} title={t.vocabExportCsvHint} onClick={() => exportAs('csv')}>
              <Download className="w-3.5 h-3.5" />
              {t.vocabExportCsv}
            </button>
            <button type="button" className={button} title={t.vocabExportAnkiHint} onClick={() => exportAs('anki')}>
              <Download className="w-3.5 h-3.5" />
              {t.vocabExportAnki}
            </button>
            <button type="button" className={button} title={t.vocabExportJsonHint} onClick={() => exportAs('json')}>
              <Download className="w-3.5 h-3.5" />
              {t.vocabExportJson}
            </button>
          </>
        )}
        <span className="flex-1" />
        <button
          type="button"
          className={button}
          title={t.vocabImportHint}
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          <Upload className="w-3.5 h-3.5" />
          {t.vocabImport}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          data-testid="vocab-import-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ''; // the same file can be picked again
            if (file) void importFile(file);
          }}
        />
      </div>
      {message && (
        <p role="status" className={`text-xs ${message.kind === 'ok' ? 'text-emerald-700' : 'text-french-bordeaux'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
