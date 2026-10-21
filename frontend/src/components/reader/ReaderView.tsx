import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  PenTool,
  Sun,
  Moon,
  Columns2,
  AlignJustify,
  Maximize2,
} from 'lucide-react'
import type { Document, DocumentSection, DocumentSentence } from '../../types'
import { api } from '../../services/api'
import { GrammarAnalysisPanel } from '../grammar/GrammarAnalysisPanel'
import { WordLookupPopup } from './WordLookupPopup'
import { Highlighter } from 'lucide-react'

interface ReaderViewProps {
  document: Document
  sentences: DocumentSentence[]
  activeSentenceIndex: number | null
  onSelectSentence: (sentenceIndex: number) => void
  onExplainSentence: (sentence: DocumentSentence) => void
  onPracticeRule: (ruleId: string, contextSentence?: string) => void
  onViewGrammarRule?: (ruleId: string) => void
  onBackToList: () => void
  darkMode?: boolean
  onToggleDarkMode?: () => void
}

type FontSize = 'sm' | 'base' | 'lg' | 'xl'
type LineWidth = 'narrow' | 'normal' | 'wide'

const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  sm:   'text-sm leading-relaxed',
  base: 'text-base leading-relaxed',
  lg:   'text-lg leading-loose',
  xl:   'text-xl leading-loose',
}

