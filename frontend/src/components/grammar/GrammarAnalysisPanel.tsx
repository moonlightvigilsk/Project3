import React, { useEffect, useState } from 'react'
import {
  X,
  BookOpen,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import type { DocumentSentence, SentenceAnalysis } from '../../types'
import { api } from '../../services/api'

interface GrammarAnalysisPanelProps {
  sentence: DocumentSentence | null
  darkMode?: boolean
  onClose: () => void
  onViewRule: (ruleId: string) => void
}

// Gentle pastel role-based color map for POS tags
const POS_STYLES: Record<
  string,
  { label: string; light: string; dark: string; borderLight: string; borderDark: string }
> = {
  VERB: {
    label: 'Động từ',
    light: 'bg-blue-50 text-blue-700',
    dark: 'bg-blue-950/40 text-blue-300',
    borderLight: 'border-blue-200',
    borderDark: 'border-blue-800/50',
  },
  AUX: {
    label: 'Trợ động từ',
    light: 'bg-indigo-50 text-indigo-700',
    dark: 'bg-indigo-950/40 text-indigo-300',
    borderLight: 'border-indigo-200',
    borderDark: 'border-indigo-800/50',
  },
  NOUN: {
    label: 'Danh từ',
    light: 'bg-emerald-50 text-emerald-700',
    dark: 'bg-emerald-950/40 text-emerald-300',
    borderLight: 'border-emerald-200',
    borderDark: 'border-emerald-800/50',
  },
  PROPN: {
    label: 'Tên riêng',
    light: 'bg-teal-50 text-teal-700',
    dark: 'bg-teal-950/40 text-teal-300',
    borderLight: 'border-teal-200',
    borderDark: 'border-teal-800/50',
  },
  PRON: {
    label: 'Đại từ',
    light: 'bg-purple-50 text-purple-700',
    dark: 'bg-purple-950/40 text-purple-300',
    borderLight: 'border-purple-200',
    borderDark: 'border-purple-800/50',
  },
  DET: {
    label: 'Từ hạn định',
    light: 'bg-amber-50 text-amber-700',
    dark: 'bg-amber-950/40 text-amber-300',
    borderLight: 'border-amber-200',
    borderDark: 'border-amber-800/50',
  },
  ADJ: {
    label: 'Tính từ',
    light: 'bg-rose-50 text-rose-700',
    dark: 'bg-rose-950/40 text-rose-300',
    borderLight: 'border-rose-200',
    borderDark: 'border-rose-800/50',
  },
  ADV: {
    label: 'Phó từ',
    light: 'bg-orange-50 text-orange-700',
    dark: 'bg-orange-950/40 text-orange-300',
    borderLight: 'border-orange-200',
    borderDark: 'border-orange-800/50',
  },
  ADP: {
    label: 'Giới từ',
    light: 'bg-cyan-50 text-cyan-700',
    dark: 'bg-cyan-950/40 text-cyan-300',
    borderLight: 'border-cyan-200',
    borderDark: 'border-cyan-800/50',
  },
  CCONJ: {
    label: 'Liên từ',
    light: 'bg-stone-100 text-stone-700',
    dark: 'bg-stone-800 text-stone-300',
    borderLight: 'border-stone-200',
    borderDark: 'border-stone-700',
  },
  SCONJ: {
    label: 'Liên từ phụ',
    light: 'bg-stone-100 text-stone-700',
    dark: 'bg-stone-800 text-stone-300',
    borderLight: 'border-stone-200',
    borderDark: 'border-stone-700',
  },
  PUNCT: {
    label: 'Dấu câu',
    light: 'bg-stone-50 text-stone-400',
    dark: 'bg-stone-900 text-stone-500',
    borderLight: 'border-stone-200',
    borderDark: 'border-stone-800',
  },
}

export const GrammarAnalysisPanel: React.FC<GrammarAnalysisPanelProps> = ({
  sentence,
  darkMode = false,
  onClose,
  onViewRule,
}) => {
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<SentenceAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedTokenIdx, setSelectedTokenIdx] = useState<number | null>(null)

  useEffect(() => {
    if (!sentence) {
      setAnalysis(null)
      return
    }

    setLoading(true)
    setError(null)
    setSelectedTokenIdx(null)

    api
      .getSentenceAnalysis(sentence.id)
      .then((res) => {
        setAnalysis(res)
      })
      .catch((err) => {
        // Fallback to analyzing direct text if sentence id endpoint is not indexed
        api
          .analyzeSentence(sentence.text)
          .then((res) => setAnalysis(res))
          .catch((e2) => setError(err?.message || e2?.message || 'Không thể phân tích câu.'))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [sentence?.id, sentence?.text])

  if (!sentence) return null

  // Collect all token indices that are part of matches
  const matchedTokenIndices = new Set<number>()
  analysis?.matches.forEach((m) => {
    m.matched_token_indices.forEach((idx) => matchedTokenIndices.add(idx))
  })

  const selectedToken =
    selectedTokenIdx !== null && analysis?.tokens ? analysis.tokens[selectedTokenIdx] : null

  return (
    <div
      className={`flex flex-col h-full border-l transition-colors duration-200 ${
        darkMode
          ? 'bg-[#1C1A18] text-[#E8E3DA] border-[#33302C]'
          : 'bg-white text-ink-900 border-stone-200'
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b ${
          darkMode ? 'border-[#33302C] bg-[#24221F]' : 'border-stone-200 bg-parchment-50'
        }`}
      >
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-french-navy dark:text-blue-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider font-sans">
            Phân tích ngữ pháp câu
          </h3>
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded transition-colors ${
            darkMode ? 'hover:bg-[#33302C] text-stone-400' : 'hover:bg-stone-200 text-stone-500'
          }`}
          title="Đóng bảng phân tích"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Sentence Text Box */}
        <div
          className={`p-3 rounded-md border text-sm font-serif italic ${
            darkMode
              ? 'bg-[#252320] border-[#3B3834] text-[#E2DDD5]'
              : 'bg-stone-50 border-stone-200 text-stone-800'
          }`}
        >
          « {sentence.text} »
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 text-stone-400 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-french-navy" />
            <p className="text-xs">Đang phân tích cú pháp spaCy...</p>
          </div>
        )}

        {error && (
          <div className="flex items-start space-x-2 p-3 text-xs rounded border border-rose-200 bg-rose-50 text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!loading && analysis && (
          <>
            {/* Detected Structures Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  Cấu trúc phát hiện ({analysis.matches.length})
                </span>
              </div>

              {analysis.matches.length === 0 ? (
                <p className="text-xs text-stone-400 italic">
                  Không phát hiện cấu trúc đặc thù thuộc thư viện hiện hành.
                </p>
              ) : (
                <div className="space-y-2">
                  {analysis.matches.map((match, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border transition-all ${
                        darkMode
                          ? 'bg-[#262421] border-[#3D3A35]'
                          : 'bg-parchment-100/70 border-stone-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="font-semibold text-xs text-french-navy dark:text-blue-400">
                          {match.rule_name}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                            darkMode
                              ? 'bg-blue-900/40 text-blue-300'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {(match.confidence * 100).toFixed(0)}%
                        </span>
                      </div>

                      <div className="text-xs font-mono font-medium text-stone-700 dark:text-stone-300 mb-1">
                        Cụm: <span className="underline decoration-french-bordeaux decoration-1">{match.matched_text}</span>
                      </div>

                      {match.notes && (
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 mb-2">
                          {match.notes}
                        </p>
                      )}

                      <button
                        onClick={() => onViewRule(match.rule_id)}
                        className={`text-[11px] font-medium flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
                          darkMode
                            ? 'bg-[#33302C] hover:bg-[#3D3A35] text-stone-200'
                            : 'bg-white hover:bg-stone-100 text-ink-900 border border-stone-200 shadow-sm'
                        }`}
                      >
                        <BookOpen className="w-3 h-3 text-french-ochre" />
                        <span>Xem quy tắc</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Token Stream with Soft Role-based Colors */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  Phân tích vai trò từ (Tokens)
                </span>
                <span className="text-[10px] text-stone-400">
                  Bấm token để xem chi tiết
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 leading-normal">
                {analysis.tokens.map((tok) => {
                  const style = POS_STYLES[tok.pos] || {
                    label: tok.pos,
                    light: 'bg-stone-50 text-stone-600',
                    dark: 'bg-stone-900 text-stone-400',
                    borderLight: 'border-stone-200',
                    borderDark: 'border-stone-800',
                  }
                  const isMatched = matchedTokenIndices.has(tok.index)
                  const isSelected = selectedTokenIdx === tok.index

                  return (
                    <button
                      key={tok.index}
                      onClick={() =>
                        setSelectedTokenIdx(selectedTokenIdx === tok.index ? null : tok.index)
                      }
                      className={`inline-flex flex-col items-center px-2 py-1 rounded border text-xs transition-all ${
                        darkMode ? style.dark : style.light
                      } ${darkMode ? style.borderDark : style.borderLight} ${
                        isSelected
                          ? 'ring-2 ring-french-navy dark:ring-blue-400 shadow-sm scale-105 z-10'
                          : ''
                      } ${
                        isMatched
                          ? 'font-semibold border-b-2 border-b-french-bordeaux dark:border-b-amber-500'
                          : ''
                      }`}
                      title={`${tok.text} | Lemme: ${tok.lemma} | POS: ${tok.pos} | Dep: ${tok.dep}`}
                    >
                      <span className="font-serif">{tok.text}</span>
                      <span className="text-[9px] opacity-75 font-mono">{tok.pos}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Selected Token Inspector Card */}
            {selectedToken && (
              <div
                className={`p-3 rounded-lg border text-xs space-y-1.5 transition-all ${
                  darkMode
                    ? 'bg-[#22201D] border-[#383531] text-stone-300'
                    : 'bg-parchment-50 border-stone-200 text-stone-700'
                }`}
              >
                <div className="flex items-center justify-between font-bold border-b pb-1 mb-1 border-stone-200 dark:border-stone-700">
                  <span>Từ: « {selectedToken.text} »</span>
                  <span className="text-[10px] font-mono text-french-navy dark:text-blue-400">
                    Pos: {selectedToken.pos} ({POS_STYLES[selectedToken.pos]?.label || 'Khác'})
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                  <div>
                    <span className="text-stone-400">Nguyên mẫu (Lemma):</span>{' '}
                    <span className="font-mono font-medium">{selectedToken.lemma}</span>
                  </div>
                  <div>
                    <span className="text-stone-400">Quan hệ cú pháp:</span>{' '}
                    <span className="font-mono font-medium">{selectedToken.dep}</span>
                  </div>
                  <div>
                    <span className="text-stone-400">Gốc phụ thuộc (Head):</span>{' '}
                    <span className="font-mono font-medium">{selectedToken.head_text}</span>
                  </div>
                  <div>
                    <span className="text-stone-400">Dừng từ (Stop word):</span>{' '}
                    <span>{selectedToken.is_stop ? 'Có' : 'Không'}</span>
                  </div>
                </div>

                {Object.keys(selectedToken.morph || {}).length > 0 && (
                  <div className="pt-1 mt-1 border-t border-dashed border-stone-200 dark:border-stone-700">
                    <span className="text-[10px] text-stone-400 block mb-0.5">
                      Hình thái học (Morphology):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(selectedToken.morph).map(([k, v]) => (
                        <span
                          key={k}
                          className={`text-[9px] px-1 py-0.5 rounded font-mono ${
                            darkMode
                              ? 'bg-stone-800 text-stone-300'
                              : 'bg-white border border-stone-200 text-stone-600'
                          }`}
                        >
                          {k}={v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Legend */}
      <div
        className={`px-4 py-2 border-t text-[10px] flex items-center justify-between text-stone-400 ${
          darkMode ? 'border-[#33302C] bg-[#1C1A18]' : 'border-stone-200 bg-stone-50'
        }`}
      >
        <span>Gạch chân đỏ: Thành phần cấu trúc</span>
        <span>spaCy fr_core_news_md</span>
      </div>
    </div>
  )
}
