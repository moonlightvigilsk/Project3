import React from 'react'
import type { DiffToken } from '../../types'

interface DiffViewerProps {
  tokens: DiffToken[]
  className?: string
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ tokens, className = '' }) => {
  if (!tokens || tokens.length === 0) {
    return null
  }

  return (
    <div
      data-testid="diff-viewer"
      className={`font-serif text-base leading-relaxed p-3.5 bg-white border border-stone-border rounded flex flex-wrap items-baseline gap-x-1.5 gap-y-1 ${className}`}
    >
      {tokens.map((token, index) => {
        if (token.type === 'same') {
          return (
            <span key={index} className="text-ink-900">
              {token.text}
            </span>
          )
        }

        if (token.type === 'removed') {
          return (
            <span
              key={index}
              data-testid="diff-removed"
              className="line-through text-red-700 bg-red-50 border border-red-200 px-1 py-0.5 rounded text-sm select-none"
              title="Đoạn thừa hoặc viết sai"
            >
              {token.text}
            </span>
          )
        }

        if (token.type === 'added') {
          return (
            <span
              key={index}
              data-testid="diff-added"
              className="text-emerald-800 bg-emerald-50 border border-emerald-300 font-medium px-1 py-0.5 rounded text-sm"
              title="Từ cần thêm vào"
            >
              {token.text}
            </span>
          )
        }

        if (token.type === 'replaced') {
          return (
            <span
              key={index}
              data-testid="diff-replaced"
              className="inline-flex items-baseline gap-1"
            >
              <span
                className="line-through text-red-700 bg-red-50 border border-red-200 px-1 py-0.5 rounded text-sm select-none"
                title="Từ nguyên bản viết sai"
              >
                {token.original}
              </span>
              <span className="text-stone-400 text-xs font-mono">→</span>
              <span
                className="text-emerald-800 bg-emerald-50 border border-emerald-300 font-medium px-1 py-0.5 rounded text-sm"
                title="Từ gợi ý sửa đúng"
              >
                {token.replacement}
              </span>
            </span>
          )
        }

        return (
          <span key={index} className="text-ink-900">
            {token.text}
          </span>
        )
      })}
    </div>
  )
}
