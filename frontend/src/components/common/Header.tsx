import React from 'react'
import { BookOpen, Compass, Award, Upload } from 'lucide-react'

interface HeaderProps {
  currentTab: 'reader' | 'catalog' | 'stats'
  onSelectTab: (tab: 'reader' | 'catalog' | 'stats') => void
  onOpenUpload: () => void
  hasDocument?: boolean
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenUpload,
}) => {
  return (
    <header className="border-b border-stone-border bg-parchment-50 px-6 py-3.5 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand / Title */}
        <div className="flex items-center space-x-3">
          <span className="font-serif font-bold text-lg text-ink-900 tracking-tight">
            Grammaire en Contexte
          </span>
          <span className="text-xs px-2 py-0.5 border border-stone-border rounded text-ink-500 font-mono">
            Français
          </span>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 sm:space-x-2">
          <button
            onClick={() => onSelectTab('reader')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center space-x-1.5 ${
              currentTab === 'reader'
                ? 'bg-ink-900 text-white'
                : 'text-ink-700 hover:text-ink-900 hover:bg-parchment-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Tài liệu đọc</span>
          </button>

          <button
            onClick={() => onSelectTab('catalog')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center space-x-1.5 ${
              currentTab === 'catalog'
                ? 'bg-ink-900 text-white'
                : 'text-ink-700 hover:text-ink-900 hover:bg-parchment-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Chủ điểm ngữ pháp</span>
          </button>

          <button
            onClick={() => onSelectTab('stats')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center space-x-1.5 ${
              currentTab === 'stats'
                ? 'bg-ink-900 text-white'
                : 'text-ink-700 hover:text-ink-900 hover:bg-parchment-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Tiến độ & Sổ tay</span>
          </button>
        </nav>

        {/* Action button */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenUpload}
            className="px-3 py-1.5 border border-stone-border hover:border-ink-900 rounded text-xs font-medium text-ink-800 transition-colors flex items-center space-x-1.5 bg-white"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Thêm tài liệu</span>
          </button>
        </div>
      </div>
    </header>
  )
}
