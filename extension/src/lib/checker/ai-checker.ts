import type { GrammarChecker, GrammarCheckerOptions } from './types';
import type { GrammarCheckResult } from '@/types';
import { checkGrammar } from '@/lib/ai/grammar-check';
import { resolveSuggestions } from '@/lib/suggestions/resolve';

export class AIChecker implements GrammarChecker {
  async check(text: string, opts: GrammarCheckerOptions): Promise<GrammarCheckResult> {
    if (!opts.provider || !opts.model || !opts.apiKey) {
      throw new Error('AI Provider, Model, and API Key are required for AIChecker.');
    }

    const result = await checkGrammar(text, {
      provider: opts.provider,
      model: opts.model,
      apiKey: opts.apiKey,
      language: opts.language,
    });

    // Resolve positions to ensure no suggestion is dropped just because of minor index mismatch
    result.suggestions = resolveSuggestions(text, result.suggestions);
    return result;
  }
}
