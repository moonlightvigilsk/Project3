import React, { useState, useEffect } from 'react'
import { X, BookA, Loader2 } from 'lucide-react'
import type { WordLookupResponse } from '../../types'
import { api } from '../../services/api'

interface WordLookupPopupProps {
  isOpen: boolean
  word: string
  contextSentence?: string
  documentId?: number
  position: { x: number; y: number }
  darkMode?: boolean
  onClose: () => void
  onStatusChanged?: (lemma: string, newStatus: 'new' | 'learning' | 'known') => void
}

export const WordLookupPopup: React.FC<WordLookupPopupProps> = ({
  isOpen,
  word,
  contextSentence,
  documentId,
  position,
  darkMode = false,
  onClose,
  onStatusChanged,
}) => {
  const [data, setData] = useState<WordLookupResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !word.trim()) {
      setData(null)
      return
    }

    setLoading(true)
    setError(null)

    api
      .lookupWord({
        word: word.trim(),
        context_sentence: contextSentence,
        document_id: documentId,
      })
      .then((res) => {
        setData(res)
      })
      .catch((err) => {
        setError(err.message || 'Không thể tra từ.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [isOpen, word, contextSentence, documentId])

  // Keyboard shortcuts: 1 (new), 2 (learning), 3 (known), or Escape to close
  useEffect(() => {
    if (!isOpen || !data) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === '1' || e.key.toLowerCase() === 'n') {
        handleChangeStatus('new')
      } else if (e.key === '2' || e.key.toLowerCase() === 'l') {
        handleChangeStatus('learning')
      } else if (e.key === '3' || e.key.toLowerCase() === 'k') {
        handleChangeStatus('known')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, data])

  if (!isOpen) return null

  const handleChangeStatus = async (status: 'new' | 'learning' | 'known') => {
    if (!data) return
    try {
      await api.updateStatusByLemma(data.lemma, status)
      setData((prev) => (prev ? { ...prev, status } : prev))
      if (onStatusChanged) {
        onStatusChanged(data.lemma, status)
      }
    } catch (e: any) {
      console.warn('Failed to update status:', e)
    }
  }

  // Calculate position styles so popup does not overflow viewport
  const popupWidth = 320
  const adjustedX = Math.min(Math.max(16, position.x - popupWidth / 2), window.innerWidth - popupWidth - 20)
  const adjustedY = Math.min(position.y + 12, window.innerHeight - 340)

  return (
    <div
      style={{ top: `${adjustedY}px`, left: `${adjustedX}px` }}
      className={`fixed z-50 w-80 rounded-lg shadow-2xl border transition-all animate-in fade-in zoom-in-95 duration-150 ${
        darkMode
          ? 'bg-[#22201D] text-[#E8E3DA] border-[#3D3A35]'
          : 'bg-white text-ink-900 border-stone-300'
      }`}
    >
      {/* Top Banner */}
      <div
        className={`px-3.5 py-2.5 border-b flex items-center justify-between rounded-t-lg ${
          darkMode ? 'border-[#3D3A35] bg-[#2A2724]' : 'border-stone-200 bg-parchment-100/80'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <BookA className="w-4 h-4 text-french-navy shrink-0" />
          <span className="font-serif font-bold text-base truncate">{word}</span>
          {data && (
            <span className="text-[11px] font-mono text-stone-500 shrink-0">
              ({data.pos})
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors"
          title="Đóng (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-3.5 space-y-3 text-xs">
        {loading && (
          <div className="py-6 flex flex-col items-center justify-center text-stone-400 space-y-2">
            <Loader2 className="w-5 h-5 animate-spin text-french-navy" />
            <span className="text-[11px]">Đang tra Wiktionary...</span>
          </div>
        )}

        {error && (
          <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
            {error}
          </div>
        )}

        {!loading && data && (
          <>
            {/* Lemma & Frequency */}
            <div className="flex items-center justify-between text-[11px] pb-1 border-b border-dashed border-stone-200 dark:border-stone-700">
              <div>
                <span className="text-stone-400">Nguyên mẫu (Lemma): </span>
                <span className="font-mono font-bold text-french-navy dark:text-blue-400">
                  {data.lemma}
                </span>
              </div>
              <div className="text-stone-500 font-mono">
                Gặp: <span className="font-bold">{data.occurrences}</span> lần
              </div>
            </div>

            {/* Definition */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">
                Nghĩa từ điển ({data.source}):
              </span>
              <p className="text-stone-800 dark:text-stone-200 font-sans leading-relaxed">
                {data.definition_vi || data.definition || 'Chưa có định nghĩa cho từ này.'}
              </p>
              {data.definition_vi && data.definition && (
                <p className="text-stone-500 italic text-[11px] pt-0.5 border-t border-stone-100 dark:border-stone-800">
                  FR: {data.definition}
                </p>
              )}
            </div>

            {/* Context Sentence */}
            {data.context_sentence && (
              <div
                className={`p-2 rounded border-l-2 border-french-bordeaux text-[11px] ${
                  darkMode ? 'bg-[#292623] text-stone-300' : 'bg-parchment-50 text-stone-700'
                }`}
              >
                <span className="text-[10px] text-stone-400 block mb-0.5">Câu trong văn bản:</span>
                <p className="font-serif italic leading-snug">« {data.context_sentence} »</p>
              </div>
            )}

            {/* Learning Status Switcher */}
            <div className="pt-2 border-t border-stone-200 dark:border-stone-700 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-stone-400">
                <span>Trạng thái học (Phím 1, 2, 3):</span>
                <span className="font-mono font-medium uppercase text-stone-600 dark:text-stone-300">
                  {data.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleChangeStatus('new')}
                  className={`py-1 px-1.5 text-[11px] rounded font-medium border transition-colors flex items-center justify-center gap-1 ${
                    data.status === 'new'
                      ? 'bg-rose-100 border-rose-300 text-rose-800 font-bold'
                      : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50'
                  }`}
                  title="Phím 1 hoặc N"
                >
                  <span>1. Mới</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleChangeStatus('learning')}
                  className={`py-1 px-1.5 text-[11px] rounded font-medium border transition-colors flex items-center justify-center gap-1 ${
                    data.status === 'learning'
                      ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                      : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50'
                  }`}
                  title="Phím 2 hoặc L"
                >
                  <span>2. Đang học</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleChangeStatus('known')}
                  className={`py-1 px-1.5 text-[11px] rounded font-medium border transition-colors flex items-center justify-center gap-1 ${
                    data.status === 'known'
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-900 font-bold'
                      : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50'
                  }`}
                  title="Phím 3 hoặc K"
                >
                  <span>3. Đã biết</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
