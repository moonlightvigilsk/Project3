import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DiacriticBar } from '../components/practice/DiacriticBar'
import { DiffViewer } from '../components/practice/DiffViewer'
import { PracticeModal } from '../components/practice/PracticeModal'
import { GrammarCatalogView } from '../components/grammar/GrammarCatalogView'
import { api } from '../services/api'
import type { DiffToken, GrammarRuleMetadata, GrammarEvaluationResult } from '../types'

vi.mock('../services/api', () => ({
  api: {
    evaluateSentence: vi.fn(),
    listGrammarRules: vi.fn(),
    getGrammarRule: vi.fn(),
    mineExamples: vi.fn(),
  },
}))

describe('Task 6 - Grammar Exploration & Active Production', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('DiacriticBar component', () => {
    it('renders French diacritic buttons', () => {
      const handleInsert = vi.fn()
      render(<DiacriticBar onInsert={handleInsert} />)

      expect(screen.getByText('é')).toBeInTheDocument()
      expect(screen.getByText('è')).toBeInTheDocument()
      expect(screen.getByText('ç')).toBeInTheDocument()
      expect(screen.getByText('œ')).toBeInTheDocument()
    })

    it('triggers onInsert when a diacritic is clicked', () => {
      const handleInsert = vi.fn()
      render(<DiacriticBar onInsert={handleInsert} />)

      fireEvent.click(screen.getByText('ç'))
      expect(handleInsert).toHaveBeenCalledWith('ç')
    })
  })

  describe('DiffViewer component', () => {
    it('renders different token types (same, removed, added, replaced)', () => {
      const tokens: DiffToken[] = [
        { type: 'same', text: 'Je' },
        { type: 'replaced', original: 'vais', replacement: 'vais' },
        { type: 'removed', text: 'mange' },
        { type: 'added', text: 'manger' },
      ]

      render(<DiffViewer tokens={tokens} />)

      expect(screen.getByText('Je')).toBeInTheDocument()
      expect(screen.getByTestId('diff-removed')).toHaveTextContent('mange')
      expect(screen.getByTestId('diff-added')).toHaveTextContent('manger')
      expect(screen.getByTestId('diff-replaced')).toBeInTheDocument()
    })
  })

  describe('PracticeModal component', () => {
    const mockEvaluation: GrammarEvaluationResult = {
      is_correct: true,
      target_pattern_matched: true,
      score: 10,
      status: 'correct',
      corrected_sentence: 'Je vais partir demain.',
      positive_feedback: 'Rất tốt! Cấu trúc câu chuẩn xác.',
      error_explanation: 'Không có lỗi.',
      suggested_alternatives: ['Je compte partir demain.'],
      diff_tokens: [
        { type: 'same', text: 'Je' },
        { type: 'same', text: 'vais' },
        { type: 'same', text: 'partir' },
        { type: 'same', text: 'demain.' },
      ],
      spacy_tokens: [],
    }

    it('renders rule metadata and handles sentence evaluation', async () => {
      vi.mocked(api.evaluateSentence).mockResolvedValueOnce(mockEvaluation)

      render(
        <PracticeModal
          isOpen={true}
          onClose={vi.fn()}
          ruleId="futur_proche"
          ruleName="Futur proche"
          ruleFormula="aller + infinitif"
          modelSentence="Je vais lire un livre."
        />
      )

      expect(screen.getByText('Futur proche')).toBeInTheDocument()
      expect(screen.getByText('aller + infinitif')).toBeInTheDocument()
      expect(screen.getByText(/Je vais lire un livre/)).toBeInTheDocument()

      const textarea = screen.getByPlaceholderText(/Gõ câu của bạn ở đây/)
      fireEvent.change(textarea, { target: { value: 'Je vais partir demain.' } })

      const submitBtn = screen.getByRole('button', { name: /Chấm bài/ })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(api.evaluateSentence).toHaveBeenCalledWith({
          user_sentence: 'Je vais partir demain.',
          target_rule_id: 'futur_proche',
          target_rule_name: 'Futur proche',
          target_rule_formula: 'aller + infinitif',
          learner_native_lang: 'vi',
          document_id: undefined,
          document_sentence_id: undefined,
        })
      })

      // Check feedback is rendered
      await waitFor(() => {
        expect(screen.getByText(/Chính xác hoàn toàn!/)).toBeInTheDocument()
        expect(screen.getByText(/Rất tốt! Cấu trúc câu chuẩn xác/)).toBeInTheDocument()
      })
    })

    it('submits on Ctrl+Enter keypress', async () => {
      vi.mocked(api.evaluateSentence).mockResolvedValueOnce(mockEvaluation)

      render(
        <PracticeModal
          isOpen={true}
          onClose={vi.fn()}
          ruleId="futur_proche"
          ruleName="Futur proche"
        />
      )

      const textarea = screen.getByPlaceholderText(/Gõ câu của bạn ở đây/)
      fireEvent.change(textarea, { target: { value: 'Je vais voyager.' } })
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })

      await waitFor(() => {
        expect(api.evaluateSentence).toHaveBeenCalled()
      })
    })
  })

  describe('GrammarCatalogView component', () => {
    const mockRules: GrammarRuleMetadata[] = [
      {
        id: 'futur_proche',
        name: 'Futur proche',
        category: 'Temps du verbe',
        level: 'A1-A2',
        formula: 'aller + infinitif',
        description: 'Exprime une action imminente.',
        key_points: ['aller se conjugue'],
        conjugation_table: {},
        examples: ['Je vais manger.'],
        keywords: ['futur', 'aller'],
      },
      {
        id: 'subjonctif_present',
        name: 'Subjonctif présent',
        category: 'Modes et temps',
        level: 'B1-B2',
        formula: 'que + sujet + verbe au subjonctif',
        description: 'Exprime le doute ou la volonté.',
        key_points: ['que obligatoire'],
        conjugation_table: {},
        examples: ['Il faut que tu viennes.'],
        keywords: ['subjonctif', 'doute'],
      },
    ]

    it('renders rule cards and filters by level', async () => {
      vi.mocked(api.listGrammarRules).mockResolvedValueOnce(mockRules)

      const handleSelectRule = vi.fn()
      const handlePractice = vi.fn()

      render(
        <GrammarCatalogView
          onSelectRule={handleSelectRule}
          onPracticeRule={handlePractice}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Futur proche')).toBeInTheDocument()
        expect(screen.getByText('Subjonctif présent')).toBeInTheDocument()
      })

      // Filter by level B1-B2
      const b1b2Btn = screen.getByRole('button', { name: 'B1-B2' })
      fireEvent.click(b1b2Btn)

      expect(screen.queryByText('Futur proche')).not.toBeInTheDocument()
      expect(screen.getByText('Subjonctif présent')).toBeInTheDocument()
    })

    it('filters rules by search query', async () => {
      vi.mocked(api.listGrammarRules).mockResolvedValueOnce(mockRules)

      render(
        <GrammarCatalogView
          onSelectRule={vi.fn()}
          onPracticeRule={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Futur proche')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/Tìm theo tên/)
      fireEvent.change(searchInput, { target: { value: 'subjonctif' } })

      expect(screen.queryByText('Futur proche')).not.toBeInTheDocument()
      expect(screen.getByText('Subjonctif présent')).toBeInTheDocument()
    })
  })
})
