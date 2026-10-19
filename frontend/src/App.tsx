import React, { useState, useEffect } from 'react'
import { Header } from './components/common/Header'
import { DocumentList } from './components/reader/DocumentList'
import { ReaderView } from './components/reader/ReaderView'
import { DocumentUploadModal } from './components/reader/DocumentUploadModal'
import { api } from './services/api'
import type { Document, DocumentSentence } from './types'

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'reader' | 'catalog' | 'stats'>('reader')
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [sentences, setSentences] = useState<DocumentSentence[]>([])
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number | null>(null)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load documents on mount
  useEffect(() => {
    loadDocuments()
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

  const handleExplainSentence = (sentence: DocumentSentence) => {
    // Will link to Task 6 Grammar Panel
    console.log('Explain sentence:', sentence)
  }

  const handlePracticeRule = (ruleId: string, contextSentence?: string) => {
    // Will link to Task 6 Practice Panel
    console.log('Practice rule:', ruleId, contextSentence)
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

        {/* View 2: Grammar Catalog Placeholder (to be filled in Task 6) */}
        {currentTab === 'catalog' && (
          <div className="p-8 text-center text-xs text-ink-500 bg-white border border-stone-border rounded-lg max-w-md mx-auto">
            <h3 className="font-serif font-bold text-sm text-ink-900 mb-1">
              Chủ điểm ngữ pháp (Grammar Catalog)
            </h3>
            <p>Module sẽ được hoàn thiện trong Task 6.</p>
          </div>
        )}

        {/* View 3: Stats Placeholder (to be filled in Task 7) */}
        {currentTab === 'stats' && (
          <div className="p-8 text-center text-xs text-ink-500 bg-white border border-stone-border rounded-lg max-w-md mx-auto">
            <h3 className="font-serif font-bold text-sm text-ink-900 mb-1">
              Tiến độ & Sổ tay ngữ pháp
            </h3>
            <p>Module sổ tay học tập sẽ được hoàn thiện trong Task 7.</p>
          </div>
        )}
      </main>

      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  )
}

export default App
