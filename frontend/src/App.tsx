import React, { useState, useEffect } from 'react'
import { Header } from './components/common/Header'
import { DocumentList } from './components/reader/DocumentList'
import { ReaderView } from './components/reader/ReaderView'
import { DocumentUploadModal } from './components/reader/DocumentUploadModal'
import { GrammarCatalogView } from './components/grammar/GrammarCatalogView'
import { GrammarDetailModal } from './components/grammar/GrammarDetailModal'
import { PracticeModal } from './components/practice/PracticeModal'
import { NotebookView } from './components/stats/NotebookView'
import { api } from './services/api'
import type { Document, DocumentSentence, GrammarRuleMetadata } from './types'

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'reader' | 'catalog' | 'stats'>('reader')
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [sentences, setSentences] = useState<DocumentSentence[]>([])
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number | null>(null)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Grammar and Practice modals state
  const [selectedRuleDetail, setSelectedRuleDetail] = useState<GrammarRuleMetadata | null>(null)
  const [practiceConfig, setPracticeConfig] = useState<{
    ruleId: string
    ruleName: string
    ruleFormula?: string
    modelSentence?: string
    documentId?: number
    documentSentenceId?: number
  } | null>(null)

  // Cache of grammar rules for fast metadata lookup
  const [grammarRules, setGrammarRules] = useState<Record<string, GrammarRuleMetadata>>({})

  // Load documents and grammar catalog on mount
  useEffect(() => {
    loadDocuments()
    loadGrammarRules()
  }, [])

  const loadDocuments = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const docs = await api.listDocuments()
      setDocuments(docs)
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách tài liệu.')
    } finally {
      setIsLoading(false)
    }
  }

  const loadGrammarRules = async () => {
    try {
      const rules = await api.listGrammarRules()
      const ruleMap: Record<string, GrammarRuleMetadata> = {}
      rules.forEach((r) => {
        ruleMap[r.id] = r
      })
      setGrammarRules(ruleMap)
    } catch {
      // Non-blocking, fallback will fetch on demand
    }
  }

  // Load sentences when a document is selected
  const handleSelectDocument = async (doc: Document) => {
    try {
      setIsLoading(true)
      setSelectedDoc(doc)
      setActiveSentenceIndex(null)
      const sents = await api.getDocumentSentences(doc.id, undefined, 0, 500)
      setSentences(sents)
      setCurrentTab('reader')
    } catch (err: any) {
      setError(err.message || 'Không thể tải nội dung tài liệu.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteDocument = async (docId: number) => {
    try {
      await api.deleteDocument(docId)
      if (selectedDoc?.id === docId) {
        setSelectedDoc(null)
        setSentences([])
      }
      await loadDocuments()
    } catch (err: any) {
      alert(`Lỗi khi xóa: ${err.message}`)
    }
  }

  const handleUploadSuccess = (newDoc: Document) => {
    setDocuments((prev) => [newDoc, ...prev])
    handleSelectDocument(newDoc)
  }

  // Triggered when user requests grammar explanation for a sentence
  const handleExplainSentence = async (sentence: DocumentSentence) => {
    let targetRuleId = 'futur_proche'
    if (sentence.matched_rules) {
      const rules = sentence.matched_rules
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean)
      if (rules.length > 0) {
        targetRuleId = rules[0]
      }
    }

    try {
      let ruleMeta = grammarRules[targetRuleId]
      if (!ruleMeta) {
        ruleMeta = await api.getGrammarRule(targetRuleId)
      }
      setSelectedRuleDetail(ruleMeta)
    } catch {
      // If rule not found, fallback to first catalog rule
      const firstRule = Object.values(grammarRules)[0]
      if (firstRule) setSelectedRuleDetail(firstRule)
    }
  }

  // Triggered when user wants to practice a rule
  const handlePracticeRule = async (ruleId: string, contextSentence?: string) => {
    try {
      let ruleMeta = grammarRules[ruleId]
      if (!ruleMeta) {
        ruleMeta = await api.getGrammarRule(ruleId)
      }

      setPracticeConfig({
        ruleId,
        ruleName: ruleMeta.name,
        ruleFormula: ruleMeta.formula,
        modelSentence: contextSentence,
        documentId: selectedDoc?.id,
      })
    } catch (err: any) {
      alert(`Không thể tải thông tin cấu trúc: ${err.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-parchment-100 flex flex-col font-sans text-ink-900">
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenUpload={() => setIsUploadOpen(true)}
        hasDocument={selectedDoc !== null}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 flex flex-col">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
            {error}
          </div>
        )}

        {isLoading && !selectedDoc && (
          <div className="text-center py-20 text-xs text-ink-500 font-mono">
            Đang tải dữ liệu...
          </div>
        )}

        {/* View 1: Reader */}
        {currentTab === 'reader' && (
          <div className="flex-1 flex flex-col">
            {selectedDoc ? (
              <ReaderView
                document={selectedDoc}
                sentences={sentences}
                activeSentenceIndex={activeSentenceIndex}
                onSelectSentence={(idx) => setActiveSentenceIndex(idx)}
                onExplainSentence={handleExplainSentence}
                onPracticeRule={handlePracticeRule}
                onBackToList={() => {
                  setSelectedDoc(null)
                  setSentences([])
                }}
              />
            ) : (
              <DocumentList
                documents={documents}
                selectedDocId={null}
                onSelectDocument={handleSelectDocument}
                onDeleteDocument={handleDeleteDocument}
                onOpenUpload={() => setIsUploadOpen(true)}
              />
            )}
          </div>
        )}

        {/* View 2: Grammar Catalog */}
        {currentTab === 'catalog' && (
          <GrammarCatalogView
            onSelectRule={(rule) => setSelectedRuleDetail(rule)}
            onPracticeRule={(ruleId) => handlePracticeRule(ruleId)}
          />
        )}

        {/* View 3: Stats & Notebook */}
        {currentTab === 'stats' && (
          <NotebookView onPracticeRule={(ruleId) => handlePracticeRule(ruleId)} />
        )}
      </main>

      {/* Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleUploadSuccess}
      />

      {/* Explicit Grammar Rule Detail Modal */}
      <GrammarDetailModal
        rule={selectedRuleDetail}
        isOpen={selectedRuleDetail !== null}
        onClose={() => setSelectedRuleDetail(null)}
        currentDocument={selectedDoc}
        onPractice={(ruleId, modelSentence) => handlePracticeRule(ruleId, modelSentence)}
      />

      {/* Active Production Practice Modal */}
      {practiceConfig && (
        <PracticeModal
          isOpen={practiceConfig !== null}
          onClose={() => setPracticeConfig(null)}
          ruleId={practiceConfig.ruleId}
          ruleName={practiceConfig.ruleName}
          ruleFormula={practiceConfig.ruleFormula}
          modelSentence={practiceConfig.modelSentence}
          documentId={practiceConfig.documentId}
          documentSentenceId={practiceConfig.documentSentenceId}
        />
      )}
    </div>
  )
}

export default App
