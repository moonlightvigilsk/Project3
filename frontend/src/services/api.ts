import type {
  Document,
  DocumentSentence,
  GrammarRuleMetadata,
  MinedExample,
  GrammarEvaluationResult,
  GrammarExplanationResult,
  PracticeHistoryItem,
  PracticeStats,
} from '../types'

const BASE_URL = '/api'

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, options)
  if (!res.ok) {
    let errorMsg = `API Error: ${res.statusText}`
    try {
      const errJson = await res.json()
      if (errJson.detail) errorMsg = errJson.detail
    } catch {
      // ignore
    }
    throw new Error(errorMsg)
  }
  return res.json() as Promise<T>
}

export const api = {
  // Documents
  async listDocuments(): Promise<Document[]> {
    return request<Document[]>('/documents')
  },

  async getDocument(id: number): Promise<Document> {
    return request<Document>(`/documents/${id}`)
  },

  async getDocumentSentences(
    id: number,
    chapterIndex?: number,
    skip = 0,
    limit = 100
  ): Promise<DocumentSentence[]> {
    const params = new URLSearchParams({
      skip: String(skip),
      limit: String(limit),
    })
    if (chapterIndex !== undefined) {
      params.append('chapter_index', String(chapterIndex))
    }
    return request<DocumentSentence[]>(`/documents/${id}/sentences?${params.toString()}`)
  },

  async mineExamples(
    documentId: number,
    ruleId: string,
    limit = 30
  ): Promise<{ document_id: number; document_title: string; rule_id: string; total_mined: number; examples: MinedExample[] }> {
    return request(`/documents/${documentId}/mine/${ruleId}?limit=${limit}`)
  },

  async uploadDocument(file: File, title?: string): Promise<Document> {
    const formData = new FormData()
    formData.append('file', file)
    if (title) formData.append('title', title)

    return request<Document>('/documents/upload', {
      method: 'POST',
      body: formData,
    })
  },

  async deleteDocument(id: number): Promise<{ status: string; message: string }> {
    return request(`/documents/${id}`, { method: 'DELETE' })
  },

  // Grammar Catalog
  async listGrammarRules(): Promise<GrammarRuleMetadata[]> {
    return request<GrammarRuleMetadata[]>('/grammar/rules')
  },

  async getGrammarRule(ruleId: string): Promise<GrammarRuleMetadata> {
    return request<GrammarRuleMetadata>(`/grammar/rules/${ruleId}`)
  },

  async analyzeSentence(sentence: string): Promise<any> {
    return request('/grammar/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentence }),
    })
  },

  // Practice & Evaluation
  async evaluateSentence(payload: {
    user_sentence: string
    target_rule_id: string
    target_rule_name: string
    target_rule_formula?: string
    learner_native_lang?: string
    document_id?: number
    document_sentence_id?: number
  }): Promise<GrammarEvaluationResult> {
    return request<GrammarEvaluationResult>('/practice/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        learner_native_lang: payload.learner_native_lang || 'vi',
      }),
    })
  },

  async explainGrammar(payload: {
    rule_id: string
    rule_name: string
    context_sentence?: string
    learner_native_lang?: string
  }): Promise<GrammarExplanationResult> {
    return request<GrammarExplanationResult>('/practice/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        learner_native_lang: payload.learner_native_lang || 'vi',
      }),
    })
  },

  async getPracticeHistory(ruleId?: string, documentId?: number): Promise<PracticeHistoryItem[]> {
    const params = new URLSearchParams()
    if (ruleId) params.append('rule_id', ruleId)
    if (documentId !== undefined) params.append('document_id', String(documentId))
    const query = params.toString() ? `?${params.toString()}` : ''
    return request<PracticeHistoryItem[]>(`/practice/history${query}`)
  },

  async getPracticeStats(): Promise<PracticeStats> {
    return request<PracticeStats>('/practice/stats')
  },
}
