import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DocumentList } from '../components/reader/DocumentList'
import { ReaderView } from '../components/reader/ReaderView'
import { Header } from '../components/common/Header'
import type { Document, DocumentSentence } from '../types'

// Mock api.getDocumentSections so ReaderView doesn't need a network call
vi.mock('../services/api', () => ({
  api: {
    getDocumentSections: vi.fn().mockResolvedValue([
      { id: 1, document_id: 1, section_index: 1, title: 'Chapitre I', total_words: 50, total_sentences: 3 },
      { id: 2, document_id: 1, section_index: 2, title: 'Chapitre II', total_words: 40, total_sentences: 2 },
    ]),
    getSentenceAnalysis: vi.fn().mockResolvedValue({
      text: 'Mock sentence',
      tokens: [],
      matches: [],
      matched_rule_ids: [],
    }),
    analyzeSentence: vi.fn().mockResolvedValue({
      text: 'Mock sentence',
      tokens: [],
      matches: [],
      matched_rule_ids: [],
    }),
    getVocabularyStatusMap: vi.fn().mockResolvedValue({}),
  },
}))

const mockDoc: Document = {
  id: 1,
  title: 'Le Petit Prince',
  filename: 'prince.epub',
  file_type: 'epub',
  total_words: 500,
  total_sentences: 10,
}

const mockSentences: DocumentSentence[] = [
  {
    id: 101,
    chapter_index: 1,
    chapter_title: 'Chapitre 1',
    sentence_index: 0,
    text: 'Je vais visiter mon vieil ami.',
    matched_rules: 'futur_proche',
    section_index: 1,
    order_index: 0,
  },
  {
    id: 102,
    chapter_index: 1,
    chapter_title: 'Chapitre 1',
    sentence_index: 1,
    text: 'Hier, il a terminé son travail.',
    matched_rules: 'passe_compose',
    section_index: 1,
    order_index: 1,
  },
  {
    id: 103,
    chapter_index: 2,
    chapter_title: 'Chapitre 2',
    sentence_index: 2,
    text: "C'est une belle journée.",
    section_index: 2,
    order_index: 0,
  },
]

