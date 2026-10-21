import React, { useState, useEffect } from 'react'
import {
  Search,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
} from 'lucide-react'
import { api } from '../../services/api'
import type { VocabularyItem, Document } from '../../types'

interface VocabularyViewProps {
  onPracticeWithRule?: (ruleId: string) => void
}

export const VocabularyView: React.FC<VocabularyViewProps> = () => {
  const [items, setItems] = useState<VocabularyItem[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedDocId, setSelectedDocId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadDocuments()
  }, [])

  useEffect(() => {
    loadVocabulary()
  }, [selectedStatus, selectedDocId, searchQuery])

  const loadDocuments = async () => {
    try {
      const docs = await api.listDocuments()
      setDocuments(docs)
    } catch {
      // Ignore
    }
  }

  const loadVocabulary = async () => {
    setLoading(true)
    setError(null)
    try {
      const statusParam = selectedStatus === 'all' ? undefined : selectedStatus
      const docParam = selectedDocId === 'all' ? undefined : Number(selectedDocId)
      const res = await api.listVocabulary({
        status: statusParam,
        document_id: docParam,
        search: searchQuery.trim() || undefined,
        limit: 200,
      })
      setItems(res)
    } catch (err: any) {
      setError(err.message || 'Không thể tải bảng từ vựng.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (vocabId: number, newStatus: 'new' | 'learning' | 'known') => {
    try {
      await api.updateVocabularyStatus(vocabId, newStatus)
      setItems((prev) =>
        prev.map((it) => (it.id === vocabId ? { ...it, status: newStatus } : it))
      )
    } catch (e: any) {
      alert(`Lỗi cập nhật trạng thái: ${e.message}`)
    }
  }

  const getStatusBadge = (status: string) => {
    if (status === 'known') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Đã biết</span>
        </span>
      )
    }
    if (status === 'learning') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-900 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          <span>Đang học</span>
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-100 text-rose-800 border border-rose-200">
        <Sparkles className="w-3 h-3 text-rose-600" />
        <span>Mới</span>
      </span>
    )
  }

  const exportUrl = api.getExportCsvUrl(
    selectedStatus === 'all' ? undefined : selectedStatus,
    selectedDocId === 'all' ? undefined : Number(selectedDocId)
  )

  const counts = {
    total: items.length,
    new: items.filter((i) => i.status === 'new').length,
    learning: items.filter((i) => i.status === 'learning').length,
    known: items.filter((i) => i.status === 'known').length,
  }

  return (
    <div className="flex-1 flex flex-col space-y-4 max-w-7xl w-full mx-auto">
      {/* Top Banner & Stats */}
      <div className="bg-white dark:bg-[#1E1D1B] border border-stone-border dark:border-[#3A3735] rounded-lg p-5 shadow-xs flex items-center justify-between flex-wrap gap-4 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-french-navy dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded font-semibold">
              Quản lý vốn từ vựng
            </span>
          </div>
          <h2 className="font-serif font-bold text-xl text-ink-900 dark:text-[#E8E3DA] mt-1">
            Bảng từ vựng (Vocabulary Bank)
          </h2>
          <p className="text-xs text-ink-500 dark:text-[#A8A29E] mt-0.5">
            Tổng cộng: <strong className="text-ink-900 dark:text-[#E8E3DA]">{counts.total}</strong> từ •{' '}
            <span className="text-rose-700 dark:text-rose-400">{counts.new} mới</span> •{' '}
            <span className="text-amber-700 dark:text-amber-400">{counts.learning} đang học</span> •{' '}
            <span className="text-emerald-700 dark:text-emerald-400">{counts.known} đã biết</span>
          </p>
        </div>

        {/* Export CSV Button */}
        <a
          href={exportUrl}
          download
          className="px-3.5 py-2 bg-french-navy dark:bg-slate-700 text-white hover:bg-slate-800 dark:hover:bg-slate-600 rounded text-xs font-medium transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Xuất file CSV</span>
        </a>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-[#1E1D1B] border border-stone-border dark:border-[#3A3735] rounded-lg p-3.5 shadow-xs flex items-center justify-between flex-wrap gap-3 transition-colors">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo từ, lemma..."
              className="pl-8 pr-3 py-1.5 text-xs border border-stone-border dark:border-[#3A3735] rounded focus:outline-none focus:border-french-navy bg-white dark:bg-[#242220] text-ink-900 dark:text-[#E8E3DA] placeholder-ink-400 dark:placeholder-stone-500 w-44 sm:w-56"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 text-xs text-ink-700 dark:text-[#A8A29E]">
            <Filter className="w-3.5 h-3.5 text-stone-400" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="border border-stone-border dark:border-[#3A3735] rounded px-2.5 py-1.5 text-xs bg-white dark:bg-[#242220] text-ink-800 dark:text-[#E8E3DA] focus:outline-none focus:border-french-navy"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="new">Từ mới (New)</option>
              <option value="learning">Đang học (Learning)</option>
              <option value="known">Đã biết (Known)</option>
            </select>
          </div>

          {/* Document filter */}
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="border border-stone-border dark:border-[#3A3735] rounded px-2.5 py-1.5 text-xs bg-white dark:bg-[#242220] text-ink-800 dark:text-[#E8E3DA] focus:outline-none focus:border-french-navy max-w-xs truncate"
          >
            <option value="all">Tất cả tài liệu</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={loadVocabulary}
          className="p-1.5 border border-stone-border dark:border-[#3A3735] rounded hover:bg-stone-50 dark:hover:bg-[#2C2A27] text-stone-600 dark:text-[#A8A29E] transition-colors cursor-pointer"
          title="Tải lại bảng từ"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-[#1E1D1B] border border-stone-border dark:border-[#3A3735] rounded-lg shadow-xs overflow-hidden flex-1 flex flex-col transition-colors">
        {loading ? (
          <div className="py-20 text-center text-xs text-stone-400 font-mono">
            Đang tải dữ liệu từ vựng...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-rose-700 dark:text-rose-400">{error}</div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center text-xs text-stone-400">
            Không tìm thấy từ vựng nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 dark:bg-[#181716] border-b border-stone-border dark:border-[#3A3735] text-stone-500 dark:text-[#A8A29E] font-mono">
                  <th className="py-2.5 px-4">Lemma</th>
                  <th className="py-2.5 px-3">Loại từ</th>
                  <th className="py-2.5 px-4">Nghĩa (Pháp / Việt)</th>
                  <th className="py-2.5 px-4">Câu ngữ cảnh</th>
                  <th className="py-2.5 px-3">Gặp</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                  <th className="py-2.5 px-4 text-right">Chuyển trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-[#2C2A27]">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-parchment-50/70 dark:hover:bg-[#242220] transition-colors">
                    {/* Lemma */}
                    <td className="py-3 px-4">
                      <div className="font-serif font-bold text-sm text-ink-900 dark:text-[#E8E3DA]">{it.lemma}</div>
                      {it.surface_form && it.surface_form !== it.lemma && (
                        <div className="text-[11px] text-stone-400 font-sans">
                          từ xuất hiện: «{it.surface_form}»
                        </div>
                      )}
                    </td>

                    {/* POS */}
                    <td className="py-3 px-3">
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-[#2C2A27] text-stone-600 dark:text-[#A8A29E]">
                        {it.pos || 'N/A'}
                      </span>
                    </td>

                    {/* Definition */}
                    <td className="py-3 px-4 max-w-xs">
                      {it.definition_vi ? (
                        <div>
                          <div className="font-medium text-ink-800 dark:text-[#D6D0C7] line-clamp-2">
                            {it.definition_vi}
                          </div>
                          {it.definition && (
                            <div className="text-[11px] text-stone-400 italic line-clamp-1">
                              FR: {it.definition}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-ink-700 dark:text-[#A8A29E] line-clamp-2">
                          {it.definition || 'Chưa có nghĩa.'}
                        </div>
                      )}
                    </td>

                    {/* Context sentence */}
                    <td className="py-3 px-4 max-w-sm">
                      {it.context_sentence ? (
                        <div className="font-serif italic text-ink-700 dark:text-[#A8A29E] text-[11px] line-clamp-2">
                          «{it.context_sentence}»
                        </div>
                      ) : (
                        <span className="text-stone-300 dark:text-stone-600">-</span>
                      )}
                      {it.document_title && (
                        <div className="text-[10px] text-stone-400 truncate mt-0.5">
                          Tài liệu: {it.document_title}
                        </div>
                      )}
                    </td>

                    {/* Occurrences count */}
                    <td className="py-3 px-3 font-mono font-medium text-stone-700 dark:text-[#E8E3DA]">
                      {it.occurrences}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3">{getStatusBadge(it.status)}</td>

                    {/* Quick actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleUpdateStatus(it.id, 'new')}
                          disabled={it.status === 'new'}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                            it.status === 'new'
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 opacity-60'
                              : 'hover:bg-stone-100 dark:hover:bg-[#2C2A27] text-stone-600 dark:text-[#A8A29E] border-stone-200 dark:border-[#3A3735]'
                          }`}
                        >
                          Mới
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(it.id, 'learning')}
                          disabled={it.status === 'learning'}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                            it.status === 'learning'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 opacity-60'
                              : 'hover:bg-stone-100 dark:hover:bg-[#2C2A27] text-stone-600 dark:text-[#A8A29E] border-stone-200 dark:border-[#3A3735]'
                          }`}
                        >
                          Học
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(it.id, 'known')}
                          disabled={it.status === 'known'}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                            it.status === 'known'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border-emerald-300 opacity-60'
                              : 'hover:bg-stone-100 dark:hover:bg-[#2C2A27] text-stone-600 dark:text-[#A8A29E] border-stone-200 dark:border-[#3A3735]'
                          }`}
                        >
                          Biết
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
