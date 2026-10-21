import React, { useState, useRef, useCallback } from 'react'
import { X, UploadCloud, FileText, AlertCircle, ScanLine } from 'lucide-react'
import { api } from '../../services/api'
import type { Document } from '../../types'

interface DocumentUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newDoc: Document) => void
}

const ACCEPTED_TYPES = ['.pdf', '.epub', '.txt', '.md']

function formatBytes(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile]           = useState<File | null>(null)
  const [title, setTitle]         = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const applyFile = (selected: File) => {
    setFile(selected)
    if (!title) {
      setTitle(selected.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '))
    }
    setError(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) applyFile(e.target.files[0])
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) applyFile(dropped)
  }, [title])

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  if (!isOpen) return null

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
      handleClose()
    } catch (err: any) {
      const msg: string = err.message || 'Lỗi khi tải tài liệu.'
      // Special case: scanned PDF error
      if (msg.toLowerCase().includes('scan') || msg.toLowerCase().includes('ocr')) {
        setError(
          `📷 ${msg}\n\nGợi ý: Hãy dùng phần mềm OCR (như Adobe Acrobat hoặc tesseract) để chuyển PDF scan thành PDF có văn bản trước khi tải lên.`,
        )
      } else {
        setError(msg)
      }
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setTitle('')
    setError(null)
    onClose()
  }

  const fileExt = file?.name.split('.').pop()?.toLowerCase()
  const fileTypeLabel =
    fileExt === 'epub' ? 'EPUB' : fileExt === 'pdf' ? 'PDF' : fileExt?.toUpperCase() ?? ''
  const fileTypeColor =
    fileExt === 'epub'
      ? 'text-emerald-700'
      : fileExt === 'pdf'
        ? 'text-blue-700'
        : 'text-ink-700'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-parchment-50 dark:bg-[#1E1D1B] border border-stone-border dark:border-[#3A3735] rounded-xl shadow-2xl w-full max-w-md p-6 relative transition-colors">
        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-ink-400 dark:text-[#78716C] hover:text-ink-900 dark:hover:text-[#E8E3DA] transition-colors cursor-pointer"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="font-serif text-xl font-bold text-ink-900 dark:text-[#E8E3DA] mb-1">
          Tải lên tài liệu tiếng Pháp
        </h2>
        <p className="text-xs text-ink-500 dark:text-[#A8A29E] mb-5 leading-relaxed">
          Hỗ trợ <strong>EPUB</strong> (theo chương) và <strong>PDF</strong> có văn bản
          (loại header/footer lặp, nối dòng bị ngắt). Hệ thống sẽ tách câu và lập chỉ mục
          ngữ pháp tự động.
        </p>

        {/* Error box */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-800 dark:text-red-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500 dark:text-red-400" />
            <pre className="whitespace-pre-wrap font-sans leading-relaxed">{error}</pre>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-ink-900 dark:border-amber-400 bg-parchment-200 dark:bg-[#2C2A27]'
                : 'border-stone-border dark:border-[#3A3735] hover:border-ink-700 dark:hover:border-[#78716C] bg-white dark:bg-[#242220]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              className="hidden"
              onChange={handleFileChange}
            />

            {file ? (
              <div className="flex flex-col items-center gap-1.5">
                <FileText className={`w-8 h-8 ${fileTypeColor}`} />
                <span className="text-sm font-semibold text-ink-900 dark:text-[#E8E3DA]">{file.name}</span>
                <div className="flex items-center gap-2 text-xs text-ink-500 dark:text-[#A8A29E]">
                  <span className={`font-mono font-bold ${fileTypeColor}`}>{fileTypeLabel}</span>
                  <span>·</span>
                  <span>{formatBytes(file.size)}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setError(null) }}
                  className="mt-1 text-[11px] text-ink-400 hover:text-red-600 dark:text-[#78716C] dark:hover:text-red-400 underline cursor-pointer"
                >
                  Đổi tệp khác
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <UploadCloud className="w-9 h-9 text-ink-400 dark:text-[#78716C] mx-auto" />
                <p className="text-sm font-medium text-ink-800 dark:text-[#E8E3DA]">
                  Kéo thả hoặc nhấp để chọn tệp
                </p>
                <p className="text-[11px] text-ink-400 dark:text-[#78716C]">
                  PDF, EPUB, TXT — tối đa 25 MB
                </p>

                {/* Scanned PDF note */}
                <div className="mt-3 flex items-start gap-1.5 text-[11px] text-ink-500 dark:text-[#A8A29E] bg-parchment-100 dark:bg-[#1E1D1B] rounded p-2 text-left">
                  <ScanLine className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    PDF scan (chỉ chứa ảnh) chưa được hỗ trợ — dùng PDF có văn bản
                    thực.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-ink-700 dark:text-[#A8A29E] mb-1">
              Tiêu đề tài liệu <span className="text-ink-400 dark:text-[#78716C] font-normal">(tùy chọn)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Le Petit Prince, Les Misérables..."
              className="w-full text-sm px-3 py-2 bg-white dark:bg-[#242220] border border-stone-border dark:border-[#3A3735] rounded-lg text-ink-900 dark:text-[#E8E3DA] placeholder-ink-400 dark:placeholder-stone-500 focus:outline-none focus:border-ink-900 dark:focus:border-[#E8E3DA] transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={isUploading}
              className="px-3 py-2 border border-stone-border dark:border-[#3A3735] text-sm rounded-lg font-medium text-ink-700 dark:text-[#A8A29E] hover:bg-parchment-200 dark:hover:bg-[#2C2A27] transition-colors disabled:opacity-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isUploading || !file}
              className={`px-5 py-2 text-sm rounded-lg font-medium transition-colors flex items-center gap-2 cursor-pointer ${
                isUploading || !file
                  ? 'bg-ink-400 dark:bg-[#3A3735] text-stone-200 dark:text-stone-500 cursor-not-allowed'
                  : 'bg-ink-900 dark:bg-[#E8E3DA] text-white dark:text-[#1A1917] hover:bg-ink-800 dark:hover:bg-white'
              }`}
            >
              {isUploading ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white dark:border-[#1A1917] border-t-transparent rounded-full animate-spin" />
                  <span>Đang xử lý...</span>
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
