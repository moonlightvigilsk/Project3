import React from 'react'
import { BookOpen, Trash2, ArrowRight, Upload, FileText } from 'lucide-react'
import type { Document } from '../../types'

interface DocumentListProps {
  documents: Document[]
  selectedDocId: number | null
  onSelectDocument: (doc: Document) => void
  onDeleteDocument: (docId: number) => void
  onOpenUpload: () => void
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  selectedDocId,
  onSelectDocument,
  onDeleteDocument,
  onOpenUpload,
}) => {
  if (documents.length === 0) {
    return (
      <div className="text-center py-20 px-4 max-w-sm mx-auto">
        <BookOpen className="w-12 h-12 text-ink-400 dark:text-[#78716C] mx-auto mb-4" />
        <h3 className="font-serif text-lg font-bold text-ink-900 dark:text-[#E8E3DA] mb-2">Tủ sách trống</h3>
        <p className="text-sm text-ink-500 dark:text-[#A8A29E] mb-8 leading-relaxed">
          Tải lên một tác phẩm tiếng Pháp bạn yêu thích — tiểu thuyết EPUB hoặc bài báo PDF —
          để bắt đầu học ngữ pháp theo ngữ cảnh.
        </p>
        <button
          onClick={onOpenUpload}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink-900 dark:bg-[#E8E3DA] text-white dark:text-[#1A1917] rounded text-sm font-medium hover:bg-ink-800 dark:hover:bg-white transition-colors cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          Tải lên tài liệu đầu tiên
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Library header */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-border dark:border-[#3A3735]">
        <div>
          <h2 className="font-serif font-bold text-base text-ink-900 dark:text-[#E8E3DA]">Tủ sách của bạn</h2>
          <p className="text-xs text-ink-500 dark:text-[#A8A29E] mt-0.5">{documents.length} tài liệu</p>
        </div>
        <button
          onClick={onOpenUpload}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-stone-border dark:border-[#3A3735] hover:border-ink-900 dark:hover:border-[#E8E3DA] rounded text-xs font-medium text-ink-800 dark:text-[#E8E3DA] bg-white dark:bg-[#242220] transition-colors cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          Thêm tài liệu
        </button>
      </div>

      {/* Document grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {documents.map((doc) => {
          const isSelected = doc.id === selectedDocId
          const fileTypeColor =
            doc.file_type === 'epub'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-850'
              : doc.file_type === 'pdf'
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-850'
                : 'bg-parchment-200 dark:bg-[#2C2A27] text-ink-700 dark:text-[#A8A29E] border-stone-border dark:border-[#3A3735]'

          return (
            <div
              key={doc.id}
              onClick={() => onSelectDocument(doc)}
              className={`group p-4 rounded-lg border cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                isSelected
                  ? 'border-ink-900 dark:border-[#E8E3DA] bg-white dark:bg-[#1E1D1B] ring-1 ring-ink-900 dark:ring-[#E8E3DA] shadow-sm'
                  : 'border-stone-border dark:border-[#3A3735] bg-white dark:bg-[#1E1D1B] hover:border-ink-400 dark:hover:border-[#78716C] hover:shadow-sm'
              }`}
            >
              {/* Top row */}
              <div>
                <div className="flex items-start justify-between mb-2 gap-1">
                  <span
                    className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${fileTypeColor}`}
                  >
                    {doc.file_type}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Xác nhận xóa tài liệu «${doc.title}»?`)) {
                        onDeleteDocument(doc.id)
                      }
                    }}
                    className="text-ink-400 hover:text-red-600 dark:text-[#78716C] dark:hover:text-red-400 p-1 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Xóa tài liệu"
                    aria-label="Xóa tài liệu"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-start gap-2 mb-1">
                  <FileText className="w-4 h-4 text-ink-400 dark:text-[#78716C] shrink-0 mt-0.5" />
                  <h4 className="font-serif font-bold text-sm text-ink-900 dark:text-[#E8E3DA] leading-snug line-clamp-2">
                    {doc.title}
                  </h4>
                </div>

                <p className="text-[11px] text-ink-500 dark:text-[#A8A29E] truncate ml-6">{doc.filename}</p>
              </div>

              {/* Bottom row */}
              <div className="flex items-center justify-between text-[11px] text-ink-500 dark:text-[#A8A29E] pt-2 border-t border-stone-100 dark:border-[#2C2A27]">
                <span>{doc.total_sentences} câu</span>
                <span>{doc.total_words.toLocaleString()} từ</span>
                <span className="text-xs text-ink-900 dark:text-[#E8E3DA] font-medium flex items-center gap-0.5">
                  Đọc <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
