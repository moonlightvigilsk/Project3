/**
 * Grammar structures found in a sentence (US-17). The analysis runs on the backend
 * (`POST /api/grammar/analyze`, spaCy matchers); see `backend.ts`.
 */

/** Part of the sentence that belongs to a structure, as offsets in `GrammarAnalysis.sentence`. */
export interface GrammarSpan {
  start: number;
  end: number;
  text: string;
}

export interface DetectedStructure {
  /** Rule id of the backend catalog (`futur_proche`, `passe_compose`...). */
  ruleId: string;
  name: string;
  /** CEFR level as written in the catalog ("A2", "A1-A2"), null when unknown. */
  level: string | null;
  /** Words of the sentence matched by the rule, in text order. */
  spans: GrammarSpan[];
}

export interface GrammarAnalysis {
  /** Sentence as sent to the backend (whitespace collapsed, trimmed). */
  sentence: string;
  /** In order of first appearance in the sentence. */
  structures: DetectedStructure[];
}

/** Reply of the background to `ANALYZE_GRAMMAR`. */
export type AnalyzeGrammarReply =
  | { status: 'ok'; analysis: GrammarAnalysis }
  /** Nothing answers at the backend URL (not started, wrong port, blocked). */
  | { status: 'unreachable'; backendUrl: string }
  /** The backend answered with an error, or with something that is not an analysis. */
  | { status: 'error'; backendUrl: string; httpStatus: number | null; message: string };

/** Content script / pages -> background: analyze `{ sentence }`. Reply: `AnalyzeGrammarReply`. */
export const ANALYZE_GRAMMAR = 'ANALYZE_GRAMMAR';

/** Options page -> background: `{ backendUrl }`, is a grammar backend there? Reply: `BackendCheckReply`. */
export const CHECK_BACKEND = 'CHECK_BACKEND';

export type BackendCheckReply =
  | { status: 'ok'; rules: number }
  | { status: 'unreachable' }
  | { status: 'error'; httpStatus: number | null; message: string };

/** Background -> content script: context menu "Analyze grammar" on `{ text }`. Reply `{ handled }`. */
export const CONTEXT_MENU_ANALYZE = 'CONTEXT_MENU_ANALYZE';

/** Content script -> background: open the options page (link in the "backend not running" card). */
export const OPEN_OPTIONS = 'OPEN_OPTIONS';

export const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8000';

/** Command to start the backend, shown when it cannot be reached. */
export const BACKEND_START_COMMAND = 'cd backend && uvicorn app.main:app --port 8000';
