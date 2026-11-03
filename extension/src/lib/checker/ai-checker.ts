import type { GrammarChecker, GrammarCheckerOptions } from './types';
import type { GrammarCheckResult } from '@/types';
import { checkGrammar } from '@/lib/ai/grammar-check';

export class AIChecker implements GrammarChecker {
  async check(text: string, opts: GrammarCheckerOptions): Promise<GrammarCheckResult> {
    if (!opts.provider || !opts.model || !opts.apiKey) {
      throw new Error('AI Provider, Model, and API Key are required for AIChecker.');
    }

    return checkGrammar(text, {
      provider: opts.provider,
      model: opts.model,
      apiKey: opts.apiKey,
      language: opts.language,
    });
  }
}
