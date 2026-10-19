import React, { useState, useEffect, useRef } from 'react'
import {
  ChevronLeft,
  Sparkles,
  PenTool,
} from 'lucide-react'
import type { Document, DocumentSentence } from '../../types'

interface ReaderViewProps {
  document: Document
  sentences: DocumentSentence[]
  activeSentenceIndex: number | null
  onSelectSentence: (sentenceIndex: number) => void
  onExplainSentence: (sentence: DocumentSentence) => void
  onPracticeRule: (ruleId: string, contextSentence?: string) => void
  onBackToList: () => void
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  document,
  sentences,
  activeSentenceIndex,
  onSelectSentence,
  onExplainSentence,
  onPracticeRule,
  onBackToList,
}) => {
  const [fontSize, setFontSize] = useState<'base' | 'lg' | 'xl'>('lg')
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>('serif')
  const [selectedChapter, setSelectedChapter] = useState<number | 'all'>('all')
  const sentenceRefs = useRef<{ [key: number]: HTMLSpanElement | null }>({})

  // Extract unique chapters
  const chapters = Array.from(new Set(sentences.map((s) => s.chapter_index))).sort((a, b) => a - b)

  // Filter sentences by chapter if selected
  const displayedSentences =
    selectedChapter === 'all'
      ? sentences
      : sentences.filter((s) => s.chapter_index === selectedChapter)

  // Auto-scroll focused sentence into view
  useEffect(() => {
    if (activeSentenceIndex !== null && sentenceRefs.current[activeSentenceIndex]) {
      const el = sentenceRefs.current[activeSentenceIndex]
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }
    }
  }, [activeSentenceIndex])

  // Keyboard navigation (j/k, e, p, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if focus is in an input or textarea
      if (
        documentActiveElementIsInput() ||
        displayedSentences.length === 0
      ) {
        return
      }

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        if (activeSentenceIndex === null) {
          onSelectSentence(displayedSentences[0].sentence_index)
        } else {
          const currentIdx = displayedSentences.findIndex(
            (s) => s.sentence_index === activeSentenceIndex
          )
          if (currentIdx < displayedSentences.length - 1) {
            onSelectSentence(displayedSentences[currentIdx + 1].sentence_index)
          }
        }
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (activeSentenceIndex !== null) {
          const currentIdx = displayedSentences.findIndex(
            (s) => s.sentence_index === activeSentenceIndex
          )
          if (currentIdx > 0) {
            onSelectSentence(displayedSentences[currentIdx - 1].sentence_index)
          }
        }
      } else if (e.key === 'Escape') {
        onSelectSentence(-1) // Deselect
      } else if (e.key === 'e' && activeSentenceIndex !== null) {
        const activeSent = displayedSentences.find(
          (s) => s.sentence_index === activeSentenceIndex
        )
        if (activeSent) {
          e.preventDefault()
          onExplainSentence(activeSent)
        }
      } else if (e.key === 'p' && activeSentenceIndex !== null) {
        const activeSent = displayedSentences.find(
          (s) => s.sentence_index === activeSentenceIndex
        )
        if (activeSent && activeSent.matched_rules) {
          e.preventDefault()
          const primaryRule = activeSent.matched_rules.split(',')[0].trim()
          if (primaryRule) {
            onPracticeRule(primaryRule, activeSent.text)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [displayedSentences, activeSentenceIndex, onSelectSentence, onExplainSentence, onPracticeRule])

  function documentActiveElementIsInput(): boolean {
    const el = window.document.activeElement
    if (!el) return false
    const tag = el.tagName.toLowerCase()
    return tag === 'input' || tag === 'textarea' || el.getAttribute('contenteditable') === 'true'
  }

  const activeSentence = displayedSentences.find(
    (s) => s.sentence_index === activeSentenceIndex
  )

  const fontSizeClasses = {
    base: 'text-sm sm:text-base leading-relaxed',
    lg: 'text-base sm:text-lg leading-loose',
    xl: 'text-lg sm:text-xl leading-loose',
  }

  return (
    <div className="flex flex-col h-full bg-parchment-50 border border-stone-border rounded-lg shadow-sm overflow-hidden">
      {/* Reader Control Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-stone-border bg-parchment-100/60">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToList}
            className="text-xs font-medium text-ink-700 hover:text-ink-900 flex items-center space-x-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Tủ sách</span>
          </button>
          <span className="text-stone-300">|</span>
          <h3 className="font-serif font-bold text-sm text-ink-900 truncate max-w-xs sm:max-w-md">
            {document.title}
          </h3>
        </div>

        {/* Reader Preferences */}
        <div className="flex items-center space-x-4 text-xs text-ink-700">
          {/* Chapter select */}
          {chapters.length > 1 && (
            <select
              value={selectedChapter}
              onChange={(e) =>
                setSelectedChapter(
                  e.target.value === 'all' ? 'all' : Number(e.target.value)
                )
              }
              className="bg-white border border-stone-border text-xs rounded px-2 py-1 text-ink-800"
            >
              <option value="all">Tất cả các chương</option>
              {chapters.map((ch) => (
                <option key={ch} value={ch}>
                  Chương / Mục {ch}
                </option>
              ))}
            </select>
          )}

          {/* Font switcher */}
          <div className="flex items-center border border-stone-border rounded bg-white p-0.5">
            <button
              onClick={() => setFontFamily('serif')}
              className={`px-2 py-0.5 rounded text-[11px] font-serif ${
                fontFamily === 'serif' ? 'bg-ink-900 text-white font-bold' : 'hover:bg-parchment-200'
              }`}
            >
              Serif
            </button>
            <button
              onClick={() => setFontFamily('sans')}
              className={`px-2 py-0.5 rounded text-[11px] font-sans ${
                fontFamily === 'sans' ? 'bg-ink-900 text-white font-bold' : 'hover:bg-parchment-200'
              }`}
            >
              Sans
            </button>
          </div>

          {/* Size switcher */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setFontSize('base')}
              className={`px-2 py-1 border border-stone-border rounded text-[11px] ${
                fontSize === 'base' ? 'bg-ink-900 text-white' : 'bg-white hover:bg-parchment-200'
              }`}
            >
              A-
            </button>
            <button
              onClick={() => setFontSize('lg')}
              className={`px-2 py-1 border border-stone-border rounded text-[11px] ${
                fontSize === 'lg' ? 'bg-ink-900 text-white' : 'bg-white hover:bg-parchment-200'
              }`}
            >
              A
            </button>
            <button
              onClick={() => setFontSize('xl')}
              className={`px-2 py-1 border border-stone-border rounded text-[11px] ${
                fontSize === 'xl' ? 'bg-ink-900 text-white' : 'bg-white hover:bg-parchment-200'
              }`}
            >
              A+
            </button>
          </div>
        </div>
      </div>

      {/* Main Text Container */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-16 py-8 sm:py-12 max-w-4xl mx-auto w-full">
        <div
          className={`text-ink-900 transition-all ${
            fontFamily === 'serif' ? 'font-serif' : 'font-sans'
          } ${fontSizeClasses[fontSize]}`}
        >
          {displayedSentences.map((sent) => {
            const isFocused = sent.sentence_index === activeSentenceIndex
            const hasGrammarRule = Boolean(sent.matched_rules)

            return (
              <span
                key={sent.id}
                ref={(el) => {
                  sentenceRefs.current[sent.sentence_index] = el
                }}
                onClick={() => onSelectSentence(sent.sentence_index)}
                className={`inline cursor-pointer transition-colors px-1 py-0.5 rounded relative ${
                  isFocused
                    ? 'bg-parchment-300 text-ink-900 underline decoration-french-bordeaux decoration-2'
                    : hasGrammarRule
                    ? 'hover:bg-parchment-200 text-ink-900'
                    : 'hover:bg-parchment-200 text-ink-800'
                }`}
              >
                {sent.text}{' '}
              </span>
            )
          })}
        </div>
      </div>

      {/* Interactive Bottom Action Bar when a sentence is selected */}
      {activeSentence && (
        <div className="border-t border-stone-border bg-white px-6 py-3 flex items-center justify-between text-xs transition-all">
          <div className="flex items-center space-x-2 truncate">
            <span className="font-semibold text-ink-700">Câu đã chọn:</span>
            <span className="font-serif italic text-ink-900 truncate max-w-md">
              "{activeSentence.text}"
            </span>
            {activeSentence.matched_rules && (
              <div className="hidden sm:flex items-center space-x-1 ml-2">
                {activeSentence.matched_rules.split(',').map((r) => (
                  <span
                    key={r}
                    className="px-1.5 py-0.5 rounded bg-french-navy/10 text-french-navy font-mono text-[10px]"
                  >
                    {r.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => onExplainSentence(activeSentence)}
              className="px-3 py-1.5 border border-stone-border hover:border-ink-900 rounded font-medium text-ink-800 transition-colors flex items-center space-x-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-french-ochre" />
              <span>Giải thích cú pháp (E)</span>
            </button>

            {activeSentence.matched_rules && (
              <button
                onClick={() => {
                  const ruleId = activeSentence.matched_rules!.split(',')[0].trim()
                  onPracticeRule(ruleId, activeSentence.text)
                }}
                className="px-3 py-1.5 bg-ink-900 text-white hover:bg-ink-800 rounded font-medium transition-colors flex items-center space-x-1.5"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Luyện cấu trúc này (P)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Hint Footer */}
      <div className="border-t border-stone-border/60 bg-parchment-100/40 px-6 py-1.5 flex items-center justify-between text-[11px] text-ink-500">
        <div className="flex items-center space-x-4">
          <span>Phím tắt:</span>
          <span><kbd className="px-1 py-0.5 bg-white border border-stone-border rounded font-mono">j</kbd> Câu tiếp</span>
          <span><kbd className="px-1 py-0.5 bg-white border border-stone-border rounded font-mono">k</kbd> Câu trước</span>
          <span><kbd className="px-1 py-0.5 bg-white border border-stone-border rounded font-mono">e</kbd> Giải thích</span>
          <span><kbd className="px-1 py-0.5 bg-white border border-stone-border rounded font-mono">p</kbd> Luyện viết</span>
          <span><kbd className="px-1 py-0.5 bg-white border border-stone-border rounded font-mono">Esc</kbd> Bỏ chọn</span>
        </div>
        <span>{displayedSentences.length} câu</span>
      </div>
    </div>
  )
}
