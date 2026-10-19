import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotebookView } from '../components/stats/NotebookView'
import { api } from '../services/api'
import type { PracticeStats, PracticeHistoryItem, GrammarRuleMetadata } from '../types'

vi.mock('../services/api', () => ({
  api: {
    getPracticeStats: vi.fn(),
    getPracticeHistory: vi.fn(),
    listGrammarRules: vi.fn(),
  },
}))

describe('Task 7 - Notebook & Learning History View', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockStats: PracticeStats = {
    total_attempts: 12,
    correct_attempts: 9,
    accuracy_rate: 75.0,
    average_score: 8.5,
    rules_breakdown: {
      futur_proche: {
        attempts: 7,
        correct: 6,
        accuracy_rate: 85.7,
        average_score: 9.1,
      },
      passe_compose: {
        attempts: 5,
        correct: 3,
        accuracy_rate: 60.0,
        average_score: 7.6,
      },
    },
  }

  const mockRules: GrammarRuleMetadata[] = [
    {
      id: 'futur_proche',
      name: 'Futur proche (aller + infinitif)',
      category: 'Temps du verbe',
      level: 'A1-A2',
      formula: 'aller (présent) + infinitif',
      description: 'Action imminente.',
      key_points: [],
      conjugation_table: {},
      examples: [],
    },
    {
      id: 'passe_compose',
      name: 'Passé composé',
      category: 'Temps du verbe',
      level: 'A2',
      formula: 'avoir/être + participe',
      description: 'Action passée.',
      key_points: [],
      conjugation_table: {},
      examples: [],
    },
  ]

  const mockHistory: PracticeHistoryItem[] = [
    {
      id: 1,
      rule_id: 'futur_proche',
      user_sentence: 'Je vais visiter mon ami.',
      is_correct: true,
      target_pattern_matched: true,
      score: 10,
      corrected_sentence: 'Je vais visiter mon ami.',
      feedback: {
        error_explanation: 'Cấu trúc hoàn toàn chính xác.',
        positive_feedback: 'Tuyệt vời!',
        diff_tokens: [
          { type: 'same', text: 'Je' },
          { type: 'same', text: 'vais' },
          { type: 'same', text: 'visiter' },
          { type: 'same', text: 'mon' },
          { type: 'same', text: 'ami.' },
        ],
      },
      created_at: '2026-10-19T10:00:00Z',
    },
    {
      id: 2,
      rule_id: 'passe_compose',
      user_sentence: 'Hier, je mangé une pomme.',
      is_correct: false,
      target_pattern_matched: false,
      score: 4,
      corrected_sentence: "Hier, j'ai mangé une pomme.",
      feedback: {
        error_explanation: "Thiếu trợ động từ 'avoir'. Cần viết 'j'ai mangé'.",
        diff_tokens: [
          { type: 'same', text: 'Hier,' },
          { type: 'replaced', original: 'je', replacement: "j'ai" },
          { type: 'same', text: 'mangé' },
          { type: 'same', text: 'une' },
          { type: 'same', text: 'pomme.' },
        ],
      },
      created_at: '2026-10-19T11:00:00Z',
    },
  ]

  it('renders stats overview and mastery table correctly', async () => {
    vi.mocked(api.getPracticeStats).mockResolvedValueOnce(mockStats)
    vi.mocked(api.getPracticeHistory).mockResolvedValueOnce(mockHistory)
    vi.mocked(api.listGrammarRules).mockResolvedValueOnce(mockRules)

    const onPracticeRule = vi.fn()

    render(<NotebookView onPracticeRule={onPracticeRule} />)

    // Verify stats cards
    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument() // Total attempts
      expect(screen.getByText('75%')).toBeInTheDocument() // Accuracy
      expect(screen.getByText(/8.5/)).toBeInTheDocument() // Avg score
    })

    // Verify rule names in table using getAllByText
    expect(screen.getAllByText('Futur proche (aller + infinitif)')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Passé composé')[0]).toBeInTheDocument()

    // Verify history feed
    expect(screen.getByText(/Je vais visiter mon ami/)).toBeInTheDocument()
    expect(screen.getByText(/Hier, je mangé une pomme/)).toBeInTheDocument()
    expect(screen.getByText(/Thiếu trợ động từ 'avoir'/)).toBeInTheDocument()
  })

  it('triggers onPracticeRule when practice button is clicked in the table', async () => {
    vi.mocked(api.getPracticeStats).mockResolvedValueOnce(mockStats)
    vi.mocked(api.getPracticeHistory).mockResolvedValueOnce(mockHistory)
    vi.mocked(api.listGrammarRules).mockResolvedValueOnce(mockRules)

    const onPracticeRule = vi.fn()

    render(<NotebookView onPracticeRule={onPracticeRule} />)

    await waitFor(() => {
      expect(screen.getAllByText('Futur proche (aller + infinitif)')[0]).toBeInTheDocument()
    })

    const practiceButtons = screen.getAllByRole('button', { name: /Luyện tập/ })
    fireEvent.click(practiceButtons[0])

    expect(onPracticeRule).toHaveBeenCalledWith('futur_proche')
  })

  it('filters history by status (correct vs needs_work)', async () => {
    vi.mocked(api.getPracticeStats).mockResolvedValueOnce(mockStats)
    vi.mocked(api.getPracticeHistory).mockResolvedValueOnce(mockHistory)
    vi.mocked(api.listGrammarRules).mockResolvedValueOnce(mockRules)

    render(<NotebookView onPracticeRule={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/Je vais visiter mon ami/)).toBeInTheDocument()
      expect(screen.getByText(/Hier, je mangé une pomme/)).toBeInTheDocument()
    })

    // Filter to only needs work
    const selects = screen.getAllByRole('combobox')
    const statusSelect = selects[1] // Second select is status filter
    fireEvent.change(statusSelect, { target: { value: 'needs_work' } })

    expect(screen.queryByText(/Je vais visiter mon ami/)).not.toBeInTheDocument()
    expect(screen.getByText(/Hier, je mangé une pomme/)).toBeInTheDocument()
  })
})
