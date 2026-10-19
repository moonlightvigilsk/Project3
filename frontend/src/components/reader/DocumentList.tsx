import React from 'react'
import { Book, Trash2, ArrowRight } from 'lucide-react'
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
      <div className="text-center py-16 px-4 max-w-md mx-auto">
        <Book className="w-10 h-10 text-ink-400 mx-auto mb-3" />
        <h3 className="font-serif text-base font-bold text-ink-900 mb-1">
          Chưa có tài liệu nào
        </h3>
        <p className="text-xs text-ink-500 mb-6 leading-relaxed">
          Tải lên một tác phẩm tiếng Pháp bạn yêu thích (tiểu thuyết EPUB, bài báo PDF hoặc đoạn văn TXT) để bắt đầu học ngữ pháp theo ngữ cảnh.
        </p>
        <button
          onClick={onOpenUpload}
          className="px-4 py-2 bg-ink-900 text-white rounded text-xs font-medium hover:bg-ink-800 transition-colors"
        >
          Tải lên tài liệu đầu tiên
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-stone-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
          Tủ sách của bạn ({documents.length})
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {documents.map((doc) => {
          const isSelected = doc.id === selectedDocId
          return (
            <div
              key={doc.id}
              onClick={() => onSelectDocument(doc)}
              className={`p-4 rounded-md border text-left cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-ink-900 bg-white ring-1 ring-ink-900'
                  : 'border-stone-border bg-white hover:border-ink-400'
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-parchment-200 text-ink-700">
                    {doc.file_type}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Xác nhận xóa tài liệu "${doc.title}"?`)) {
                        onDeleteDocument(doc.id)
                      }
                    }}
                    className="text-ink-400 hover:text-red-700 p-1 transition-colors"
                    title="Xóa tài liệu"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h4 className="font-serif font-bold text-sm text-ink-900 line-clamp-2 mb-1">
                  {doc.title}
                </h4>
                <p className="text-[11px] text-ink-500 truncate mb-3">
                  {doc.filename}
                </p>
              </div>

              <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-ink-500">
                <span>{doc.total_sentences} câu</span>
                <span>{doc.total_words} từ</span>
                <span className="text-xs text-ink-900 font-medium flex items-center">
                  Đọc <ArrowRight className="w-3 h-3 ml-0.5" />
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
