/**
 * OfflineIndicator
 * Shows a persistent banner when the user loses internet connectivity.
 * Automatically hides when they come back online.
 */
import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

export function OfflineIndicator() {
  const [online, setOnline]         = useState(navigator.onLine)
  const [justReconnected, setJust]  = useState(false)

  useEffect(() => {
    function handleOnline() {
      setOnline(true)
      setJust(true)
      setTimeout(() => setJust(false), 3000)
    }
    function handleOffline() {
      setOnline(false)
      setJust(false)
    }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Fully online and not showing "reconnected" toast → render nothing
  if (online && !justReconnected) return null

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold transition-all duration-500 ${
        online ? 'bg-green-600' : 'bg-red-600'
      } text-white`}
    >
      {online ? (
        <>
          <Wifi size={14} className="shrink-0" />
          Back online
        </>
      ) : (
        <>
          <WifiOff size={14} className="shrink-0" />
          No internet connection — some features may be unavailable
        </>
      )}
    </div>
  )
}
