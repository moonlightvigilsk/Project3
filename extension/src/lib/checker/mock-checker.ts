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

    const resolvedSuggestions = resolveSuggestions(text, rawSuggestions);

    return {
      suggestions: resolvedSuggestions,
      text,
      language: opts.language === 'auto' ? 'fr' : opts.language,
      timestamp: Date.now(),
    };
  }
}
