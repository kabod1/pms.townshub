import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-white shadow-lg p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} className="text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-500 mb-1">
            {this.state.message || 'An unexpected error occurred.'}
          </p>
          <p className="text-xs text-gray-400 mb-6">
            This has been logged. If it keeps happening, please contact support.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, message: '' }); window.location.reload() }}
            className="inline-flex items-center gap-2 rounded-xl bg-navy text-white px-5 py-2.5 text-sm font-medium hover:bg-navy/90 transition-colors"
          >
            <RefreshCw size={15} /> Reload page
          </button>
        </div>
      </div>
    )
  }
}
