import type { GrammarChecker, GrammarCheckerOptions } from './types';
import type { GrammarCheckResult, GrammarSuggestion } from '@/types';
import { resolveSuggestions } from '@/lib/suggestions/resolve';

interface RuleDefinition {
  pattern: string | RegExp;
  replacement: string;
  explanation: string;
  type: 'grammar' | 'spelling' | 'punctuation' | 'style';
  deliberateOffset?: number;
}

const MOCK_RULES: RuleDefinition[] = [
  {
    pattern: 'mangé',
    replacement: 'manger',
    explanation:
      "Sau semi-auxiliaire 'aller', động từ theo sau phải ở nguyên mẫu 'manger'. (Après 'aller', le verbe doit être à l'infinitif).",
    type: 'grammar',
    deliberateOffset: 2, // Intentional offset to verify coordinate resolution in Bước 2
  },
  {
    pattern: 'mon amis',
    replacement: 'mes amis',
    explanation:
      "Hòa hợp số lượng: 'amis' ở số nhiều, dùng tính từ sở hữu số nhiều 'mes'. (Accord en nombre : 'amis' est au pluriel, utilisez 'mes').",
    type: 'grammar',
  },
  {
    pattern: 'je suis aller',
    replacement: 'je suis allé',
    explanation:
      "Hòa hợp quá khứ phân từ với trợ động từ 'être' ('allé'). (Accord du participe passé avec l'auxiliaire 'être').",
    type: 'grammar',
  },
  {
    pattern: 'beaucoup des',
    replacement: 'beaucoup de',
    explanation:
      "Sau từ chỉ lượng 'beaucoup', chỉ dùng giới từ 'de'. (Après l'adverbe de quantité 'beaucoup', utilisez 'de' seul).",
    type: 'grammar',
  },
  {
    pattern: "c'est pas",
    replacement: "ce n'est pas",
    explanation:
      "Trong tiếng Pháp chuẩn, không lược bỏ từ phủ định 'ne'. (En français soigné, ne pas omettre la négation 'ne').",
    type: 'style',
  },
  {
    pattern: 'tu as fais',
    replacement: 'tu as fait',
    explanation:
      "Quá khứ phân từ của động từ 'faire' kết thúc bằng 't' ('fait'). (Le participe passé de 'faire' se termine par un 't').",
    type: 'spelling',
  },
  // Regex rules
  {
    pattern: /\bl ami\b/gi,
    replacement: "l'ami",
    explanation:
      "Bắt buộc lược âm (élision) trước nguyên âm: viết 'l'ami'. (Élision obligatoire devant une voyelle).",
    type: 'spelling',
  },
  {
    pattern: /\bj ai\b/gi,
    replacement: "j'ai",
    explanation:
      "Bắt buộc lược âm cho đại từ 'je' trước nguyên âm: 'j'ai'. (Élision obligatoire pour le pronom 'je').",
    type: 'spelling',
  },
  {
    pattern: /\bc est\b/gi,
    replacement: "c'est",
    explanation:
      "Lược âm cho đại từ 'ce' trước 'est': 'c'est'. (Élision du pronom 'ce' devant 'est').",
    type: 'spelling',
  },
  {
    pattern: /\bd accord\b/gi,
    replacement: "d'accord",
    explanation:
      "Viết cụm từ có dấu nháy: 'd'accord'. (Écrivez la locution avec une apostrophe).",
    type: 'spelling',
  },
  {
    pattern: / ,/g,
    replacement: ',',
    explanation:
      "Quy tắc dấu câu: Không để khoảng trắng trước dấu phẩy. (Pas d'espace avant la virgule).",
    type: 'punctuation',
  },
  {
    pattern: / {2,}/g,
    replacement: ' ',
    explanation:
      'Khoảng trắng kép thừa. (Espaces consécutifs superflus).',
    type: 'punctuation',
  },
];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Case-insensitive regex of a rule (US-12). A text rule matches whole words only
 * ("mangé" is not found inside "mangées"), accented letters counting as letters.
 */
export function ruleRegex(pattern: string | RegExp): RegExp {
  if (typeof pattern !== 'string') {
    const flags = new Set(pattern.flags.split(''));
    flags.add('g');
    flags.add('i');
    return new RegExp(pattern.source, [...flags].join(''));
  }
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegex(pattern)}(?![\\p{L}\\p{N}_])`, 'giu');
}

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
      // Every rule matches whatever the case ("Tu as fais", "TU AS FAIS"); the replacement
      // takes the case of the matched text in resolveSuggestions (US-12).
      const regex = ruleRegex(rule.pattern);
      const offset = rule.deliberateOffset ?? 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        const original = match[0];
        if (match.index === regex.lastIndex) regex.lastIndex++;
        if (!original) continue;
        rawSuggestions.push({
          id: `mock-${Date.now()}-${counter++}`,
          original,
          replacement: rule.replacement,
          explanation: rule.explanation,
          type: rule.type,
          startIndex: Math.max(0, match.index + offset),
          endIndex: Math.min(text.length, match.index + original.length + offset),
        });
      }
    }

    const resolvedSuggestions = resolveSuggestions(text, rawSuggestions);

    return {
      suggestions: resolvedSuggestions,
      text,
      language: opts.language === 'auto' ? 'fr' : opts.language,
      timestamp: Date.now(),
    };
  }
}
