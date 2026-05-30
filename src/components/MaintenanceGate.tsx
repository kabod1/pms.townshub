import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const DASHBOARD_URL  = import.meta.env.VITE_TOWNSHUB_ADMIN_URL  as string
const DASHBOARD_ANON = import.meta.env.VITE_TOWNSHUB_ADMIN_ANON as string

const isLocalhost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname)

interface MaintenanceState {
  checked: boolean
  active: boolean
  message: string
  reason: string
  estimatedReturn: string | null
}

function MaintenancePage({ message, reason, estimatedReturn }: {
  message: string; reason: string; estimatedReturn: string | null
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-blue-500/10 border border-blue-400/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.4" className="text-blue-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
        </div>

        {/* Logo */}
        <div>
          <p className="text-white font-bold text-2xl tracking-wide">TOWNSHUB</p>
          <p className="text-blue-400 text-sm tracking-widest uppercase">Property Management System</p>
        </div>

        {/* Heading */}
        <div className="space-y-3">
          <h1 className="text-white text-3xl font-bold">Under Maintenance</h1>
          <p className="text-blue-200/80 leading-relaxed text-sm">
            {message || "We're performing scheduled maintenance and upgrades. The system will be back shortly."}
          </p>
        </div>

        {/* Details */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3 text-left">
          {reason && (
            <div className="flex items-center gap-3">
              <span className="text-blue-400 text-xs uppercase tracking-wide w-24 shrink-0">Reason</span>
              <span className="text-white text-sm font-medium">{reason}</span>
            </div>
          )}
          {estimatedReturn && (
            <div className="flex items-center gap-3">
              <span className="text-blue-400 text-xs uppercase tracking-wide w-24 shrink-0">Back online</span>
              <span className="text-white text-sm font-medium">
                {new Date(estimatedReturn).toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="text-blue-400 text-xs uppercase tracking-wide w-24 shrink-0">Status</span>
            <span className="flex items-center gap-1.5 text-amber-400 text-sm font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Maintenance in progress
            </span>
          </div>
        </div>

        <p className="text-blue-400/50 text-xs">
          We apologise for any inconvenience. Your data is safe.
        </p>
      </div>
    </div>
  )
}

export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MaintenanceState>({
    checked: isLocalhost, // skip check on localhost
    active: false,
    message: '',
    reason: '',
    estimatedReturn: null,
  })

  useEffect(() => {
    if (isLocalhost || !DASHBOARD_URL || !DASHBOARD_ANON) {
      setState(s => ({ ...s, checked: true }))
      return
    }

    const client = createClient(DASHBOARD_URL, DASHBOARD_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    client
      .from('maintenance_mode')
      .select('is_active, message, reason, estimated_return')
      .eq('app_id', 'pms')
      .single()
      .then(({ data }) => {
        setState({
          checked: true,
          active: data?.is_active ?? false,
          message: data?.message ?? '',
          reason: data?.reason ?? '',
          estimatedReturn: data?.estimated_return ?? null,
        })
      })
      .catch(() => {
        // If check fails, don't block access
        setState(s => ({ ...s, checked: true }))
      })
  }, [])

  if (!state.checked) return null // brief invisible wait

  if (state.active) {
    return (
      <MaintenancePage
        message={state.message}
        reason={state.reason}
        estimatedReturn={state.estimatedReturn}
      />
    )
  }

  return <>{children}</>
}
