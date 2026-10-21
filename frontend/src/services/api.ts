import type {
  Document,
  DocumentSection,
  DocumentSentence,
  GrammarRuleMetadata,
  MinedExample,
  GrammarEvaluationResult,
  GrammarExplanationResult,
  PracticeHistoryItem,
  PracticeStats,
  SentenceAnalysis,
  PracticeSubmitResponse,
  WordLookupResponse,
  VocabularyItem,
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

  async getDocumentSections(id: number): Promise<DocumentSection[]> {
    return request<DocumentSection[]>(`/documents/${id}/sections`)
  },

  async getDocumentSentences(
    id: number,
    chapterIndex?: number,
    skip = 0,
    limit = 100,
    sectionId?: number,
  ): Promise<DocumentSentence[]> {
    const params = new URLSearchParams({
      skip: String(skip),
      limit: String(limit),
    })
    if (chapterIndex !== undefined) {
      params.append('chapter_index', String(chapterIndex))
    }
    if (sectionId !== undefined) {
      params.append('section_id', String(sectionId))
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

    // Try new POST /documents first (returns 201), fall back to /documents/upload
    return request<Document>('/documents', {
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
    return request<GrammarRuleMetadata>(`/grammar/${ruleId}`)
  },

  async getSentenceAnalysis(sentenceId: number): Promise<SentenceAnalysis> {
    return request<SentenceAnalysis>(`/sentences/${sentenceId}/analysis`)
  },

  async getDocumentOccurrences(
    documentId: number,
    construct: string,
  ): Promise<{
    document_id: number
    construct: string
    total: number
    occurrences: Array<{
      id: number
      sentence_id: number
      text: string
      matched_rules?: string
      matched_span?: string
      notes?: string
    }>
  }> {
    return request(`/documents/${documentId}/occurrences?construct=${encodeURIComponent(construct)}`)
  },

  async analyzeSentence(sentence: string): Promise<any> {
    return request('/grammar/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentence }),
    })
  },

  // Vocabulary
  async lookupWord(payload: {
    word: string
    context_sentence?: string
    document_id?: number
  }): Promise<WordLookupResponse> {
    return request<WordLookupResponse>('/vocabulary/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },

  async listVocabulary(params?: {
    status?: string
    document_id?: number
    search?: string
    limit?: number
  }): Promise<VocabularyItem[]> {
    const sp = new URLSearchParams()
    if (params?.status) sp.append('status', params.status)
    if (params?.document_id !== undefined) sp.append('document_id', String(params.document_id))
    if (params?.search) sp.append('search', params.search)
    if (params?.limit) sp.append('limit', String(params.limit))
    const query = sp.toString() ? `?${sp.toString()}` : ''
    return request<VocabularyItem[]>(`/vocabulary${query}`)
  },

  async updateVocabularyStatus(
    vocabId: number,
    status: 'new' | 'learning' | 'known',
  ): Promise<VocabularyItem> {
    return request<VocabularyItem>(`/vocabulary/${vocabId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  },

  async updateStatusByLemma(
    lemma: string,
    status: 'new' | 'learning' | 'known',
  ): Promise<VocabularyItem> {
    return request<VocabularyItem>(`/vocabulary/lemma/${encodeURIComponent(lemma)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  },

  async getVocabularyStatusMap(documentId?: number): Promise<Record<string, string>> {
    const q = documentId !== undefined ? `?document_id=${documentId}` : ''
    return request<Record<string, string>>(`/vocabulary/status-map${q}`)
  },

  getExportCsvUrl(status?: string, documentId?: number): string {
    const sp = new URLSearchParams()
    if (status) sp.append('status', status)
    if (documentId !== undefined) sp.append('document_id', String(documentId))
    const q = sp.toString() ? `?${sp.toString()}` : ''
    return `/api/vocabulary/export/csv${q}`
  },

  // Practice & Evaluation
  async submitPracticeSentence(payload: {
    user_sentence: string
    target_rule_id: string
    target_rule_name?: string
    document_id?: number
    document_sentence_id?: number
  }): Promise<PracticeSubmitResponse> {
    return request<PracticeSubmitResponse>('/practice/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  },

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
