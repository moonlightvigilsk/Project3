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
      <div className="border-b border-stone-border pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-serif font-bold text-2xl text-ink-900">
            Chủ điểm ngữ pháp tiếng Pháp
          </h2>
          <p className="text-xs text-ink-500 mt-1">
            Học tường minh các cấu trúc cốt lõi từ A1 đến B2 • Khớp câu thực tế từ sách của bạn
          </p>
        </div>
        <div className="text-xs font-mono text-ink-500 bg-parchment-200 px-3 py-1.5 rounded border border-stone-border">
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
                  ? 'bg-french-navy text-white font-medium shadow-2xs'
                  : 'bg-white text-ink-700 hover:bg-stone-subtle border border-stone-border'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên, từ khóa..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-stone-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-french-bordeaux focus:border-french-bordeaux transition-colors"
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-ink-500 font-mono">
          Đang tải danh mục ngữ pháp...
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="p-12 text-center bg-white border border-dashed border-stone-300 rounded-lg space-y-2">
          <Sparkles className="w-6 h-6 mx-auto text-ink-400 opacity-60" />
          <p className="text-xs text-ink-500 font-serif">
            Không tìm thấy chủ điểm ngữ pháp nào phù hợp với bộ lọc hiện tại.
          </p>
        </div>
      ) : (
        /* Rules Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRules.map((rule) => (
            <div
              key={rule.id}
              className="bg-white border border-stone-border rounded-lg p-5 flex flex-col justify-between hover:border-stone-400 hover:shadow-xs transition-all group"
            >
              <div className="space-y-3">
                {/* Meta badges */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-ink-500 bg-stone-100 px-2 py-0.5 rounded">
                    {rule.category}
                  </span>
                  <span className="text-[10px] font-mono bg-french-navy text-white px-2 py-0.5 rounded font-medium">
                    {rule.level}
                  </span>
                </div>

                {/* Rule Name */}
                <h3 className="font-serif font-bold text-base text-ink-900 group-hover:text-french-bordeaux transition-colors">
                  {rule.name}
                </h3>

                {/* Formula box */}
                <div className="p-2.5 bg-parchment-100 border border-stone-border rounded text-xs font-mono text-ink-800">
                  <span className="text-[10px] text-ink-400 block mb-0.5 uppercase">Công thức:</span>
                  <span className="font-semibold text-french-navy">{rule.formula}</span>
                </div>

                {/* Description */}
                <p className="text-xs text-ink-600 line-clamp-2 leading-relaxed">
                  {rule.description}
                </p>

                {/* Sample example */}
                {rule.examples && rule.examples.length > 0 && (
                  <div className="text-xs text-ink-500 font-serif italic border-l-2 border-stone-300 pl-2.5">
                    « {rule.examples[0]} »
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="pt-4 mt-4 border-t border-stone-border flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectRule(rule)}
                  className="px-3 py-1.5 text-xs text-ink-700 hover:text-ink-900 hover:bg-stone-subtle rounded border border-stone-border transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-ink-500" />
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
