import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-parchment-100 dark:bg-[#1A1917] text-ink-900 dark:text-[#E8E3DA]">
          <div className="max-w-md w-full bg-white dark:bg-[#242220] border border-stone-border dark:border-[#3A3735] rounded-xl p-6 shadow-md text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold font-serif mb-2">Đã xảy ra sự cố hiển thị</h2>
            <p className="text-xs text-ink-500 dark:text-[#A8A29E] mb-4">
              {this.state.error?.message || 'Có lỗi ngoài ý muốn trong quá trình render.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-ink-900 dark:bg-[#E8E3DA] text-white dark:text-[#1A1917] rounded text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Tải lại trang</span>
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
