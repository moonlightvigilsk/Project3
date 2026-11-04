import type { DetectedStructure, GrammarSpan } from './types';

/** Piece of the sentence and the structures (rule ids) whose words it contains. */
export interface Segment {
  text: string;
  ruleIds: string[];
}

/**
 * Cuts `sentence` at every span boundary, so each piece belongs to a fixed set of
 * structures (spans of different rules may overlap: "Je ne vais pas le faire").
 */
export function sentenceSegments(sentence: string, structures: DetectedStructure[]): Segment[] {
  const cuts = new Set<number>([0, sentence.length]);
  for (const s of structures) {
    for (const span of s.spans) {
      cuts.add(clampOffset(span.start, sentence));
      cuts.add(clampOffset(span.end, sentence));
    }
  }
  const points = [...cuts].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    if (to <= from) continue;
    const ruleIds = structures
      .filter((s) => s.spans.some((span) => span.start <= from && span.end >= to))
      .map((s) => s.ruleId);
    const last = out[out.length - 1];
    if (last && sameIds(last.ruleIds, ruleIds)) last.text += sentence.slice(from, to);
    else out.push({ text: sentence.slice(from, to), ruleIds });
  }
  return out;
}

function clampOffset(n: number, sentence: string): number {
  return Math.max(0, Math.min(n, sentence.length));
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** All spans of the given structures (all structures when `ruleId` is null). */
export function spansOf(structures: DetectedStructure[], ruleId: string | null): GrammarSpan[] {
  return structures.filter((s) => ruleId === null || s.ruleId === ruleId).flatMap((s) => s.spans);
}