const LINE_WIDTH_CLASSES: Record<LineWidth, string> = {
  narrow: 'reader-width-narrow',
  normal: 'reader-width-normal',
  wide:   'reader-width-wide',
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  document,
  sentences,
  activeSentenceIndex,
  onSelectSentence,
  onExplainSentence,
  onPracticeRule,
  onViewGrammarRule,
  onBackToList,
  darkMode: initialDarkMode,
  onToggleDarkMode,
}) => {
  const [fontSize, setFontSize]     = useState<FontSize>('lg')
  const [lineWidth, setLineWidth]   = useState<LineWidth>('normal')
  const [darkMode, setDarkMode]     = useState(initialDarkMode ?? false)

  useEffect(() => {
    if (initialDarkMode !== undefined) {
      setDarkMode(initialDarkMode)
    }
  }, [initialDarkMode])

  const toggleDarkMode = useCallback(() => {
    if (onToggleDarkMode) {
      onToggleDarkMode()
    } else {
      setDarkMode((v) => !v)
    }
  }, [onToggleDarkMode])
  const [selectedChapter, setSelectedChapter] = useState<number | 'all'>('all')
  const [sections, setSections]     = useState<DocumentSection[]>([])
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [analysisSentence, setAnalysisSentence] = useState<DocumentSentence | null>(null)

  // Vocabulary highlight & double-click lookup states
  const [highlightNewWords, setHighlightNewWords] = useState(true)
  const [vocabStatusMap, setVocabStatusMap] = useState<Record<string, string>>({})
  const [lookupWord, setLookupWord] = useState<string>('')
  const [lookupContextSentence, setLookupContextSentence] = useState<string>('')
  const [lookupPos, setLookupPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isLookupOpen, setIsLookupOpen] = useState(false)

  // Fetch vocabulary status map for highlighting
  const loadVocabMap = useCallback(() => {
    api
      .getVocabularyStatusMap(document.id)
      .then(setVocabStatusMap)
      .catch(() => {})
  }, [document.id])

  useEffect(() => {
    loadVocabMap()
  }, [loadVocabMap])

  const sentenceRefs = useRef<{ [key: number]: HTMLSpanElement | null }>({})

  // Fetch sections for chapter navigation
  useEffect(() => {
    api.getDocumentSections(document.id).then(setSections).catch(() => {})
  }, [document.id])

  // Apply/remove dark class on body
  useEffect(() => {
    if (darkMode) {
      window.document.body.classList.add('dark')
    } else {
      window.document.body.classList.remove('dark')
    }
    return () => window.document.body.classList.remove('dark')
  }, [darkMode])

  // Extract unique chapter indices from sentences
  const chapters = useMemo(
    () => Array.from(new Set(sentences.map((s) => s.chapter_index))).sort((a, b) => a - b),
    [sentences],
  )

  // Filter sentences by selected chapter
  const displayedSentences = useMemo(
    () =>
      selectedChapter === 'all'
        ? sentences
        : sentences.filter((s) => s.chapter_index === selectedChapter),
    [sentences, selectedChapter],
  )

  // Chapter navigation helpers
  const currentChapterPos = useMemo(() => {
    if (selectedChapter === 'all') return -1
    return chapters.indexOf(selectedChapter as number)
  }, [chapters, selectedChapter])

  const goToPrevChapter = useCallback(() => {
    if (currentChapterPos <= 0) {
      setSelectedChapter('all')
    } else {
      setSelectedChapter(chapters[currentChapterPos - 1])
    }
    onSelectSentence(-1)
  }, [chapters, currentChapterPos, onSelectSentence])

  const goToNextChapter = useCallback(() => {
    if (selectedChapter === 'all' && chapters.length > 0) {
      setSelectedChapter(chapters[0])
    } else if (currentChapterPos < chapters.length - 1) {
      setSelectedChapter(chapters[currentChapterPos + 1])
    }
    onSelectSentence(-1)
  }, [chapters, currentChapterPos, selectedChapter, onSelectSentence])

  const handleSentenceClick = (sent: DocumentSentence) => {
    onSelectSentence(sent.sentence_index)
    setAnalysisSentence(sent)
    setAnalysisOpen(true)
  }

  const handleWordDoubleClick = (e: React.MouseEvent, wordText: string, sentenceText: string) => {
    e.stopPropagation()
    const clean = wordText.replace(/[.,;:!?«»()\[\]{}'’]/g, '').trim()
    if (!clean) return

    setLookupWord(clean)
    setLookupContextSentence(sentenceText)
    setLookupPos({ x: e.clientX, y: e.clientY })
    setIsLookupOpen(true)
  }

  const renderSentenceWithVocab = (sent: DocumentSentence) => {
    const isFocused = sent.sentence_index === activeSentenceIndex
    const hasGrammar = Boolean(sent.matched_rules)

    // Tokenize text into words & spaces for double-click & highlighting
    const tokens = sent.text.split(/(\s+|[.,;:!?«»()\[\]{}]+)/)

    return (
      <span
        key={sent.id}
        data-sentence-index={sent.sentence_index}
        ref={(el) => {
          sentenceRefs.current[sent.sentence_index] = el
        }}
        onClick={() => handleSentenceClick(sent)}
        title={hasGrammar ? `Cấu trúc: ${sent.matched_rules}` : 'Bấm để xem phân tích cú pháp'}
        className={`inline cursor-pointer px-0.5 py-0.5 rounded transition-all ${
          isFocused
            ? tk.highlight
            : hasGrammar
            ? `${tk.hover} ${darkMode ? 'text-[#F5C880]' : 'text-ink-900'} underline decoration-dotted decoration-blue-400 dark:decoration-blue-500 underline-offset-4 decoration-2`
            : `${tk.hover} ${tk.textBody}`
        }`}
      >
        {tokens.map((token, tIdx) => {
          const cleanWord = token.replace(/[.,;:!?«»()\[\]{}'’]/g, '').toLowerCase().trim()
          const status = cleanWord ? vocabStatusMap[cleanWord] : undefined
          const isUnknown = cleanWord && (!status || status === 'new')

          // If highlighting enabled, tint unknown / new words lightly
          const isWord = cleanWord.length > 1 && !/^\s+$/.test(token)
          const wordClass =
            highlightNewWords && isWord && isUnknown && !isFocused
              ? darkMode
                ? 'bg-amber-950/40 text-amber-200/90 rounded-xs px-0.5'
                : 'bg-amber-100/60 text-amber-950 rounded-xs px-0.5'
              : ''

          return (
            <span
              key={tIdx}
              onDoubleClick={(e) => isWord && handleWordDoubleClick(e, token, sent.text)}
              className={`${wordClass} transition-colors`}
              title={isWord ? 'Bấm đúp để tra từ điển' : undefined}
            >
              {token}
            </span>
          )
        })}
        {' '}
      </span>
    )
  }
  useEffect(() => {
    if (activeSentenceIndex !== null && sentenceRefs.current[activeSentenceIndex]) {
      const el = sentenceRefs.current[activeSentenceIndex]
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [activeSentenceIndex])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused() || displayedSentences.length === 0) return

      switch (e.key) {
        case 'j':
        case 'ArrowDown': {
          e.preventDefault()
          if (activeSentenceIndex === null) {
            onSelectSentence(displayedSentences[0].sentence_index)
          } else {
            const idx = displayedSentences.findIndex(
              (s) => s.sentence_index === activeSentenceIndex,
            )
            if (idx < displayedSentences.length - 1) {
              onSelectSentence(displayedSentences[idx + 1].sentence_index)
            }
          }
          break
        }
        case 'k':
        case 'ArrowUp': {
          e.preventDefault()
          if (activeSentenceIndex !== null) {
            const idx = displayedSentences.findIndex(
              (s) => s.sentence_index === activeSentenceIndex,
            )
            if (idx > 0) {
              onSelectSentence(displayedSentences[idx - 1].sentence_index)
            }
          }
          break
        }
        case 'ArrowLeft': {
          e.preventDefault()
          goToPrevChapter()
          break
        }
        case 'ArrowRight': {
          e.preventDefault()
          goToNextChapter()
          break
        }
        case 'Escape': {
          onSelectSentence(-1)
          break
        }
        case 'e': {
          if (activeSentenceIndex !== null) {
            const s = displayedSentences.find((s) => s.sentence_index === activeSentenceIndex)
            if (s) { e.preventDefault(); onExplainSentence(s) }
          }
          break
        }
        case 'p': {
          if (activeSentenceIndex !== null) {
            const s = displayedSentences.find((s) => s.sentence_index === activeSentenceIndex)
            if (s?.matched_rules) {
              e.preventDefault()
              const primaryRule = s.matched_rules.split(',').find((r) => r.trim()) ?? ''
              if (primaryRule) onPracticeRule(primaryRule, s.text)
            }
          }
          break
        }
        case 'd': {
          e.preventDefault()
          toggleDarkMode()
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [displayedSentences, activeSentenceIndex, onSelectSentence, onExplainSentence, onPracticeRule, goToPrevChapter, goToNextChapter])

  function isInputFocused(): boolean {
    const el = window.document.activeElement
    if (!el) return false
    const tag = el.tagName.toLowerCase()
    return tag === 'input' || tag === 'textarea' || el.getAttribute('contenteditable') === 'true'
  }

  const activeSentence = displayedSentences.find(
    (s) => s.sentence_index === activeSentenceIndex,
  )

  // Chapter title for selected chapter
  const currentChapterTitle = useMemo(() => {
    if (selectedChapter === 'all') return null
    const sec = sections.find((s) => s.section_index === selectedChapter)
    if (sec?.title) return sec.title
    const sent = sentences.find((s) => s.chapter_index === selectedChapter)
    return sent?.chapter_title ?? `Chương ${selectedChapter}`
  }, [selectedChapter, sections, sentences])

  // -- Theme tokens --
  const tk = {
    bg:         darkMode ? 'bg-[#1A1917]'  : 'bg-parchment-50',
    surface:    darkMode ? 'bg-[#242220]'  : 'bg-parchment-100/60',
    border:     darkMode ? 'border-[#3A3735]' : 'border-stone-border',
    text:       darkMode ? 'text-[#E8E3DA]'  : 'text-ink-900',
    textMuted:  darkMode ? 'text-[#78716C]'  : 'text-ink-500',
    textBody:   darkMode ? 'text-[#D6D0C7]'  : 'text-ink-800',
    highlight:  darkMode ? 'bg-[#3D3020] text-[#F5DEB3]' : 'bg-parchment-300 text-ink-900 underline decoration-french-bordeaux decoration-2',
    hover:      darkMode ? 'hover:bg-[#2C2A27]' : 'hover:bg-parchment-200',
    btnActive:  darkMode ? 'bg-[#E8E3DA] text-[#1A1917]' : 'bg-ink-900 text-white',
    btnInactive:darkMode ? 'text-[#A8A29E] hover:bg-[#2C2A27]' : 'text-ink-700 hover:bg-parchment-200',
    selectBg:   darkMode ? 'bg-[#2C2A27] text-[#E8E3DA] border-[#3A3735]' : 'bg-white border-stone-border text-ink-800',
    barBg:      darkMode ? 'bg-[#1F1D1B]' : 'bg-white',
    footerBg:   darkMode ? 'bg-[#1A1917]/60' : 'bg-parchment-100/40',
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ── Main Reader Column ── */}
      <div
        className={`flex flex-col h-full flex-1 min-w-0 ${tk.bg} border ${tk.border} rounded-lg shadow-sm overflow-hidden transition-colors duration-200`}
      >
      {/* ── Control Bar ── */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${tk.border} ${tk.surface} flex-wrap gap-2`}>
        {/* Left: back + title */}
        <div className="flex items-center space-x-2 min-w-0">
          <button
            onClick={onBackToList}
            className={`text-xs font-medium ${tk.textMuted} hover:${tk.text} flex items-center space-x-1 shrink-0`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Tủ sách</span>
          </button>
          <span className={`${tk.textMuted} opacity-40`}>|</span>
          <h3 className={`font-serif font-bold text-sm ${tk.text} truncate max-w-[180px] sm:max-w-sm`}>
            {document.title}
          </h3>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Chapter navigation */}
          {chapters.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={goToPrevChapter}
                disabled={selectedChapter === 'all'}
                title="Chương trước (←)"
                className={`p-1.5 border ${tk.border} rounded disabled:opacity-30 ${tk.btnInactive} transition-colors`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <select
                value={selectedChapter}
                onChange={(e) =>
                  setSelectedChapter(
                    e.target.value === 'all' ? 'all' : Number(e.target.value),
                  )
                }
                className={`border ${tk.selectBg} text-xs rounded px-2 py-1`}
              >
                <option value="all">Tất cả chương</option>
                {chapters.map((ch) => {
                  const sec = sections.find((s) => s.section_index === ch)
                  const label = sec?.title ? sec.title.slice(0, 28) : `Chương ${ch}`
                  return (
                    <option key={ch} value={ch}>
                      {label}
                    </option>
                  )
                })}
              </select>

              <button
                onClick={goToNextChapter}
                disabled={
                  selectedChapter !== 'all' &&
                  currentChapterPos === chapters.length - 1
                }
                title="Chương tiếp (→)"
                className={`p-1.5 border ${tk.border} rounded disabled:opacity-30 ${tk.btnInactive} transition-colors`}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Line width */}
          <div className={`flex items-center border ${tk.border} rounded overflow-hidden`}>
            {(['narrow', 'normal', 'wide'] as LineWidth[]).map((w, i) => {
              const Icon = i === 0 ? Columns2 : i === 1 ? AlignJustify : Maximize2
              return (
                <button
                  key={w}
                  title={w === 'narrow' ? 'Hẹp' : w === 'normal' ? 'Vừa' : 'Rộng'}
                  onClick={() => setLineWidth(w)}
                  className={`px-2 py-1 transition-colors ${
                    lineWidth === w ? tk.btnActive : tk.btnInactive
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              )
            })}
          </div>

          {/* Font size */}
          <div className={`flex items-center border ${tk.border} rounded overflow-hidden`}>
            {(['sm', 'base', 'lg', 'xl'] as FontSize[]).map((s) => (
              <button
                key={s}
                onClick={() => setFontSize(s)}
                className={`px-2 py-1 text-[11px] transition-colors ${
                  fontSize === s ? tk.btnActive : tk.btnInactive
                }`}
              >
                {s === 'sm' ? 'A−' : s === 'base' ? 'A' : s === 'lg' ? 'A+' : 'A++'}
              </button>
            ))}
          </div>

          {/* Toggle highlight new words */}
          <button
            onClick={() => setHighlightNewWords((prev) => !prev)}
            title={highlightNewWords ? 'Tắt tô màu từ chưa biết' : 'Bật tô màu từ chưa biết'}
            className={`p-1.5 border ${tk.border} rounded transition-colors flex items-center gap-1 text-xs ${
              highlightNewWords
                ? 'bg-amber-100/80 text-amber-900 border-amber-300 font-medium'
                : tk.btnInactive
            }`}
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Từ mới</span>
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            title={darkMode ? 'Chế độ sáng (D)' : 'Chế độ tối (D)'}
            className={`p-1.5 border ${tk.border} rounded transition-colors ${tk.btnInactive}`}
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Chapter header strip ── */}
      {currentChapterTitle && (
        <div className={`px-6 py-2 border-b ${tk.border} ${tk.surface}`}>
          <p className={`text-xs font-semibold uppercase tracking-widest ${tk.textMuted} font-serif`}>
            {currentChapterTitle}
          </p>
        </div>
      )}

      {/* ── Main text area ── */}
      <div className={`flex-1 overflow-y-auto py-10 px-4`}>
        <div
          className={`${LINE_WIDTH_CLASSES[lineWidth]} mx-auto transition-all duration-200`}
        >
          <div
            className={`font-serif ${FONT_SIZE_CLASSES[fontSize]} ${tk.textBody} transition-colors duration-200`}
          >
            {displayedSentences.length === 0 ? (
              <p className={`text-center ${tk.textMuted} text-sm mt-16`}>Không có câu nào.</p>
            ) : (
              displayedSentences.map((sent) => renderSentenceWithVocab(sent))
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom action bar (active sentence) ── */}
      {activeSentence && (
        <div
          className={`border-t ${tk.border} ${tk.barBg} px-4 py-2.5 flex items-center justify-between gap-2 text-xs flex-wrap transition-colors`}
        >
          <div className="flex items-center gap-2 truncate min-w-0">
            <span className={`font-semibold ${tk.textMuted} shrink-0`}>Câu đã chọn:</span>
            <span className={`font-serif italic ${tk.text} truncate max-w-xs sm:max-w-sm`}>
              «{activeSentence.text}»
            </span>
            {activeSentence.matched_rules && (
              <div className="hidden sm:flex items-center gap-1 ml-1">
                {activeSentence.matched_rules.split(',').filter(Boolean).map((r) => (
                  <span
                    key={r}
                    className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                      darkMode ? 'bg-[#3D3020] text-[#F5C880]' : 'bg-french-navy/10 text-french-navy'
                    }`}
                  >
                    {r.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setAnalysisSentence(activeSentence)
                setAnalysisOpen(true)
              }}
              className={`px-2.5 py-1.5 border ${tk.border} rounded font-medium ${tk.text} transition-colors flex items-center gap-1.5 ${tk.hover}`}
            >
              <Sparkles className="w-3.5 h-3.5 text-french-navy dark:text-blue-400" />
              <span>Cú pháp & Token</span>
            </button>

            <button
              onClick={() => onExplainSentence(activeSentence)}
              className={`px-2.5 py-1.5 border ${tk.border} rounded font-medium ${tk.text} transition-colors flex items-center gap-1.5 ${tk.hover}`}
            >
              <Sparkles className="w-3.5 h-3.5 text-french-ochre" />
              <span>Giải thích (E)</span>
            </button>

            {activeSentence.matched_rules && (
              <button
                onClick={() => {
                  const ruleId = activeSentence.matched_rules!.split(',').find((r) => r.trim()) ?? ''
                  if (ruleId) onPracticeRule(ruleId, activeSentence.text)
                }}
                className={`px-2.5 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 ${
                  darkMode ? 'bg-[#E8E3DA] text-[#1A1917] hover:bg-parchment-300' : 'bg-ink-900 text-white hover:bg-ink-800'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Luyện viết (P)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Footer keyboard hints ── */}
      <div
        className={`border-t ${tk.border} ${tk.footerBg} px-4 py-1.5 flex items-center justify-between text-[11px] ${tk.textMuted}`}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span>Phím tắt:</span>
          {[
            ['j', 'Câu tiếp'],
            ['k', 'Câu trước'],
            ['←/→', 'Chương'],
            ['e', 'Giải thích'],
            ['p', 'Luyện viết'],
            ['d', 'Tối/Sáng'],
            ['Esc', 'Bỏ chọn'],
          ].map(([key, label]) => (
            <span key={key}>
              <kbd
                className={`px-1 py-0.5 rounded font-mono text-[10px] border ${
                  darkMode ? 'bg-[#2C2A27] border-[#3A3735]' : 'bg-white border-stone-border'
                }`}
              >
                {key}
              </kbd>{' '}
              {label}
            </span>
          ))}
        </div>
        <span>{displayedSentences.length} câu</span>
      </div>
    </div>

    {/* ── Right Grammar Analysis Panel ── */}
    {analysisOpen && (
      <div className="w-80 md:w-96 shrink-0 h-full ml-3">
        <GrammarAnalysisPanel
          sentence={analysisSentence || activeSentence || null}
          darkMode={darkMode}
          onClose={() => setAnalysisOpen(false)}
          onViewRule={(ruleId) => {
            if (onViewGrammarRule) {
              onViewGrammarRule(ruleId)
            }
          }}
        />
      </div>
    )}

    {/* ── Double-click Word Lookup Popup ── */}
    <WordLookupPopup
      isOpen={isLookupOpen}
      word={lookupWord}
      contextSentence={lookupContextSentence}
      documentId={document.id}
      position={lookupPos}
      darkMode={darkMode}
      onClose={() => setIsLookupOpen(false)}
      onStatusChanged={(lemma, newStatus) => {
        setVocabStatusMap((prev) => ({ ...prev, [lemma]: newStatus }))
      }}
    />
  </div>
  )
}
