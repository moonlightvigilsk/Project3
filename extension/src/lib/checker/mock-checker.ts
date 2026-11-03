import type { GrammarChecker, GrammarCheckerOptions } from './types';
import type { GrammarCheckResult, GrammarSuggestion } from '@/types';
import { resolveSuggestions } from '@/lib/suggestions/resolve';

interface RuleDefinition {
  pattern: string | RegExp;
  replacement: string;
  explanation: string;
  type: 'grammar' | 'spelling' | 'punctuation' | 'style';
  /**
   * If provided, deliberately offsets the reported startIndex to test resolveSuggestions
   */
  deliberateOffset?: number;
}

const MOCK_RULES: RuleDefinition[] = [
  // Deliberate offset test rule: "mangé" in "nous allons mangé" is reported with +2 offset
  {
    pattern: 'mangé',
    replacement: 'manger',
    explanation: "Après le semi-auxiliaire 'aller', le verbe doit être à l'infinitif ('manger').",
    type: 'grammar',
    deliberateOffset: 2, // Intentional offset to verify coordinate resolution in Bước 2
  },
  {
    pattern: 'mon amis',
    replacement: 'mes amis',
    explanation: "Accord en nombre : 'amis' est au pluriel, utilisez le déterminant possessif 'mes'.",
    type: 'grammar',
  },
  {
    pattern: 'je suis aller',
    replacement: 'je suis allé',
    explanation: "Le participe passé s'accorde avec le sujet avec l'auxiliaire 'être' ('allé').",
    type: 'grammar',
  },
  {
    pattern: 'beaucoup des',
    replacement: 'beaucoup de',
    explanation: "Après un adverbe de quantité ('beaucoup'), utilisez la préposition 'de' seule.",
    type: 'grammar',
  },
  {
    pattern: "c'est pas",
    replacement: "ce n'est pas",
    explanation: "En français soigné, ne pas omettre la négation 'ne'.",
    type: 'style',
  },
  {
    pattern: 'tu as fais',
    replacement: 'tu as fait',
    explanation: "Le participe passé du verbe 'faire' prend un 't' final ('fait').",
    type: 'spelling',
  },
  // Regex rules
  {
    pattern: /\bl ami\b/gi,
    replacement: "l'ami",
    explanation: "Élision obligatoire devant une voyelle : écrivez 'l'ami'.",
    type: 'spelling',
  },
  {
    pattern: /\bj ai\b/gi,
    replacement: "j'ai",
    explanation: "Élision obligatoire pour le pronom 'je' devant une voyelle : 'j'ai'.",
    type: 'spelling',
  },
  {
    pattern: /\bc est\b/gi,
    replacement: "c'est",
    explanation: "Élision du pronom démonstratif 'ce' devant 'est' : 'c'est'.",
    type: 'spelling',
  },
  {
    pattern: /\bd accord\b/gi,
    replacement: "d'accord",
    explanation: "Écrivez la locution avec une apostrophe : 'd'accord'.",
    type: 'spelling',
  },
  {
    pattern: / ,/g,
    replacement: ',',
    explanation: "Pas d'espace avant la virgule en typographie française.",
    type: 'punctuation',
  },
  {
    pattern: / {2,}/g,
    replacement: ' ',
    explanation: "Espaces consécutifs superflus.",
    type: 'punctuation',
  },
];

export class MockChecker implements GrammarChecker {
  async check(text: string, opts: GrammarCheckerOptions): Promise<GrammarCheckResult> {
    if (!text || !text.trim()) {
      return {
        suggestions: [],
        text,
        language: opts.language === 'auto' ? 'fr' : opts.language,
        timestamp: Date.now(),
      };
    }

    const rawSuggestions: GrammarSuggestion[] = [];
    let counter = 0;

    for (const rule of MOCK_RULES) {
      if (typeof rule.pattern === 'string') {
        const needle = rule.pattern;
        let searchIndex = 0;

        while (searchIndex < text.length) {
          const foundPos = text.indexOf(needle, searchIndex);
          if (foundPos === -1) break;

          const exactStart = foundPos;
          const exactEnd = foundPos + needle.length;
          const offset = rule.deliberateOffset ?? 0;

          // Apply deliberate offset if specified
          const reportedStart = Math.max(0, exactStart + offset);
          const reportedEnd = Math.min(text.length, exactEnd + offset);

          rawSuggestions.push({
            id: `mock-${Date.now()}-${counter++}`,
            original: needle,
            replacement: rule.replacement,
            explanation: rule.explanation,
            type: rule.type,
            startIndex: reportedStart,
            endIndex: reportedEnd,
          });

          searchIndex = foundPos + needle.length;
        }
      } else {
        // RegExp pattern
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
          const original = match[0];
          const startIndex = match.index;
          const endIndex = startIndex + original.length;

          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
          }

          rawSuggestions.push({
            id: `mock-${Date.now()}-${counter++}`,
            original,
            replacement: rule.replacement,
            explanation: rule.explanation,
            type: rule.type,
            startIndex,
            endIndex,
          });
        }
      }
    }

    // Pass all suggestions through resolveSuggestions to guarantee valid, sorted, non-overlapping coordinates
    const resolvedSuggestions = resolveSuggestions(text, rawSuggestions);

    return {
      suggestions: resolvedSuggestions,
      text,
      language: opts.language === 'auto' ? 'fr' : opts.language,
      timestamp: Date.now(),
    };
  }
}
