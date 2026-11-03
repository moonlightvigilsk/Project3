import type { GrammarCheckResult, AIProvider } from '@/types';

export interface GrammarCheckerOptions {
  language: string;
  provider?: AIProvider;
  model?: string;
  apiKey?: string;
}

export interface GrammarChecker {
  check(text: string, opts: GrammarCheckerOptions): Promise<GrammarCheckResult>;
}
