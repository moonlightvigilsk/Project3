import React, { useState, useEffect } from 'react'
import { Search, PenTool, BookOpen, Sparkles } from 'lucide-react'
import { api } from '../../services/api'
import type { GrammarRuleMetadata } from '../../types'

interface GrammarCatalogViewProps {
  onSelectRule: (rule: GrammarRuleMetadata) => void
  onPracticeRule: (ruleId: string) => void
}

const LEVELS = ['Tất cả', 'A1-A2', 'A2', 'A2-B1', 'B1', 'B1-B2']

export const GrammarCatalogView: React.FC<GrammarCatalogViewProps> = ({
  onSelectRule,
  onPracticeRule,
}) => {
  const [rules, setRules] = useState<GrammarRuleMetadata[]>([])
  const [selectedLevel, setSelectedLevel] = useState('Tất cả')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadRules()
  }, [])

  const loadRules = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await api.listGrammarRules()
      setRules(data)
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách chủ điểm ngữ pháp.')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredRules = rules.filter((rule) => {
    const matchesLevel = selectedLevel === 'Tất cả' || rule.level === selectedLevel
    const query = searchQuery.toLowerCase().trim()
    const matchesQuery =
      !query ||
      rule.name.toLowerCase().includes(query) ||
      rule.description.toLowerCase().includes(query) ||
      rule.formula.toLowerCase().includes(query) ||
      (rule.keywords && rule.keywords.some((kw) => kw.toLowerCase().includes(query)))
    return matchesLevel && matchesQuery
  })

  return (
    <div className="space-y-6">
      {/* Page Title & Philosophy Banner */}
      <div className="border-b border-stone-border dark:border-[#3A3735] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-serif font-bold text-2xl text-ink-900 dark:text-[#E8E3DA]">
            Chủ điểm ngữ pháp tiếng Pháp
          </h2>
          <p className="text-xs text-ink-500 dark:text-[#A8A29E] mt-1">
            Học tường minh các cấu trúc cốt lõi từ A1 đến B2 • Khớp câu thực tế từ sách của bạn
          </p>
        </div>
        <div className="text-xs font-mono text-ink-500 dark:text-[#A8A29E] bg-parchment-200 dark:bg-[#2C2A27] px-3 py-1.5 rounded border border-stone-border dark:border-[#3A3735]">
          {filteredRules.length} / {rules.length} chủ điểm
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Level Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {LEVELS.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setSelectedLevel(lvl)}
              className={`px-3 py-1.5 rounded text-xs font-mono transition-colors shrink-0 cursor-pointer ${
                selectedLevel === lvl
                  ? 'bg-french-navy dark:bg-slate-700 text-white font-medium shadow-2xs'
                  : 'bg-white dark:bg-[#1E1D1B] text-ink-700 dark:text-[#E8E3DA] hover:bg-stone-subtle dark:hover:bg-[#2C2A27] border border-stone-border dark:border-[#3A3735]'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-ink-400 dark:text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên, từ khóa..."
            className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-[#1E1D1B] border border-stone-border dark:border-[#3A3735] text-ink-900 dark:text-[#E8E3DA] placeholder-ink-400 dark:placeholder-stone-500 rounded text-xs focus:outline-none focus:ring-1 focus:ring-french-bordeaux focus:border-french-bordeaux transition-colors"
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded text-xs text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-ink-500 dark:text-[#A8A29E] font-mono">
          Đang tải danh mục ngữ pháp...
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#1E1D1B] border border-dashed border-stone-300 dark:border-[#3A3735] rounded-lg space-y-2">
          <Sparkles className="w-6 h-6 mx-auto text-ink-400 dark:text-[#78716C] opacity-60" />
          <p className="text-xs text-ink-500 dark:text-[#A8A29E] font-serif">
            Không tìm thấy chủ điểm ngữ pháp nào phù hợp với bộ lọc hiện tại.
          </p>
        </div>
      ) : (
        /* Rules Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRules.map((rule) => (
            <div
              key={rule.id}
              className="bg-white dark:bg-[#1E1D1B] border border-stone-border dark:border-[#3A3735] rounded-lg p-5 flex flex-col justify-between hover:border-stone-400 dark:hover:border-[#78716C] hover:shadow-xs transition-all group"
            >
              <div className="space-y-3">
                {/* Meta badges */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-ink-500 dark:text-[#A8A29E] bg-stone-100 dark:bg-[#2C2A27] px-2 py-0.5 rounded">
                    {rule.category}
                  </span>
                  <span className="text-[10px] font-mono bg-french-navy dark:bg-slate-700 text-white px-2 py-0.5 rounded font-medium">
                    {rule.level}
                  </span>
                </div>

                {/* Rule Name */}
                <h3 className="font-serif font-bold text-base text-ink-900 dark:text-[#E8E3DA] group-hover:text-french-bordeaux dark:group-hover:text-amber-300 transition-colors">
                  {rule.name}
                </h3>

                {/* Formula box */}
                <div className="p-2.5 bg-parchment-100 dark:bg-[#242220] border border-stone-border dark:border-[#3A3735] rounded text-xs font-mono text-ink-800 dark:text-[#D6D0C7]">
                  <span className="text-[10px] text-ink-400 dark:text-[#78716C] block mb-0.5 uppercase">Công thức:</span>
                  <span className="font-semibold text-french-navy dark:text-blue-300">{rule.formula}</span>
                </div>

                {/* Description */}
                <p className="text-xs text-ink-600 dark:text-[#A8A29E] line-clamp-2 leading-relaxed">
                  {rule.description}
                </p>

                {/* Sample example */}
                {rule.examples && rule.examples.length > 0 && (
                  <div className="text-xs text-ink-500 dark:text-[#78716C] font-serif italic border-l-2 border-stone-300 dark:border-[#3A3735] pl-2.5">
                    « {rule.examples[0]} »
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="pt-4 mt-4 border-t border-stone-border dark:border-[#3A3735] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectRule(rule)}
                  className="px-3 py-1.5 text-xs text-ink-700 dark:text-[#E8E3DA] hover:text-ink-900 hover:bg-stone-subtle dark:hover:bg-[#2C2A27] rounded border border-stone-border dark:border-[#3A3735] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-ink-500 dark:text-[#78716C]" />
                  <span>Chi tiết & Bảng chia</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPracticeRule(rule.id)}
                  className="px-3 py-1.5 text-xs bg-french-bordeaux text-white hover:bg-red-900 rounded font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Luyện câu</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
