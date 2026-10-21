import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { VocabularyView } from '../components/vocabulary/VocabularyView'
import { WordLookupPopup } from '../components/reader/WordLookupPopup'
import type { VocabularyItem } from '../types'

vi.mock('../services/api', () => ({
  api: {
    listDocuments: vi.fn().mockResolvedValue([
      { id: 1, title: 'Le Petit Prince', filename: 'prince.epub', file_type: 'epub', total_words: 500, total_sentences: 10 },
    ]),
    listVocabulary: vi.fn().mockResolvedValue([
      {
        id: 1,
        lemma: 'visiter',
        surface_form: 'visiter',
        pos: 'VERB',
        definition: 'Aller voir quelqu’un ou un lieu.',
        definition_vi: 'Thăm, viếng thăm một nơi hoặc ai đó.',
        status: 'learning',
        occurrences: 5,
        context_sentence: 'Je vais visiter mon ami.',
        created_at: '2026-10-20T10:00:00',
      },
      {
        id: 2,
        lemma: 'pomme',
        surface_form: 'pommes',
        pos: 'NOUN',
        definition: 'Fruit du pommier.',
        definition_vi: 'Quả táo.',
        status: 'new',
        occurrences: 1,
        context_sentence: 'Il mange des pommes.',
        created_at: '2026-10-20T11:00:00',
      },
    ] as VocabularyItem[]),
    updateVocabularyStatus: vi.fn().mockResolvedValue({
      id: 1,
      lemma: 'visiter',
      status: 'known',
    }),
    updateStatusByLemma: vi.fn().mockResolvedValue({
      id: 1,
      lemma: 'visiter',
      status: 'known',
    }),
    lookupWord: vi.fn().mockResolvedValue({
      lemma: 'visiter',
      pos: 'VERB',
      surface_form: 'visite',
      definition: 'Aller voir un lieu ou une personne.',
      definition_vi: 'Đi thăm, ghé thăm ai đó.',
      status: 'learning',
      occurrences: 3,
      context_sentence: 'Je visite Paris.',
    }),
    getExportCsvUrl: vi.fn().mockReturnValue('http://localhost:8000/vocabulary/export/csv'),
  },
}))

describe('VocabularyView component', () => {
  it('renders vocabulary items and allows filtering', async () => {
    render(<VocabularyView />)

    expect(screen.getByText('Bảng từ vựng (Vocabulary Bank)')).toBeInTheDocument()

    // Wait for items to load
    await waitFor(() => {
      expect(screen.getByText('visiter')).toBeInTheDocument()
      expect(screen.getByText('pomme')).toBeInTheDocument()
    })

    // Status badges exist
    expect(screen.getAllByText(/Đang học/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Mới/).length).toBeGreaterThan(0)
  })

  it('renders export CSV button with correct link', () => {
    render(<VocabularyView />)
    const exportLink = screen.getByText('Xuất file CSV').closest('a')
    expect(exportLink).toHaveAttribute('href', 'http://localhost:8000/vocabulary/export/csv')
  })
})

describe('WordLookupPopup component', () => {
  it('displays word details and allows status update', async () => {
    const handleStatusChanged = vi.fn()
    const handleClose = vi.fn()

    render(
      <WordLookupPopup
        isOpen={true}
        word="visite"
        contextSentence="Je visite Paris."
        documentId={1}
        position={{ x: 100, y: 150 }}
        onClose={handleClose}
        onStatusChanged={handleStatusChanged}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('visiter')).toBeInTheDocument()
      expect(screen.getByText('Đi thăm, ghé thăm ai đó.')).toBeInTheDocument()
    })

    // Click on "Đã biết (3)"
    const knownBtn = screen.getByText(/Đã biết/)
    fireEvent.click(knownBtn)

    await waitFor(() => {
      expect(handleStatusChanged).toHaveBeenCalledWith('visiter', 'known')
    })
  })
})
