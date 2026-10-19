import React, { useState, useRef, useEffect } from 'react'
import { X, Send, Sparkles, AlertCircle, CheckCircle2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { DiacriticBar } from './DiacriticBar'
import { DiffViewer } from './DiffViewer'
import { api } from '../../services/api'
import type { GrammarEvaluationResult } from '../../types'

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
  const [result, setResult] = useState<GrammarEvaluationResult | null>(null)
  const [showSpacyTokens, setShowSpacyTokens] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Reset or focus when opened
  useEffect(() => {
    if (isOpen) {
      setUserSentence('')
      setResult(null)
      setError(null)
      setShowSpacyTokens(false)
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 50)
    }
  }, [isOpen, ruleId])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

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

    // Restore cursor position after inserted character
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + char.length, start + char.length)
    }, 0)
  }

  const handleEvaluate = async () => {
    const trimmed = userSentence.trim()
    if (!trimmed) {
      setError('Vui lòng gõ một câu trước khi nộp.')
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      const evaluation = await api.evaluateSentence({
        user_sentence: trimmed,
        target_rule_id: ruleId,
        target_rule_name: ruleName,
        target_rule_formula: ruleFormula,
        learner_native_lang: 'vi',
        document_id: documentId,
        document_sentence_id: documentSentenceId,
      })
      setResult(evaluation)
    } catch (err: any) {
      setError(err.message || 'Không thể đánh giá câu. Vui lòng thử lại.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleEvaluate()
    }
  }

  const handleResetForAnother = () => {
    setUserSentence('')
    setResult(null)
    setError(null)
    setShowSpacyTokens(false)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-lg border border-stone-border shadow-xl max-w-2xl w-full my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-border flex items-center justify-between bg-parchment-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-french-bordeaux bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                Luyện viết chủ động
              </span>
              <span className="text-xs text-ink-500 font-mono">#{ruleId}</span>
            </div>
            <h2 className="font-serif font-bold text-lg text-ink-900 mt-1">{ruleName}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-ink-500 hover:text-ink-900 hover:bg-stone-subtle rounded transition-colors"
            title="Đóng (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Rule Formula Banner */}
          {ruleFormula && (
            <div className="p-3 bg-stone-subtle border border-stone-border rounded text-xs space-y-1">
              <span className="font-mono text-ink-500 block">Công thức ngữ pháp:</span>
              <p className="font-mono text-ink-900 font-medium text-sm">{ruleFormula}</p>
            </div>
          )}

          {/* Model Sentence from document if provided */}
          {modelSentence && (
            <div className="p-3.5 bg-parchment-100 border-l-2 border-french-bordeaux rounded-r text-xs space-y-1">
              <span className="text-ink-500 font-sans block">
                Ví dụ trích từ tài liệu đang đọc của bạn:
              </span>
              <p className="font-serif italic text-ink-900 text-sm">« {modelSentence} »</p>
            </div>
          )}

          {/* Prompt instruction */}
          <p className="text-xs text-ink-700">
            Hãy viết một câu mới bằng tiếng Pháp ứng dụng cấu trúc trên:
          </p>

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
              placeholder="Gõ câu của bạn ở đây... (nhấn Ctrl+Enter để nộp)"
              className="w-full px-3.5 py-2.5 font-serif text-base border border-stone-border rounded focus:outline-none focus:ring-1 focus:ring-french-bordeaux focus:border-french-bordeaux transition-colors disabled:bg-stone-50"
            />
            <div className="flex items-center justify-between text-[11px] text-ink-400 font-mono">
              <span>Phím tắt: Ctrl + Enter / Cmd + Enter</span>
              <span>{userSentence.length} ký tự</span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Button */}
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
                onClick={handleEvaluate}
                disabled={isLoading || !userSentence.trim()}
                className="px-5 py-2 bg-french-bordeaux text-white rounded text-xs font-medium hover:bg-red-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang chấm câu...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Chấm bài (Ctrl+Enter)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Result Feedback Section */}
          {result && (
            <div className="pt-4 border-t border-stone-border space-y-4 animate-in fade-in duration-200">
              {/* Score & Status Header */}
              <div
                className={`p-3.5 rounded border flex items-center justify-between ${
                  result.status === 'correct'
                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                    : result.status === 'minor_issues'
                    ? 'bg-amber-50/70 border-amber-300 text-amber-900'
                    : 'bg-red-50/70 border-red-300 text-red-900'
                }`}
              >
                <div className="flex items-center gap-2">
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
                    <span className="text-xs opacity-80">
                      Điểm: {result.score}/10 • Nhận diện cấu trúc:{' '}
                      {result.target_pattern_matched ? '✓ Khớp' : '✗ Chưa khớp'}
                    </span>
                  </div>
                </div>
                <span className="text-xl font-bold font-mono">{result.score}/10</span>
              </div>

              {/* Visual Diff Viewer */}
              {result.diff_tokens && result.diff_tokens.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-mono text-ink-500 block">
                    Đối chiếu với câu chuẩn (Visual Diff):
                  </span>
                  <DiffViewer tokens={result.diff_tokens} />
                </div>
              )}

              {/* Bilingual Error Explanation */}
              {result.error_explanation && (
                <div className="p-3.5 bg-parchment-50 border border-stone-border rounded space-y-1">
                  <span className="text-xs font-mono text-french-bordeaux font-medium block">
                    Giải thích sư phạm:
                  </span>
                  <p className="text-xs text-ink-800 leading-relaxed">
                    {result.error_explanation}
                  </p>
                </div>
              )}

              {/* Positive Feedback */}
              {result.positive_feedback && (
                <div className="p-3 bg-emerald-50/40 border border-emerald-200 rounded text-xs text-emerald-950 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{result.positive_feedback}</span>
                </div>
              )}

              {/* Suggested Alternatives */}
              {result.suggested_alternatives && result.suggested_alternatives.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-mono text-ink-500 block">
                    Cách diễn đạt tương đương:
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-xs text-ink-700 font-serif bg-white p-3 border border-stone-border rounded">
                    {result.suggested_alternatives.map((alt, i) => (
                      <li key={i} className="italic">
                        « {alt} »
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* spaCy Tokens Breakdown Toggle */}
              {result.spacy_tokens && result.spacy_tokens.length > 0 && (
                <div className="border border-stone-border rounded overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowSpacyTokens(!showSpacyTokens)}
                    className="w-full px-3 py-2 bg-stone-subtle hover:bg-stone-200 flex items-center justify-between text-xs font-mono text-ink-700 transition-colors"
                  >
                    <span>Phân tích cú pháp spaCy ({result.spacy_tokens.length} từ)</span>
                    {showSpacyTokens ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showSpacyTokens && (
                    <div className="p-3 bg-white overflow-x-auto">
                      <table className="w-full text-[11px] font-mono border-collapse">
                        <thead>
                          <tr className="border-b border-stone-border text-left text-ink-500">
                            <th className="pb-1.5">Từ</th>
                            <th className="pb-1.5">Lemma</th>
                            <th className="pb-1.5">POS</th>
                            <th className="pb-1.5">Cú pháp (Dep)</th>
                            <th className="pb-1.5">Hình thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {result.spacy_tokens.map((tok, idx) => (
                            <tr key={idx} className="hover:bg-parchment-50">
                              <td className="py-1 font-serif text-ink-900 font-medium">{tok.text}</td>
                              <td className="py-1 text-ink-600">{tok.lemma}</td>
                              <td className="py-1 text-french-bordeaux font-semibold">{tok.pos}</td>
                              <td className="py-1 text-ink-500">{tok.dep}</td>
                              <td className="py-1 text-ink-400 text-[10px]">
                                {Object.entries(tok.morph || {})
                                  .map(([k, v]) => `${k}=${v}`)
                                  .join('|') || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Action Footer after evaluation */}
              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-xs text-ink-500 hover:text-ink-900 hover:underline cursor-pointer"
                >
                  Xong & Đóng
                </button>
                <button
                  type="button"
                  onClick={handleResetForAnother}
                  className="px-4 py-2 bg-french-navy text-white rounded text-xs font-medium hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Viết câu khác</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
