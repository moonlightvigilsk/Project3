import React from 'react'
import { BookOpen, Compass, Award, Upload, BookA, Sun, Moon } from 'lucide-react'

interface HeaderProps {
  currentTab: 'reader' | 'catalog' | 'stats' | 'vocab'
  onSelectTab: (tab: 'reader' | 'catalog' | 'stats' | 'vocab') => void
  onOpenUpload: () => void
  hasDocument?: boolean
  darkMode?: boolean
  onToggleDarkMode?: () => void
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenUpload,
  darkMode = false,
  onToggleDarkMode,
}) => {
  return (
    <header className="border-b border-stone-border dark:border-[#3A3735] bg-parchment-50 dark:bg-[#1A1917] px-6 py-3.5 sticky top-0 z-30 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand / Title */}
        <div className="flex items-center space-x-3">
          <span className="font-serif font-bold text-lg text-ink-900 dark:text-[#E8E3DA] tracking-tight">
            Grammaire en Contexte
          </span>
          <span className="text-xs px-2 py-0.5 border border-stone-border dark:border-[#3A3735] rounded text-ink-500 dark:text-[#A8A29E] font-mono">
            Français
          </span>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 sm:space-x-2">
          <button
            onClick={() => onSelectTab('reader')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center space-x-1.5 ${
              currentTab === 'reader'
                ? 'bg-ink-900 dark:bg-[#E8E3DA] text-white dark:text-[#1A1917]'
                : 'text-ink-700 dark:text-[#A8A29E] hover:text-ink-900 dark:hover:text-[#E8E3DA] hover:bg-parchment-200 dark:hover:bg-[#2C2A27]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Tài liệu đọc</span>
          </button>

          <button
            onClick={() => onSelectTab('catalog')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center space-x-1.5 ${
              currentTab === 'catalog'
                ? 'bg-ink-900 dark:bg-[#E8E3DA] text-white dark:text-[#1A1917]'
                : 'text-ink-700 dark:text-[#A8A29E] hover:text-ink-900 dark:hover:text-[#E8E3DA] hover:bg-parchment-200 dark:hover:bg-[#2C2A27]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Chủ điểm ngữ pháp</span>
          </button>

          <button
            onClick={() => onSelectTab('vocab')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center space-x-1.5 ${
              currentTab === 'vocab'
                ? 'bg-ink-900 dark:bg-[#E8E3DA] text-white dark:text-[#1A1917]'
                : 'text-ink-700 dark:text-[#A8A29E] hover:text-ink-900 dark:hover:text-[#E8E3DA] hover:bg-parchment-200 dark:hover:bg-[#2C2A27]'
            }`}
          >
            <BookA className="w-3.5 h-3.5" />
            <span>Từ vựng</span>
          </button>

          <button
            onClick={() => onSelectTab('stats')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center space-x-1.5 ${
              currentTab === 'stats'
                ? 'bg-ink-900 dark:bg-[#E8E3DA] text-white dark:text-[#1A1917]'
                : 'text-ink-700 dark:text-[#A8A29E] hover:text-ink-900 dark:hover:text-[#E8E3DA] hover:bg-parchment-200 dark:hover:bg-[#2C2A27]'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Tiến độ & Sổ tay</span>
          </button>
        </nav>

        {/* Action buttons */}
        <div className="flex items-center space-x-2">
          {/* Global Dark / Light Theme Toggle */}
          {onToggleDarkMode && (
            <button
              onClick={onToggleDarkMode}
              title={darkMode ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
              aria-label={darkMode ? 'Chế độ sáng' : 'Chế độ tối'}
              className="p-1.5 border border-stone-border dark:border-[#3A3735] hover:border-ink-900 dark:hover:border-[#E8E3DA] rounded text-ink-700 dark:text-[#A8A29E] hover:text-ink-900 dark:hover:text-[#E8E3DA] bg-white dark:bg-[#242220] transition-colors flex items-center justify-center cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-ink-700" />}
            </button>
          )}

          <button
            onClick={onOpenUpload}
            className="px-3 py-1.5 border border-stone-border dark:border-[#3A3735] hover:border-ink-900 dark:hover:border-[#E8E3DA] rounded text-xs font-medium text-ink-800 dark:text-[#E8E3DA] transition-colors flex items-center space-x-1.5 bg-white dark:bg-[#242220]"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Thêm tài liệu</span>
          </button>
        </div>
      </div>
    </header>
  )
}
