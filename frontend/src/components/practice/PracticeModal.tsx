import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  X,
  Send,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  BookOpen,
  ChevronRight,
  Info,
} from 'lucide-react'
import { DiacriticBar } from './DiacriticBar'
import { DiffViewer } from './DiffViewer'
import { api } from '../../services/api'
import type { PracticeSubmitResponse, GrammarRuleMetadata } from '../../types'

interface PracticeModalProps {
  isOpen: boolean
  onClose: () => void
  ruleId: string
  ruleName: string
  ruleFormula?: string
  modelSentence?: string
  documentId?: number
  documentSentenceId?: number
}

export const PracticeModal: React.FC<PracticeModalProps> = ({
  isOpen,
  onClose,
  ruleId,
  ruleName,
  ruleFormula,
  modelSentence,
  documentId,
  documentSentenceId,
}) => {
  const [userSentence, setUserSentence] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PracticeSubmitResponse | null>(null)

  // Example sentences bank
  const [examples, setExamples] = useState<string[]>([])
  const [activeExampleIndex, setActiveExampleIndex] = useState(0)
  const [ruleMetadata, setRuleMetadata] = useState<GrammarRuleMetadata | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load Rule Metadata and Examples (from learner document or YAML library fallback)
  useEffect(() => {
    if (!isOpen || !ruleId) return

    let isMounted = true

    // Initialize examples with modelSentence if available immediately
    if (modelSentence) {
      setExamples([modelSentence])
      setActiveExampleIndex(0)
    }

    const fetchRuleAndExamples = async () => {
      try {
        const meta = await api.getGrammarRule(ruleId)
        if (!isMounted) return
        setRuleMetadata(meta)

        const gatheredExamples: string[] = []

        // 1. Try mining occurrences from learner's current document
        if (documentId) {
          try {
            const occ = await api.getDocumentOccurrences(documentId, ruleId)
            if (occ && occ.occurrences && occ.occurrences.length > 0) {
              occ.occurrences.slice(0, 3).forEach((o) => {
                if (o.text && !gatheredExamples.includes(o.text)) {
                  gatheredExamples.push(o.text)
                }
              })
            }
          } catch {
            // Document occurrences failed or empty
          }
        }

        // 2. If modelSentence was passed and not in list
        if (modelSentence && !gatheredExamples.includes(modelSentence)) {
          gatheredExamples.unshift(modelSentence)
        }

        // 3. Fallback to YAML examples if not enough examples (< 2)
        if (gatheredExamples.length < 2 && meta) {
          if (meta.examples_correct && meta.examples_correct.length > 0) {
            meta.examples_correct.forEach((ex) => {
              if (ex.text && !gatheredExamples.includes(ex.text)) {
                gatheredExamples.push(ex.text)
              }
            })
          } else if (meta.examples && meta.examples.length > 0) {
            meta.examples.forEach((ex) => {
              if (!gatheredExamples.includes(ex)) {
                gatheredExamples.push(ex)
              }
            })
          }
        }

        if (isMounted && gatheredExamples.length > 0) {
          setExamples(gatheredExamples.slice(0, 3))
          setActiveExampleIndex(0)
        }
      } catch (e) {
        console.warn('Could not load rule details:', e)
      }
    }

    fetchRuleAndExamples()

    return () => {
      isMounted = false
    }
  }, [isOpen, ruleId, documentId, modelSentence])

  // Reset or focus when opened
  useEffect(() => {
    if (isOpen) {
      setUserSentence('')
      setResult(null)
      setError(null)
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 50)
    }
  }, [isOpen, ruleId])

  // Handle Tab for switching examples and Escape to close
  const handleNextExample = useCallback(() => {
    if (examples.length > 1) {
      setActiveExampleIndex((prev) => (prev + 1) % examples.length)
    }
  }, [examples.length])

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Tab') {
        // Prevent tabbing out if textarea is focused and there are multiple examples
        if (examples.length > 1 && document.activeElement === textareaRef.current) {
          e.preventDefault()
          handleNextExample()
        }
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [isOpen, onClose, examples.length, handleNextExample])

  if (!isOpen) return null

  const handleInsertDiacritic = (char: string) => {
    const textarea = textareaRef.current
    if (!textarea) {
      setUserSentence((prev) => prev + char)
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const nextValue = userSentence.substring(0, start) + char + userSentence.substring(end)
    setUserSentence(nextValue)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + char.length, start + char.length)
    }, 0)
  }

  const handleSubmit = async () => {
    const trimmed = userSentence.trim()
    if (!trimmed) {
      setError('Vui lòng nhập câu của bạn trước khi nộp bài.')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      let evaluation: PracticeSubmitResponse
      try {
        evaluation = await api.submitPracticeSentence({
          user_sentence: trimmed,
          target_rule_id: ruleId,
          target_rule_name: ruleName,
          document_id: documentId,
          document_sentence_id: documentSentenceId,
        })
      } catch {
        // Fallback to legacy evaluateSentence if submit endpoint unavailable or in mocked test
        const legacy = await api.evaluateSentence({
          user_sentence: trimmed,
          target_rule_id: ruleId,
          target_rule_name: ruleName,
          target_rule_formula: ruleFormula,
          learner_native_lang: 'vi',
          document_id: documentId,
          document_sentence_id: documentSentenceId,
        })
        evaluation = {
          is_correct: legacy.is_correct,
          uses_target_construct: legacy.target_pattern_matched,
          score: legacy.score,
          status: legacy.status,
          errors: [],
          corrected_sentence: legacy.corrected_sentence,
          short_comment: legacy.positive_feedback || legacy.error_explanation || 'Đã hoàn thành đánh giá.',
          diff_tokens: legacy.diff_tokens,
          rule_check: {
            target_rule_id: ruleId,
            target_rule_name: ruleName,
            pattern_matched: legacy.target_pattern_matched,
            auxiliary_correct: legacy.target_pattern_matched,
            main_verb_infinitive: legacy.target_pattern_matched,
          },
          llm_unavailable: false,
        }
      }
      setResult(evaluation)
    } catch (err: any) {
      setError(err.message || 'Không thể chấm câu lúc này. Vui lòng thử lại.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Both Enter or Ctrl+Enter / Cmd+Enter submits sentence
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleRetrySame = () => {
    setResult(null)
    setError(null)
    setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.select()
    }, 50)
  }

  const handleResetForAnother = () => {
    setUserSentence('')
    setResult(null)
    setError(null)
    handleNextExample()
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const currentExplanation =
    ruleMetadata?.description_vi || ruleMetadata?.description || 'Luyện tập ứng dụng cấu trúc ngữ pháp đích.'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-[#1E1D1B] rounded-lg border border-stone-border dark:border-[#3A3735] shadow-xl max-w-2xl w-full my-8 flex flex-col max-h-[92vh] transition-colors">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-border dark:border-[#3A3735] flex items-center justify-between bg-parchment-50 dark:bg-[#242220]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-french-navy dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded font-semibold">
                Luyện viết chủ động
              </span>
              <span className="text-xs text-ink-500 dark:text-[#A8A29E] font-mono">#{ruleId}</span>
            </div>
            <h2 className="font-serif font-bold text-lg text-ink-900 dark:text-[#E8E3DA] mt-1">{ruleName}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-ink-500 dark:text-[#A8A29E] hover:text-ink-900 dark:hover:text-[#E8E3DA] hover:bg-stone-subtle dark:hover:bg-[#2C2A27] rounded transition-colors cursor-pointer"
            title="Đóng (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Short Pedagogical Explanation Banner */}
          <div className="p-3 bg-stone-50 dark:bg-[#242220] border border-stone-200 dark:border-[#3A3735] rounded text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-french-navy dark:text-blue-300">
              <Info className="w-3.5 h-3.5" />
              <span>Giải thích ngắn:</span>
            </div>
            <p className="text-ink-800 dark:text-[#D6D0C7] leading-relaxed font-sans">{currentExplanation}</p>
            {(ruleFormula || ruleMetadata?.formula) && (
              <p className="font-mono text-french-bordeaux dark:text-rose-400 font-medium pt-1 text-[11px]">
                {ruleFormula || ruleMetadata?.formula}
              </p>
            )}
          </div>

          {/* 2-3 Contextual Examples with Tab toggle */}
          {examples.length > 0 && (
            <div className="p-3 bg-parchment-100/80 border-l-3 border-french-navy rounded-r text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink-700 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-french-ochre" />
                  <span>
                    Ví dụ minh họa ({activeExampleIndex + 1}/{examples.length})
                  </span>
                </span>
                {examples.length > 1 && (
                  <button
                    type="button"
                    onClick={handleNextExample}
                    className="text-[10px] text-french-navy hover:underline flex items-center gap-0.5 font-mono"
                    title="Nhấn Tab để đổi ví dụ"
                  >
                    <span>Đổi ví dụ (Tab)</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
              <p className="font-serif italic text-ink-900 text-sm">
                « {examples[activeExampleIndex]} »
              </p>
            </div>
          )}

          {/* Prompt Instruction */}
          <p className="text-xs text-ink-700 font-medium">Viết một câu dùng cấu trúc này:</p>

          {/* Diacritic Helper Bar */}
          <DiacriticBar onInsert={handleInsertDiacritic} />

          {/* Input Textarea */}
          <div className="space-y-1.5">
            <textarea
              ref={textareaRef}
              value={userSentence}
              onChange={(e) => setUserSentence(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={3}
              placeholder="Gõ câu của bạn ở đây... (nhấn Enter để nộp, Tab để đổi ví dụ)"
              className="w-full px-3.5 py-2.5 font-serif text-base border border-stone-border dark:border-[#3A3735] bg-white dark:bg-[#242220] text-ink-900 dark:text-[#E8E3DA] placeholder-ink-400 dark:placeholder-stone-500 rounded focus:outline-none focus:ring-1 focus:ring-french-navy focus:border-french-navy transition-colors disabled:opacity-50"
            />
            <div className="flex items-center justify-between text-[11px] text-ink-400 dark:text-[#78716C] font-mono">
              <span>Phím tắt: Enter nộp • Tab đổi ví dụ</span>
              <span>{userSentence.length} ký tự</span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Button before submission */}
          {!result && (
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-stone-border rounded text-xs text-ink-700 hover:bg-stone-subtle transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || !userSentence.trim()}
                className="px-5 py-2 bg-french-navy text-white rounded text-xs font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang chấm bài...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Chấm bài (Enter)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Result Feedback Section */}
          {result && (
            <div className="pt-3 border-t border-stone-border space-y-4 animate-in fade-in duration-200">
              {/* Status Header */}
              <div
                className={`p-3.5 rounded border flex items-center justify-between ${
                  result.status === 'correct'
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900'
                    : result.status === 'minor_issues'
                    ? 'bg-amber-50/80 border-amber-300 text-amber-900'
                    : 'bg-red-50/80 border-red-300 text-red-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {result.status === 'correct' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-serif font-bold text-sm">
                      {result.status === 'correct'
                        ? 'Chính xác hoàn toàn!'
                        : result.status === 'minor_issues'
                        ? 'Đúng cấu trúc nhưng cần sửa nhỏ'
                        : 'Chưa đạt cấu trúc ngữ pháp'}
                    </h4>
                    <p className="text-xs opacity-80 mt-0.5">
                      {result.short_comment}
                      {result.llm_unavailable && ' (Đánh giá dự phòng bằng luật)'}
                    </p>
                  </div>
                </div>
                <span className="text-xl font-bold font-mono">{result.score}/100</span>
              </div>

              {/* Visual Diff: Nhẹ nhàng gạch phần sai, nhấn phần sửa */}
              {result.diff_tokens && result.diff_tokens.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-mono text-ink-500 block">
                    Đối chiếu câu chuẩn (Visual Diff):
                  </span>
                  <DiffViewer tokens={result.diff_tokens} />
                </div>
              )}

              {/* Detected Errors Details */}
              {result.errors && result.errors.length > 0 && (
                <div className="p-3 bg-red-50/60 border border-red-200 rounded space-y-2">
                  <span className="text-xs font-mono font-semibold text-red-800 block">
                    Chi tiết điểm cần sửa:
                  </span>
                  <ul className="space-y-1.5 text-xs text-ink-800">
                    {result.errors.map((err, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="font-mono text-red-700 font-semibold shrink-0">
                          «{err.span}»:
                        </span>
                        <span>
                          {err.explanation_vi} (Gợi ý:{' '}
                          <span className="font-semibold text-emerald-800">{err.suggestion}</span>)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons: Thử lại & Câu khác */}
              <div className="pt-2 flex justify-between items-center flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-xs text-ink-500 hover:text-ink-900 hover:underline cursor-pointer"
                >
                  Đóng (Esc)
                </button>

                <div className="flex items-center gap-2">
                  {!result.is_correct && (
                    <button
                      type="button"
                      onClick={handleRetrySame}
                      className="px-3.5 py-1.5 border border-stone-border rounded text-xs text-ink-700 hover:bg-stone-subtle transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-french-ochre" />
                      <span>Thử lại câu này</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleResetForAnother}
                    className="px-4 py-2 bg-french-navy text-white rounded text-xs font-medium hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Luyện câu khác</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
