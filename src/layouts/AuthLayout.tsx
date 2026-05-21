import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { user, isLoading, isInitialized } = useAuth()

  if (!isInitialized || isLoading) return <LoadingSpinner fullPage />
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <div className="flex min-h-screen bg-light">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-navy p-12">
        <img src="/logo.jpeg" alt="Townshub" className="h-24 w-auto mb-8 object-contain rounded-2xl shadow-lg" />
        <h1 className="text-3xl font-bold text-white text-center leading-tight">
          Hotel Management,<br />Simplified.
        </h1>
        <p className="mt-4 text-white/80 text-center text-sm max-w-xs">
          The all-in-one cloud PMS for independent hotels and boutique properties across Cyprus and beyond.
        </p>
        <div className="mt-12 grid grid-cols-2 gap-4 w-full max-w-sm">
          {[
            { label: 'Bookings', desc: 'Manage reservations with ease' },
            { label: 'Housekeeping', desc: 'Real-time room status' },
            { label: 'Invoicing', desc: 'Auto-generated VAT invoices' },
            { label: 'Reports', desc: 'Occupancy & revenue analytics' },
          ].map((f) => (
            <div key={f.label} className="rounded-lg bg-white/10 p-3 border border-white/10">
              <p className="text-sm font-semibold text-gold">{f.label}</p>
              <p className="text-xs text-white/70 mt-0.5">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <img src="/logo.png" alt="Townshub" className="h-12 w-auto object-contain" style={{ filter: 'brightness(0)' }} />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
