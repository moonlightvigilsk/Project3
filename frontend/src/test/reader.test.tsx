import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DocumentList } from '../components/reader/DocumentList'
import { ReaderView } from '../components/reader/ReaderView'
import { Header } from '../components/common/Header'
import type { Document, DocumentSentence } from '../types'

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
  },
  {
    id: 102,
    chapter_index: 1,
    chapter_title: 'Chapitre 1',
    sentence_index: 1,
    text: 'Hier, il a terminé son travail.',
    matched_rules: 'passe_compose',
  },
  {
    id: 103,
    chapter_index: 1,
    chapter_title: 'Chapitre 1',
    sentence_index: 2,
    text: 'C\'est une belle journée.',
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
      />
    )
    expect(screen.getByText('Chưa có tài liệu nào')).toBeInTheDocument()
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
      />
    )
    expect(screen.getByText('Le Petit Prince')).toBeInTheDocument()
    expect(screen.getByText('epub')).toBeInTheDocument()
    expect(screen.getByText('10 câu')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Le Petit Prince'))
    expect(handleSelect).toHaveBeenCalledWith(mockDoc)
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
      />
    )

    expect(screen.getByText('Le Petit Prince')).toBeInTheDocument()
    expect(screen.getByText(/Je vais visiter mon vieil ami/)).toBeInTheDocument()

    // Click sentence
    fireEvent.click(screen.getByText(/Je vais visiter mon vieil ami/))
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
      />
    )

    expect(screen.getByText('Câu đã chọn:')).toBeInTheDocument()
    expect(screen.getByText('futur_proche')).toBeInTheDocument()

    // Test explain button click
    const explainBtn = screen.getByText(/Giải thích cú pháp/i)
    fireEvent.click(explainBtn)
    expect(handleExplain).toHaveBeenCalledWith(mockSentences[0])

    // Test practice button click
    const practiceBtn = screen.getByText(/Luyện cấu trúc này/i)
    fireEvent.click(practiceBtn)
    expect(handlePractice).toHaveBeenCalledWith('futur_proche', mockSentences[0].text)
  })

  it('responds to keyboard navigation keys (j, k)', () => {
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
      />
    )

    // Press 'j' -> moves to next sentence (index 1)
    fireEvent.keyDown(window, { key: 'j' })
    expect(handleSelectSentence).toHaveBeenCalledWith(1)

    // Press 'k' -> moves to previous sentence
    fireEvent.keyDown(window, { key: 'k' })
    expect(handleSelectSentence).toHaveBeenCalled()
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
      />
    )

    fireEvent.click(screen.getByText('Chủ điểm ngữ pháp'))
    expect(handleSelectTab).toHaveBeenCalledWith('catalog')

    fireEvent.click(screen.getByText('Tiến độ & Sổ tay'))
    expect(handleSelectTab).toHaveBeenCalledWith('stats')
  })
})
