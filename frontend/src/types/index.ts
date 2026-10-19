export interface Document {
  id: number
  title: string
  filename: string
  file_type: 'pdf' | 'epub' | 'text'
  total_words: number
  total_sentences: number
  created_at?: string
}

export interface DocumentSentence {
  id: number
  chapter_index: number
  chapter_title?: string
  sentence_index: number
  text: string
  matched_rules?: string
}

export interface GrammarRuleMetadata {
  id: string
  name: string
  category: string
  level: string
  formula: string
  description: string
  key_points: string[]
  conjugation_table: Record<string, any>
  examples: string[]
  keywords?: string[]
}

export interface MinedExample {
  sentence_id: number
  sentence_index: number
  chapter_index: number
  chapter_title?: string
  text: string
  matched_span?: string
  span_start?: number
  span_end?: number
  notes?: string
}

export interface DiffToken {
  type: 'same' | 'replaced' | 'added' | 'removed'
  text?: string
  original?: string
  replacement?: string
}

export interface SpacyToken {
  index: number
  text: string
  lemma: string
  pos: string
  dep: string
  morph: Record<string, string>
}

export interface GrammarEvaluationResult {
  is_correct: boolean
  target_pattern_matched: boolean
  score: number
  status: 'correct' | 'minor_issues' | 'incorrect'
  corrected_sentence?: string
  error_explanation?: string
  positive_feedback?: string
  suggested_alternatives: string[]
  diff_tokens: DiffToken[]
  spacy_tokens: SpacyToken[]
  rule_id?: string
  rule_name?: string
  user_sentence?: string
}

export interface GrammarExplanationResult {
  rule_id: string
  rule_name: string
  summary: string
  formula: string
  key_rules: string[]
  common_mistakes: string[]
  conjugation_or_forms: Record<string, any>
  examples: string[]
}

export interface PracticeHistoryItem {
  id: number
  rule_id: string
  document_id?: number
  user_sentence: string
  is_correct: boolean
  target_pattern_matched: boolean
  score: number
  corrected_sentence?: string
  feedback?: any
  created_at?: string
}

export interface RuleStat {
  attempts: number
  correct: number
  accuracy_rate: number
  average_score: number
}

export interface PracticeStats {
  total_attempts: number
  correct_attempts: number
  accuracy_rate: number
  average_score: number
  rules_breakdown: Record<string, RuleStat>
}
