import React, { useState, useEffect } from 'react'
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertCircle,
  PenTool,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import { api } from '../../services/api'
import type { PracticeStats, PracticeHistoryItem, GrammarRuleMetadata } from '../../types'

interface NotebookViewProps {
  onPracticeRule: (ruleId: string) => void
}

export const NotebookView: React.FC<NotebookViewProps> = ({ onPracticeRule }) => {
  const [stats, setStats] = useState<PracticeStats | null>(null)
  const [history, setHistory] = useState<PracticeHistoryItem[]>([])
  const [rules, setRules] = useState<GrammarRuleMetadata[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [selectedRuleFilter, setSelectedRuleFilter] = useState<string>('all')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'correct' | 'needs_work'>('all')

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [statsData, historyData, rulesData] = await Promise.all([
        api.getPracticeStats(),
        api.getPracticeHistory(),
        api.listGrammarRules(),
      ])
      setStats(statsData)
      setHistory(historyData)
      setRules(rulesData)
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu tiến độ & sổ tay.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFilterRuleChange = async (ruleId: string) => {
    setSelectedRuleFilter(ruleId)
    try {
      const filtered = await api.getPracticeHistory(ruleId === 'all' ? undefined : ruleId)
      setHistory(filtered)
    } catch {
      // ignore
    }
  }

  // Filter history items by status locally
  const filteredHistory = history.filter((item) => {
    if (selectedStatusFilter === 'correct') return item.is_correct
    if (selectedStatusFilter === 'needs_work') return !item.is_correct
    return true
  })

  const getRuleName = (ruleId: string): string => {
    const found = rules.find((r) => r.id === ruleId)
    return found ? found.name : ruleId
  }

  const formatDate = (isoString?: string): string => {
    if (!isoString) return ''
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoString
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-stone-border dark:border-[#3A3735] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-serif font-bold text-2xl text-ink-900 dark:text-[#E8E3DA]">
            Tiến độ & Sổ tay ngữ pháp
          </h2>
          <p className="text-xs text-ink-500 dark:text-[#A8A29E] mt-1">
            Theo dõi độ thuần thục qua từng câu viết • Đúc kết từ tài liệu thực tế của bạn
          </p>
        </div>
        <button
          type="button"
          onClick={loadAllData}
          disabled={isLoading}
          className="px-3 py-1.5 bg-white dark:bg-[#1E1D1B] border border-stone-border dark:border-[#3A3735] rounded text-xs text-ink-700 dark:text-[#E8E3DA] hover:bg-stone-subtle dark:hover:bg-[#2C2A27] transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded text-xs text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-[#1E1D1B] border border-stone-border dark:border-[#3A3735] rounded-lg space-y-1 transition-colors">
          <div className="flex items-center justify-between text-ink-500 dark:text-[#A8A29E]">
            <span className="text-xs font-mono">Tổng câu đã viết</span>
            <BookOpen className="w-4 h-4 text-ink-400 dark:text-[#78716C]" />
          </div>
          <p className="font-serif font-bold text-2xl text-ink-900 dark:text-[#E8E3DA]">
            {stats?.total_attempts ?? 0}
          </p>
          <span className="text-[11px] text-ink-400 dark:text-[#78716C] block">Lượt thực hành</span>
        </div>

        <div className="p-4 bg-white dark:bg-[#1E1D1B] border border-stone-border dark:border-[#3A3735] rounded-lg space-y-1 transition-colors">
          <div className="flex items-center justify-between text-ink-500 dark:text-[#A8A29E]">
            <span className="text-xs font-mono">Tỷ lệ chính xác</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="font-serif font-bold text-2xl text-emerald-900 dark:text-emerald-400">
            {stats?.accuracy_rate ?? 0}%
          </p>
          <span className="text-[11px] text-ink-400 dark:text-[#78716C] block">
            {stats?.correct_attempts ?? 0} câu đạt chuẩn
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-[#1E1D1B] border border-stone-border dark:border-[#3A3735] rounded-lg space-y-1 transition-colors">
          <div className="flex items-center justify-between text-ink-500 dark:text-[#A8A29E]">
            <span className="text-xs font-mono">Điểm trung bình</span>
            <Award className="w-4 h-4 text-french-ochre dark:text-amber-400" />
          </div>
          <p className="font-serif font-bold text-2xl text-french-navy dark:text-blue-300">
            {stats?.average_score ?? 0}
            <span className="text-xs font-mono text-ink-400 dark:text-[#78716C] font-normal"> / 10</span>
          </p>
          <span className="text-[11px] text-ink-400 dark:text-[#78716C] block">Chất lượng diễn đạt</span>
        </div>

        <div className="p-4 bg-white dark:bg-[#1E1D1B] border border-stone-border dark:border-[#3A3735] rounded-lg space-y-1 transition-colors">
          <div className="flex items-center justify-between text-ink-500 dark:text-[#A8A29E]">
            <span className="text-xs font-mono">Chủ điểm đã luyện</span>
            <TrendingUp className="w-4 h-4 text-french-bordeaux dark:text-rose-400" />
          </div>
          <p className="font-serif font-bold text-2xl text-french-bordeaux dark:text-rose-400">
            {stats ? Object.keys(stats.rules_breakdown || {}).length : 0}
            <span className="text-xs font-mono text-ink-400 dark:text-[#78716C] font-normal">
              {' '}
              / {rules.length || 7}
            </span>
          </p>
          <span className="text-[11px] text-ink-400 dark:text-[#78716C] block">Độ bao phủ quy tắc</span>
        </div>
      </div>

      {/* Rule Mastery Table */}
      <div className="bg-white dark:bg-[#1E1D1B] border border-stone-border dark:border-[#3A3735] rounded-lg p-5 space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <h3 className="font-serif font-bold text-base text-ink-900 dark:text-[#E8E3DA]">
            Bảng theo dõi độ thuần thục theo chủ điểm
          </h3>
          <span className="text-xs font-mono text-ink-400 dark:text-[#78716C]">
            {rules.length} chủ điểm trong chương trình
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-stone-border dark:border-[#3A3735] text-ink-500 dark:text-[#A8A29E] font-mono">
                <th className="pb-2.5 font-medium">Chủ điểm ngữ pháp</th>
                <th className="pb-2.5 font-medium text-center">Cấp độ</th>
                <th className="pb-2.5 font-medium text-center">Số câu đã viết</th>
                <th className="pb-2.5 font-medium text-center">Tỷ lệ đúng</th>
                <th className="pb-2.5 font-medium text-center">Điểm TB</th>
                <th className="pb-2.5 font-medium text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-[#2C2A27]">
              {rules.map((rule) => {
                const stat = stats?.rules_breakdown?.[rule.id]
                const attempts = stat?.attempts ?? 0
                const accuracy = stat?.accuracy_rate ?? 0
                const avgScore = stat?.average_score ?? 0

                return (
                  <tr key={rule.id} className="hover:bg-parchment-50 dark:hover:bg-[#242220] transition-colors">
                    <td className="py-3 pr-4">
                      <div className="font-serif font-medium text-ink-900 dark:text-[#E8E3DA] text-sm">
                        {rule.name}
                      </div>
                      <div className="text-[11px] text-ink-400 dark:text-[#78716C] font-mono truncate max-w-xs">
                        {rule.formula}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="px-2 py-0.5 bg-stone-100 dark:bg-[#2C2A27] text-ink-700 dark:text-[#A8A29E] font-mono text-[10px] rounded">
                        {rule.level}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-ink-800 dark:text-[#D6D0C7]">
                      {attempts > 0 ? `${attempts} câu` : '—'}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {attempts > 0 ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-stone-200 dark:bg-[#3A3735] h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                accuracy >= 80
                                  ? 'bg-emerald-600 dark:bg-emerald-400'
                                  : accuracy >= 50
                                  ? 'bg-amber-600 dark:bg-amber-400'
                                  : 'bg-red-600 dark:bg-red-400'
                              }`}
                              style={{ width: `${accuracy}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-ink-700 dark:text-[#A8A29E]">{accuracy}%</span>
                        </div>
                      ) : (
                        <span className="text-ink-400 dark:text-[#78716C] font-mono text-xs">Chưa học</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center font-mono font-medium text-ink-900 dark:text-[#E8E3DA]">
                      {attempts > 0 ? `${avgScore}/10` : '—'}
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <button
                        type="button"
                        onClick={() => onPracticeRule(rule.id)}
                        className="px-2.5 py-1 bg-white dark:bg-[#242220] hover:bg-stone-subtle dark:hover:bg-[#2C2A27] text-french-bordeaux dark:text-rose-400 hover:text-red-900 dark:hover:text-rose-300 border border-stone-border dark:border-[#3A3735] rounded font-mono text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <PenTool className="w-3 h-3" />
                        <span>Luyện tập</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Practice History Feed */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-serif font-bold text-base text-ink-900 dark:text-[#E8E3DA]">
              Nhật ký câu đã viết (Practice History)
            </h3>
            <p className="text-xs text-ink-500 dark:text-[#A8A29E]">
              Xem lại các câu bạn đã sáng tác, lỗi sai phát hiện và lời khuyên sửa chữa
            </p>
          </div>

          {/* History Filters */}
          <div className="flex items-center gap-2">
            {/* Rule Filter */}
            <select
              value={selectedRuleFilter}
              onChange={(e) => handleFilterRuleChange(e.target.value)}
              className="bg-white dark:bg-[#242220] border border-stone-border dark:border-[#3A3735] text-ink-800 dark:text-[#E8E3DA] rounded text-xs px-2.5 py-1.5 font-mono"
            >
              <option value="all">Tất cả chủ điểm</option>
              {rules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) =>
                setSelectedStatusFilter(e.target.value as 'all' | 'correct' | 'needs_work')
              }
              className="bg-white dark:bg-[#242220] border border-stone-border dark:border-[#3A3735] text-ink-800 dark:text-[#E8E3DA] rounded text-xs px-2.5 py-1.5"
            >
              <option value="all">Tất cả kết quả</option>
              <option value="correct">Chỉ câu đúng</option>
              <option value="needs_work">Cần cải thiện</option>
            </select>
          </div>
        </div>

        {/* History List */}
        {filteredHistory.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-[#1E1D1B] border border-dashed border-stone-300 dark:border-[#3A3735] rounded-lg space-y-2">
            <BookOpen className="w-8 h-8 mx-auto text-ink-300 dark:text-[#78716C]" />
            <p className="font-serif text-sm text-ink-700 dark:text-[#E8E3DA]">Chưa có bản ghi thực hành nào.</p>
            <p className="text-xs text-ink-500 dark:text-[#A8A29E]">
              Hãy mở tài liệu đọc hoặc chọn một chủ điểm ngữ pháp để tạo câu đầu tiên!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((item) => {
              const feedback = item.feedback

              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-[#1E1D1B] border border-stone-border dark:border-[#3A3735] rounded-lg p-4 space-y-3 hover:border-stone-400 dark:hover:border-[#78716C] transition-colors"
                >
                  {/* Meta Bar */}
                  <div className="flex items-center justify-between gap-2 border-b border-stone-100 dark:border-[#2C2A27] pb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                          item.is_correct
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {item.is_correct ? 'Đạt chuẩn' : 'Cần sửa'}
                      </span>
                      <span className="text-xs font-serif font-bold text-ink-900 dark:text-[#E8E3DA]">
                        {getRuleName(item.rule_id)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-ink-400 dark:text-[#78716C] font-mono">
                      <span className="font-bold text-ink-800 dark:text-[#E8E3DA]">{item.score}/10 điểm</span>
                      {item.created_at && (
                        <span className="flex items-center gap-1 text-[11px]">
                          <Calendar className="w-3 h-3" />
                          {formatDate(item.created_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sentences */}
                  <div className="space-y-1 text-sm font-serif">
                    <p className="text-ink-900 dark:text-[#E8E3DA] font-medium leading-relaxed">
                      «{item.user_sentence}»
                    </p>
                    {item.corrected_sentence && item.corrected_sentence !== item.user_sentence && (
                      <p className="text-xs text-ink-500 dark:text-[#A8A29E] italic">
                        Gợi ý sửa: <span className="text-french-navy dark:text-amber-300 font-sans font-medium">{item.corrected_sentence}</span>
                      </p>
                    )}
                  </div>

                  {/* Pedagogical feedback */}
                  {feedback?.error_explanation && (
                    <div className="text-xs text-ink-700 dark:text-[#D6D0C7] bg-stone-subtle dark:bg-[#242220] p-2.5 rounded border border-stone-border dark:border-[#3A3735] flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-french-bordeaux dark:text-rose-400 shrink-0 mt-0.5" />
                      <span>{feedback.error_explanation}</span>
                    </div>
                  )}

                  {/* Positive note */}
                  {feedback?.positive_feedback && (
                    <div className="text-xs text-emerald-800 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/40 p-2 rounded flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{feedback.positive_feedback}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
