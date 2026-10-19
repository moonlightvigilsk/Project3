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
import { DiffViewer } from '../practice/DiffViewer'
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
      <div className="border-b border-stone-border pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-serif font-bold text-2xl text-ink-900">
            Tiến độ & Sổ tay ngữ pháp
          </h2>
          <p className="text-xs text-ink-500 mt-1">
            Theo dõi độ thuần thục qua từng câu viết • Đúc kết từ tài liệu thực tế của bạn
          </p>
        </div>
        <button
          type="button"
          onClick={loadAllData}
          disabled={isLoading}
          className="px-3 py-1.5 bg-white border border-stone-border rounded text-xs text-ink-700 hover:bg-stone-subtle transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
          {error}
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-stone-border rounded-lg space-y-1">
          <div className="flex items-center justify-between text-ink-500">
            <span className="text-xs font-mono">Tổng câu đã viết</span>
            <BookOpen className="w-4 h-4 text-ink-400" />
          </div>
          <p className="font-serif font-bold text-2xl text-ink-900">
            {stats?.total_attempts ?? 0}
          </p>
          <span className="text-[11px] text-ink-400 block">Lượt thực hành</span>
        </div>

        <div className="p-4 bg-white border border-stone-border rounded-lg space-y-1">
          <div className="flex items-center justify-between text-ink-500">
            <span className="text-xs font-mono">Tỷ lệ chính xác</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="font-serif font-bold text-2xl text-emerald-900">
            {stats?.accuracy_rate ?? 0}%
          </p>
          <span className="text-[11px] text-ink-400 block">
            {stats?.correct_attempts ?? 0} câu đạt chuẩn
          </span>
        </div>

        <div className="p-4 bg-white border border-stone-border rounded-lg space-y-1">
          <div className="flex items-center justify-between text-ink-500">
            <span className="text-xs font-mono">Điểm trung bình</span>
            <Award className="w-4 h-4 text-french-ochre" />
          </div>
          <p className="font-serif font-bold text-2xl text-french-navy">
            {stats?.average_score ?? 0}
            <span className="text-xs font-mono text-ink-400 font-normal"> / 10</span>
          </p>
          <span className="text-[11px] text-ink-400 block">Chất lượng diễn đạt</span>
        </div>

        <div className="p-4 bg-white border border-stone-border rounded-lg space-y-1">
          <div className="flex items-center justify-between text-ink-500">
            <span className="text-xs font-mono">Chủ điểm đã luyện</span>
            <TrendingUp className="w-4 h-4 text-french-bordeaux" />
          </div>
          <p className="font-serif font-bold text-2xl text-french-bordeaux">
            {stats ? Object.keys(stats.rules_breakdown || {}).length : 0}
            <span className="text-xs font-mono text-ink-400 font-normal">
              {' '}
              / {rules.length || 7}
            </span>
          </p>
          <span className="text-[11px] text-ink-400 block">Độ bao phủ quy tắc</span>
        </div>
      </div>

      {/* Rule Mastery Table */}
      <div className="bg-white border border-stone-border rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif font-bold text-base text-ink-900">
            Bảng theo dõi độ thuần thục theo chủ điểm
          </h3>
          <span className="text-xs font-mono text-ink-400">
            {rules.length} chủ điểm trong chương trình
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-stone-border text-ink-500 font-mono">
                <th className="pb-2.5 font-medium">Chủ điểm ngữ pháp</th>
                <th className="pb-2.5 font-medium text-center">Cấp độ</th>
                <th className="pb-2.5 font-medium text-center">Số câu đã viết</th>
                <th className="pb-2.5 font-medium text-center">Tỷ lệ đúng</th>
                <th className="pb-2.5 font-medium text-center">Điểm TB</th>
                <th className="pb-2.5 font-medium text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rules.map((rule) => {
                const stat = stats?.rules_breakdown?.[rule.id]
                const attempts = stat?.attempts ?? 0
                const accuracy = stat?.accuracy_rate ?? 0
                const avgScore = stat?.average_score ?? 0

                return (
                  <tr key={rule.id} className="hover:bg-parchment-50 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="font-serif font-medium text-ink-900 text-sm">
                        {rule.name}
                      </div>
                      <div className="text-[11px] text-ink-400 font-mono truncate max-w-xs">
                        {rule.formula}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="px-2 py-0.5 bg-stone-100 text-ink-700 font-mono text-[10px] rounded">
                        {rule.level}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-ink-800">
                      {attempts > 0 ? `${attempts} câu` : '—'}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {attempts > 0 ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-stone-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                accuracy >= 80
                                  ? 'bg-emerald-600'
                                  : accuracy >= 50
                                  ? 'bg-amber-600'
                                  : 'bg-red-600'
                              }`}
                              style={{ width: `${accuracy}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-ink-700">{accuracy}%</span>
                        </div>
                      ) : (
                        <span className="text-ink-400 font-mono text-xs">Chưa học</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center font-mono font-medium text-ink-900">
                      {attempts > 0 ? `${avgScore}/10` : '—'}
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <button
                        type="button"
                        onClick={() => onPracticeRule(rule.id)}
                        className="px-2.5 py-1 bg-white hover:bg-stone-subtle text-french-bordeaux hover:text-red-900 border border-stone-border rounded font-mono text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
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
            <h3 className="font-serif font-bold text-base text-ink-900">
              Nhật ký câu đã viết (Practice History)
            </h3>
            <p className="text-xs text-ink-500">
              Xem lại các câu bạn đã sáng tác, lỗi sai phát hiện và lời khuyên sửa chữa
            </p>
          </div>

          {/* History Filters */}
          <div className="flex items-center gap-2">
            {/* Rule Filter */}
            <select
              value={selectedRuleFilter}
              onChange={(e) => handleFilterRuleChange(e.target.value)}
              className="bg-white border border-stone-border rounded text-xs px-2.5 py-1.5 text-ink-800 font-mono"
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
              className="bg-white border border-stone-border rounded text-xs px-2.5 py-1.5 text-ink-800"
            >
              <option value="all">Tất cả kết quả</option>
              <option value="correct">Chỉ câu đúng</option>
              <option value="needs_work">Cần cải thiện</option>
            </select>
          </div>
        </div>

        {/* History List */}
        {filteredHistory.length === 0 ? (
          <div className="p-12 text-center bg-white border border-dashed border-stone-300 rounded-lg space-y-2">
            <BookOpen className="w-8 h-8 mx-auto text-ink-300" />
            <p className="font-serif text-sm text-ink-700">Chưa có bản ghi thực hành nào.</p>
            <p className="text-xs text-ink-500">
              Hãy mở tài liệu đọc hoặc chọn một chủ điểm ngữ pháp để tạo câu đầu tiên!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((item) => {
              const feedback = item.feedback
              const diffTokens = feedback?.diff_tokens

              return (
                <div
                  key={item.id}
                  className="bg-white border border-stone-border rounded-lg p-4 space-y-3 hover:border-stone-400 transition-colors"
                >
                  {/* Meta Bar */}
                  <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                          item.is_correct
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {item.is_correct ? 'Đạt chuẩn' : 'Cần sửa'}
                      </span>
                      <span className="text-xs font-serif font-bold text-ink-900">
                        {getRuleName(item.rule_id)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-ink-400 font-mono">
                      <span className="font-bold text-ink-800">{item.score}/10 điểm</span>
                      {item.created_at && (
                        <span className="flex items-center gap-1 text-[11px]">
                          <Calendar className="w-3 h-3" />
                          {formatDate(item.created_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sentences & Diff */}
                  <div className="space-y-2">
                    <div>
                      <span className="text-[11px] font-mono text-ink-400 block mb-0.5">
                        Câu bạn đã viết:
                      </span>
                      <p className="font-serif text-ink-900 text-sm italic bg-parchment-50 p-2.5 rounded border border-stone-border">
                        « {item.user_sentence} »
                      </p>
                    </div>

                    {/* Diff viewer or corrected sentence */}
                    {diffTokens && diffTokens.length > 0 ? (
                      <div>
                        <span className="text-[11px] font-mono text-ink-400 block mb-0.5">
                          Đối chiếu sửa lỗi:
                        </span>
                        <DiffViewer tokens={diffTokens} className="text-sm p-2.5" />
                      </div>
                    ) : item.corrected_sentence && item.corrected_sentence !== item.user_sentence ? (
                      <div>
                        <span className="text-[11px] font-mono text-ink-400 block mb-0.5">
                          Câu gợi ý sửa:
                        </span>
                        <p className="font-serif text-emerald-900 text-sm bg-emerald-50/50 p-2.5 rounded border border-emerald-200">
                          {item.corrected_sentence}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {/* Pedagogical feedback */}
                  {feedback?.error_explanation && (
                    <div className="text-xs text-ink-700 bg-stone-subtle p-2.5 rounded border border-stone-border flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-french-bordeaux shrink-0 mt-0.5" />
                      <span>{feedback.error_explanation}</span>
                    </div>
                  )}

                  {/* Positive note */}
                  {feedback?.positive_feedback && (
                    <div className="text-xs text-emerald-800 bg-emerald-50/40 p-2 rounded flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
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
