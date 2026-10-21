import React, { useState, useEffect } from 'react'
import { X, BookOpen, PenTool, Sparkles, RefreshCw } from 'lucide-react'
import { api } from '../../services/api'
import type { GrammarRuleMetadata, Document, MinedExample } from '../../types'

interface GrammarDetailModalProps {
  rule: GrammarRuleMetadata | null
  isOpen: boolean
  onClose: () => void
  currentDocument?: Document | null
  onPractice: (ruleId: string, modelSentence?: string) => void
}

export const GrammarDetailModal: React.FC<GrammarDetailModalProps> = ({
  rule,
  isOpen,
  onClose,
  currentDocument,
  onPractice,
}) => {
  const [minedExamples, setMinedExamples] = useState<MinedExample[]>([])
  const [isLoadingMined, setIsLoadingMined] = useState(false)
  const [activeTab, setActiveTab] = useState<'rules' | 'mined'>('rules')

  useEffect(() => {
    if (isOpen && rule && currentDocument) {
      loadMinedSentences(currentDocument.id, rule.id)
    } else {
      setMinedExamples([])
    }
  }, [isOpen, rule, currentDocument])

  const loadMinedSentences = async (docId: number, ruleId: string) => {
    try {
      setIsLoadingMined(true)
      const res = await api.mineExamples(docId, ruleId, 20)
      setMinedExamples(res.examples || [])
    } catch {
      setMinedExamples([])
    } finally {
      setIsLoadingMined(false)
    }
  }

  if (!isOpen || !rule) return null

  // Render conjugation table helpers
  const renderConjugationTable = (table: Record<string, any>) => {
    if (!table || Object.keys(table).length === 0) return null

    return (
      <div className="border border-stone-border rounded overflow-hidden">
        <table className="w-full text-xs font-mono">
          <tbody className="divide-y divide-stone-100">
            {Object.entries(table).map(([key, val]) => {
              if (typeof val === 'object' && val !== null) {
                return (
                  <tr key={key} className="bg-stone-subtle">
                    <td colSpan={2} className="px-3 py-2">
                      <span className="font-semibold text-french-bordeaux block mb-1">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <div className="pl-3 space-y-1">
                        {Object.entries(val).map(([subK, subV]) => (
                          <div key={subK} className="flex justify-between text-[11px]">
                            <span className="text-ink-600">{subK}:</span>
                            <span className="text-ink-900 font-medium">{String(subV)}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              }

              return (
                <tr key={key} className="hover:bg-parchment-50">
                  <td className="px-3 py-1.5 font-medium text-french-navy w-1/3 bg-stone-50/50">
                    {key}
                  </td>
                  <td className="px-3 py-1.5 text-ink-900 font-serif italic">{String(val)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-[#1E1D1B] rounded-lg border border-stone-border dark:border-[#3A3735] shadow-xl max-w-3xl w-full my-8 flex flex-col max-h-[90vh] transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-border dark:border-[#3A3735] flex items-start justify-between bg-parchment-50 dark:bg-[#242220]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-mono uppercase tracking-wider bg-stone-200 dark:bg-[#3A3735] text-ink-800 dark:text-[#E8E3DA] px-2 py-0.5 rounded">
                {rule.category}
              </span>
              <span className="text-[11px] font-mono bg-french-navy dark:bg-slate-700 text-white px-2 py-0.5 rounded">
                {rule.level}
              </span>
            </div>
            <h2 className="font-serif font-bold text-xl text-ink-900 dark:text-[#E8E3DA]">{rule.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-ink-500 dark:text-[#A8A29E] hover:text-ink-900 dark:hover:text-[#E8E3DA] hover:bg-stone-subtle dark:hover:bg-[#2C2A27] rounded transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="px-6 border-b border-stone-border dark:border-[#3A3735] flex gap-4 text-xs font-mono bg-white dark:bg-[#1E1D1B]">
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`py-2.5 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'rules'
                ? 'border-french-bordeaux text-french-bordeaux dark:border-amber-400 dark:text-amber-300'
                : 'border-transparent text-ink-500 dark:text-[#A8A29E] hover:text-ink-900 dark:hover:text-[#E8E3DA]'
            }`}
          >
            Quy tắc & Bảng chia
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mined')}
            className={`py-2.5 border-b-2 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'mined'
                ? 'border-french-bordeaux text-french-bordeaux'
                : 'border-transparent text-ink-500 hover:text-ink-900'
            }`}
          >
            <span>Câu thực tế từ sách</span>
            {currentDocument && minedExamples.length > 0 && (
              <span className="px-1.5 py-0.2 bg-stone-200 text-ink-800 rounded text-[10px]">
                {minedExamples.length}
              </span>
            )}
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'rules' ? (
            <>
              {/* Formula */}
              <div className="p-3.5 bg-parchment-100 border border-stone-border rounded space-y-1">
                <span className="text-xs font-mono text-ink-500 block">Công thức:</span>
                <p className="font-mono text-french-bordeaux font-bold text-sm">{rule.formula}</p>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <h4 className="text-xs font-mono text-ink-500 uppercase tracking-wide">Ý nghĩa:</h4>
                <p className="text-sm text-ink-800 leading-relaxed font-serif italic">
                  {rule.description}
                </p>
              </div>

              {/* Key points */}
              {rule.key_points && rule.key_points.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-mono text-ink-500 uppercase tracking-wide">
                    Quy tắc trọng tâm:
                  </h4>
                  <ul className="space-y-1.5 text-xs text-ink-800">
                    {rule.key_points.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-french-bordeaux font-bold mt-0.5">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Conjugation table */}
              {rule.conjugation_table && Object.keys(rule.conjugation_table).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-mono text-ink-500 uppercase tracking-wide">
                    Bảng chia & Dạng thức:
                  </h4>
                  {renderConjugationTable(rule.conjugation_table)}
                </div>
              )}

              {/* Standard textbook examples */}
              {rule.examples && rule.examples.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-mono text-ink-500 uppercase tracking-wide">
                    Ví dụ mẫu kinh điển:
                  </h4>
                  <div className="space-y-1.5">
                    {rule.examples.map((ex, i) => (
                      <div
                        key={i}
                        className="p-2.5 bg-stone-subtle border border-stone-border rounded font-serif text-xs text-ink-900 italic flex items-center justify-between"
                      >
                        <span>« {ex} »</span>
                        <button
                          type="button"
                          onClick={() => {
                            onClose()
                            onPractice(rule.id, ex)
                          }}
                          className="ml-2 px-2 py-1 bg-white hover:bg-stone-200 border border-stone-border rounded text-[11px] font-sans not-italic text-ink-700 transition-colors shrink-0 cursor-pointer"
                        >
                          Luyện câu tương tự
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Mined Examples from current document */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-serif font-bold text-sm text-ink-900">
                    {currentDocument
                      ? `Câu trích từ sách: « ${currentDocument.title} »`
                      : 'Chưa chọn tài liệu đọc'}
                  </h4>
                  <p className="text-xs text-ink-500">
                    Học ngầm qua ngữ cảnh thực tế (Comprehensible Input)
                  </p>
                </div>
                {currentDocument && (
                  <button
                    type="button"
                    onClick={() => loadMinedSentences(currentDocument.id, rule.id)}
                    disabled={isLoadingMined}
                    className="p-1.5 text-ink-500 hover:text-ink-900 rounded border border-stone-border hover:bg-stone-subtle transition-colors cursor-pointer"
                    title="Tải lại danh sách câu"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMined ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>

              {!currentDocument ? (
                <div className="p-8 text-center bg-stone-subtle border border-dashed border-stone-300 rounded text-xs text-ink-500 space-y-2">
                  <BookOpen className="w-8 h-8 mx-auto text-ink-400 opacity-60" />
                  <p>Hãy mở một cuốn sách trong phần "Tài liệu đọc" để trích xuất các câu ví dụ thực tế.</p>
                </div>
              ) : isLoadingMined ? (
                <div className="py-12 text-center text-xs text-ink-500 font-mono">
                  Đang quét và đào câu trong tài liệu...
                </div>
              ) : minedExamples.length === 0 ? (
                <div className="p-8 text-center bg-stone-subtle border border-dashed border-stone-300 rounded text-xs text-ink-500 space-y-2">
                  <Sparkles className="w-6 h-6 mx-auto text-ink-400 opacity-60" />
                  <p>Không tìm thấy câu nào khớp cấu trúc này trong tài liệu hiện tại.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="text-[11px] font-mono text-ink-500">
                    Tìm thấy {minedExamples.length} câu ví dụ:
                  </div>
                  {minedExamples.map((ex) => (
                    <div
                      key={ex.sentence_id}
                      className="p-3 bg-white border border-stone-border rounded hover:border-stone-400 transition-colors space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-serif text-sm text-ink-900 leading-relaxed italic">
                          « {ex.text} »
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            onClose()
                            onPractice(rule.id, ex.text)
                          }}
                          className="px-2.5 py-1 bg-french-bordeaux text-white hover:bg-red-900 rounded text-[11px] font-sans not-italic transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                        >
                          <PenTool className="w-3 h-3" />
                          <span>Luyện cấu trúc này</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] font-mono text-ink-400">
                        <span>Chương {ex.chapter_index + 1}</span>
                        <span>• Câu #{ex.sentence_index + 1}</span>
                        {ex.matched_span && (
                          <span className="bg-red-50 text-french-bordeaux px-1.5 py-0.2 rounded border border-red-200">
                            khớp: {ex.matched_span}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-stone-border bg-parchment-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-stone-border rounded text-xs text-ink-700 hover:bg-stone-subtle transition-colors cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={() => {
              onClose()
              onPractice(rule.id)
            }}
            className="px-5 py-2 bg-french-bordeaux text-white rounded text-xs font-medium hover:bg-red-900 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Luyện viết câu với cấu trúc này</span>
          </button>
        </div>
      </div>
    </div>
  )
}
