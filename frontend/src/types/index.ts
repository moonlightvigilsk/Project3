export interface WordLookupResponse {
  word: string
  lemma: string
  pos: string
  definition?: string
  definition_vi?: string
  context_sentence?: string
  status: 'new' | 'learning' | 'known'
  occurrences: number
  document_id?: number
  source?: string
}

export interface VocabularyItem {
  id: number
  lemma: string
  surface_form?: string
  pos?: string
  definition?: string
  definition_vi?: string
  status: 'new' | 'learning' | 'known'
  occurrences: number
  context_sentence?: string
  document_id?: number
  document_title?: string
  created_at?: string
  updated_at?: string
}

export interface Document {
  id: number
  title: string
  filename: string
  file_type: 'pdf' | 'epub' | 'text'
  total_words: number
  total_sentences: number
  created_at?: string
}

export interface DocumentSection {
  id: number
  document_id: number
  section_index: number
  title?: string
  total_words: number
  total_sentences: number
}

export interface DocumentSentence {
  id: number
  document_id?: number
  section_id?: number
  section_index?: number
  order_index?: number
  chapter_index: number
  chapter_title?: string
  sentence_index: number
  text: string
  matched_rules?: string
}

export interface PatternMatchResult {
  rule_id: string
  rule_name: string
  matched_text: string
  start_char: number
  end_char: number
  matched_token_indices: number[]
  confidence: number
  notes?: string
}

export interface TokenAnalysis {
  index: number
  text: string
  lemma: string
  pos: string
  dep: string
  morph: Record<string, string>
  head_text: string
  is_stop: boolean
}

export interface SentenceAnalysis {
  text: string
  tokens: TokenAnalysis[]
  matches: PatternMatchResult[]
  matched_rule_ids: string[]
}

export interface GrammarRuleMetadata {
  id: string
  name: string
  category: string
  level: string
  formula: string
  description: string
  description_vi?: string
  description_en?: string
  key_points: string[]
  conjugation_table: Record<string, any>
  examples: string[]
  examples_correct?: Array<{ text: string; note?: string }>
  examples_incorrect?: Array<{ text: string; reason_vi?: string; reason_en?: string }>
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

export interface PracticeErrorDetail {
  span: string
  type: string
  explanation_vi: string
  suggestion: string
}

export interface RuleCheckResult {
  target_rule_id: string
  target_rule_name: string
  pattern_matched: boolean
  auxiliary_correct: boolean
  main_verb_infinitive: boolean
  subject_token?: string
  auxiliary_token?: string
  infinitive_token?: string
  matched_span?: string
  rule_notes?: string
}

export interface PracticeSubmitResponse {
  is_correct: boolean
  uses_target_construct: boolean
  score: number
  status: 'correct' | 'minor_issues' | 'incorrect'
  errors: PracticeErrorDetail[]
  corrected_sentence?: string
  short_comment: string
  diff_tokens: DiffToken[]
  rule_check: RuleCheckResult
  llm_unavailable: boolean
  created_at?: string
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
