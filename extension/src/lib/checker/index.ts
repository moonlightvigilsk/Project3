import { ENABLE_AI } from '@/lib/config';
import type { GrammarChecker } from './types';
import { MockChecker } from './mock-checker';
import { AIChecker } from './ai-checker';

export * from './types';
export * from './mock-checker';
export * from './ai-checker';

export function getGrammarChecker(): GrammarChecker {
  if (ENABLE_AI) {
    return new AIChecker();
  }
  return new MockChecker();
}