describe('DocumentList component', () => {
  it('renders empty state when no documents are available', () => {
    const handleOpenUpload = vi.fn()
    render(
      <DocumentList
        documents={[]}
        selectedDocId={null}
        onSelectDocument={vi.fn()}
        onDeleteDocument={vi.fn()}
        onOpenUpload={handleOpenUpload}
      />,
    )
    expect(screen.getByText('Tủ sách trống')).toBeInTheDocument()
    const uploadBtn = screen.getByText('Tải lên tài liệu đầu tiên')
    fireEvent.click(uploadBtn)
    expect(handleOpenUpload).toHaveBeenCalledTimes(1)
  })

  it('renders list of documents and handles selection', () => {
    const handleSelect = vi.fn()
    render(
      <DocumentList
        documents={[mockDoc]}
        selectedDocId={null}
        onSelectDocument={handleSelect}
        onDeleteDocument={vi.fn()}
        onOpenUpload={vi.fn()}
      />,
    )
    expect(screen.getByText('Le Petit Prince')).toBeInTheDocument()
    expect(screen.getByText('epub')).toBeInTheDocument()
    expect(screen.getByText('10 câu')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Le Petit Prince'))
    expect(handleSelect).toHaveBeenCalledWith(mockDoc)
  })

  it('shows upload button in header row when documents exist', () => {
    const handleOpenUpload = vi.fn()
    render(
      <DocumentList
        documents={[mockDoc]}
        selectedDocId={null}
        onSelectDocument={vi.fn()}
        onDeleteDocument={vi.fn()}
        onOpenUpload={handleOpenUpload}
      />,
    )
    const addBtn = screen.getByText('Thêm tài liệu')
    fireEvent.click(addBtn)
    expect(handleOpenUpload).toHaveBeenCalled()
  })
})

describe('ReaderView component', () => {
  it('renders all sentences and handles click selection', () => {
    const handleSelectSentence = vi.fn()
    render(
      <ReaderView
        document={mockDoc}
        sentences={mockSentences}
        activeSentenceIndex={null}
        onSelectSentence={handleSelectSentence}
        onExplainSentence={vi.fn()}
        onPracticeRule={vi.fn()}
        onBackToList={vi.fn()}
      />,
    )

    expect(screen.getByText('Le Petit Prince')).toBeInTheDocument()
    const sentenceEl = screen.getByText((_, el) => el?.tagName === 'SPAN' && el.getAttribute('data-sentence-index') === '0')
    expect(sentenceEl).toBeInTheDocument()

    fireEvent.click(sentenceEl)
    expect(handleSelectSentence).toHaveBeenCalledWith(0)
  })

  it('displays bottom action bar when a sentence with grammar is selected', () => {
    const handleExplain = vi.fn()
    const handlePractice = vi.fn()

    render(
      <ReaderView
        document={mockDoc}
        sentences={mockSentences}
        activeSentenceIndex={0}
        onSelectSentence={vi.fn()}
        onExplainSentence={handleExplain}
        onPracticeRule={handlePractice}
        onBackToList={vi.fn()}
      />,
    )

    expect(screen.getByText('Câu đã chọn:')).toBeInTheDocument()
    expect(screen.getByText('futur_proche')).toBeInTheDocument()

    // Test explain button
    fireEvent.click(screen.getByRole('button', { name: /Giải thích/i }))
    expect(handleExplain).toHaveBeenCalledWith(mockSentences[0])

    // Test practice button
    fireEvent.click(screen.getByRole('button', { name: /Luyện viết/i }))
    expect(handlePractice).toHaveBeenCalledWith('futur_proche', mockSentences[0].text)
  })

  it('responds to keyboard navigation keys j and k', () => {
    const handleSelectSentence = vi.fn()

    render(
      <ReaderView
        document={mockDoc}
        sentences={mockSentences}
        activeSentenceIndex={0}
        onSelectSentence={handleSelectSentence}
        onExplainSentence={vi.fn()}
        onPracticeRule={vi.fn()}
        onBackToList={vi.fn()}
      />,
    )

    // Press 'j' -> moves to next sentence (index 1)
    fireEvent.keyDown(window, { key: 'j' })
    expect(handleSelectSentence).toHaveBeenCalledWith(1)

    // Press 'k' -> moves to prev sentence
    fireEvent.keyDown(window, { key: 'k' })
    expect(handleSelectSentence).toHaveBeenCalled()
  })

  it('toggles dark mode with "d" key', () => {
    render(
      <ReaderView
        document={mockDoc}
        sentences={mockSentences}
        activeSentenceIndex={null}
        onSelectSentence={vi.fn()}
        onExplainSentence={vi.fn()}
        onPracticeRule={vi.fn()}
        onBackToList={vi.fn()}
      />,
    )

    // Initially not dark
    expect(window.document.body.classList.contains('dark')).toBe(false)
    fireEvent.keyDown(window, { key: 'd' })
    expect(window.document.body.classList.contains('dark')).toBe(true)
    // Toggle back
    fireEvent.keyDown(window, { key: 'd' })
    expect(window.document.body.classList.contains('dark')).toBe(false)
  })

  it('shows dark mode toggle button in control bar', () => {
    render(
      <ReaderView
        document={mockDoc}
        sentences={mockSentences}
        activeSentenceIndex={null}
        onSelectSentence={vi.fn()}
        onExplainSentence={vi.fn()}
        onPracticeRule={vi.fn()}
        onBackToList={vi.fn()}
      />,
    )
    // Moon icon button should exist (light mode by default)
    const darkToggle = screen.getByTitle('Chế độ tối (D)')
    expect(darkToggle).toBeInTheDocument()
    fireEvent.click(darkToggle)
    // Now in dark mode, sun icon shown
    expect(screen.getByTitle('Chế độ sáng (D)')).toBeInTheDocument()
  })

  it('navigates chapters with ArrowLeft / ArrowRight keys', () => {
    const handleSelectSentence = vi.fn()

    render(
      <ReaderView
        document={mockDoc}
        sentences={mockSentences}
        activeSentenceIndex={null}
        onSelectSentence={handleSelectSentence}
        onExplainSentence={vi.fn()}
        onPracticeRule={vi.fn()}
        onBackToList={vi.fn()}
      />,
    )

    // Initially 'all' selected; ArrowRight -> chapter 1
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    // Should filter to chapter 1 only – check only ch1 sentences visible
    const ch1Sentence = screen.getByText((_, el) => el?.tagName === 'SPAN' && el.getAttribute('data-sentence-index') === '0')
    expect(ch1Sentence).toBeInTheDocument()
    // Ch2 sentence should NOT be in document (filtered out)
    const ch2Sentence = screen.queryByText((_, el) => el?.tagName === 'SPAN' && el.getAttribute('data-sentence-index') === '2')
    expect(ch2Sentence).not.toBeInTheDocument()
  })
})

describe('Header component', () => {
  it('switches tabs properly', () => {
    const handleSelectTab = vi.fn()
    render(
      <Header
        currentTab="reader"
        onSelectTab={handleSelectTab}
        onOpenUpload={vi.fn()}
        hasDocument={true}
      />,
    )

    fireEvent.click(screen.getByText('Chủ điểm ngữ pháp'))
    expect(handleSelectTab).toHaveBeenCalledWith('catalog')

    fireEvent.click(screen.getByText('Tiến độ & Sổ tay'))
    expect(handleSelectTab).toHaveBeenCalledWith('stats')
  })
})
