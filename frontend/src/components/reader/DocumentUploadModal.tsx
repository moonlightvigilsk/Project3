import React, { useState, useRef } from 'react'
import { X, UploadCloud, FileText, AlertCircle } from 'lucide-react'
import { api } from '../../services/api'
import type { Document } from '../../types'

interface DocumentUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newDoc: Document) => void
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0]
      setFile(selected)
      if (!title) {
        const defaultTitle = selected.name.replace(/\.[^/.]+$/, '')
        setTitle(defaultTitle)
      }
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Vui lòng chọn một tệp tài liệu (.pdf, .epub, hoặc .txt).')
      return
    }

    try {
      setIsUploading(true)
      setError(null)
      const doc = await api.uploadDocument(file, title.trim() || undefined)
      onSuccess(doc)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải tài liệu.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="bg-parchment-50 border border-stone-border rounded-lg shadow-sm w-full max-w-lg p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-ink-500 hover:text-ink-900 transition-colors"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="font-serif text-lg font-bold text-ink-900 mb-1">
          Tải lên tài liệu tiếng Pháp
        </h2>
        <p className="text-xs text-ink-500 mb-5">
          Hỗ trợ tệp EPUB, PDF hoặc TXT. Hệ thống sẽ phân tích cú pháp và lập chỉ mục ngữ pháp tự động.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File input / dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-stone-border hover:border-ink-700 bg-white p-6 rounded-md text-center cursor-pointer transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.epub,.txt,.md"
              className="hidden"
              onChange={handleFileChange}
            />
            {file ? (
              <div className="flex items-center justify-center space-x-2 text-ink-900">
                <FileText className="w-5 h-5 text-french-navy" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-ink-500 font-mono">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                <UploadCloud className="w-8 h-8 text-ink-400 mx-auto" />
                <p className="text-xs font-medium text-ink-800">
                  Nhấp để duyệt tệp hoặc kéo thả vào đây
                </p>
                <p className="text-[11px] text-ink-400">PDF, EPUB, TXT (tối đa 25MB)</p>
              </div>
            )}
          </div>

          {/* Title input */}
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">
              Tiêu đề tài liệu (tùy chọn)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Le Petit Prince, L'Étranger..."
              className="w-full text-xs px-3 py-2 bg-white border border-stone-border rounded text-ink-900 focus:outline-none focus:border-ink-900 font-sans"
            />
          </div>

          {/* Submit buttons */}
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-3 py-1.5 border border-stone-border text-xs rounded font-medium text-ink-700 hover:bg-parchment-200 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isUploading || !file}
              className={`px-4 py-1.5 text-xs rounded font-medium text-white transition-colors flex items-center space-x-1.5 ${
                isUploading || !file
                  ? 'bg-ink-400 cursor-not-allowed'
                  : 'bg-ink-900 hover:bg-ink-800'
              }`}
            >
              {isUploading ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Đang xử lý & phân tích...</span>
                </>
              ) : (
                <span>Bắt đầu đọc & học</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
