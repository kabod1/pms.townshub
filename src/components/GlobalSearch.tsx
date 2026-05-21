import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, CalendarDays, Users, BedDouble, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { classNames } from '@/lib/utils'

interface SearchResult {
  type: 'booking' | 'guest' | 'room'
  id: string
  title: string
  subtitle: string
  href: string
}

function useGlobalSearch(query: string) {
  const { tenant } = useAuthStore()
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query.trim() || !tenant || query.length < 2) {
      setResults([])
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      setLoading(true)
      try {
        const q = query.trim()
        const [bookingsRes, guestsRes, roomsRes] = await Promise.all([
          supabase
            .from('bookings')
            .select('id, booking_reference, guest:guests(first_name, last_name), check_in_date, status')
            .eq('tenant_id', tenant.id)
            .ilike('booking_reference', `%${q}%`)
            .limit(5),
          supabase
            .from('guests')
            .select('id, first_name, last_name, email, phone')
            .eq('tenant_id', tenant.id)
            .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
            .limit(5),
          supabase
            .from('rooms')
            .select('id, number, status, room_type:room_types(name)')
            .eq('tenant_id', tenant.id)
            .ilike('number', `%${q}%`)
            .limit(5),
        ])

        if (controller.signal.aborted) return

        const bookingResults: SearchResult[] = (bookingsRes.data ?? []).map((b) => {
          const guest = b.guest as unknown as { first_name: string; last_name: string } | null
          return {
            type: 'booking' as const,
            id: b.id,
            title: b.booking_reference,
            subtitle: guest
              ? `${guest.first_name} ${guest.last_name} · ${b.check_in_date} · ${b.status}`
              : b.check_in_date,
            href: `/bookings/${b.id}`,
          }
        })

        const guestResults: SearchResult[] = (guestsRes.data ?? []).map((g) => ({
          type: 'guest',
          id: g.id,
          title: `${g.first_name} ${g.last_name}`,
          subtitle: [g.email, g.phone].filter(Boolean).join(' · ') || 'No contact info',
          href: `/guests/${g.id}`,
        }))

        const roomResults: SearchResult[] = (roomsRes.data ?? []).map((r) => {
          const roomType = r.room_type as unknown as { name: string } | null
          return {
            type: 'room' as const,
            id: r.id,
            title: `Room ${r.number}`,
            subtitle: `${roomType?.name ?? 'No type'} · ${r.status.replace('_', ' ')}`,
            href: '/rooms',
          }
        })

        setResults([...bookingResults, ...guestResults, ...roomResults])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(timeout)
    }
  }, [query, tenant])

  return { results, loading }
}

const TYPE_ICONS = {
  booking: <CalendarDays size={14} />,
  guest: <Users size={14} />,
  room: <BedDouble size={14} />,
}

const TYPE_LABELS = {
  booking: 'Booking',
  guest: 'Guest',
  room: 'Room',
}

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { results, loading } = useGlobalSearch(query)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setSelected(0)
  }, [results])

  function handleSelect(result: SearchResult) {
    navigate(result.href)
    onClose()
    setQuery('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter' && results[selected]) {
      handleSelect(results[selected])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Search panel */}
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl ring-1 ring-mid overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-mid">
          <Search size={18} className="shrink-0 text-subtext" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search bookings, guests, rooms…"
            className="flex-1 text-sm text-body placeholder:text-subtext bg-transparent outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-subtext hover:text-body">
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-mid px-1.5 text-xs text-subtext">
            Esc
          </kbd>
        </div>

        {/* Results */}
        {query.length >= 2 && (
          <div className="max-h-80 overflow-y-auto py-2">
            {loading && (
              <div className="flex justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-navy border-t-transparent" />
              </div>
            )}

            {!loading && results.length === 0 && (
              <p className="py-8 text-center text-sm text-subtext">
                No results for &quot;{query}&quot;
              </p>
            )}

            {!loading && results.length > 0 && (
              <ul>
                {results.map((result, i) => (
                  <li key={`${result.type}-${result.id}`}>
                    <button
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelected(i)}
                      className={classNames(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        i === selected ? 'bg-light' : 'hover:bg-light/60',
                      )}
                    >
                      <span className={classNames(
                        'shrink-0 rounded-md p-1.5',
                        result.type === 'booking' ? 'bg-blue-100 text-blue-700' :
                        result.type === 'guest' ? 'bg-green-100 text-green-700' :
                        'bg-amber-100 text-amber-700',
                      )}>
                        {TYPE_ICONS[result.type]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-body truncate">{result.title}</p>
                        <p className="text-xs text-subtext truncate">{result.subtitle}</p>
                      </div>
                      <span className="shrink-0 text-xs text-subtext">{TYPE_LABELS[result.type]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!query && (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-subtext">Type at least 2 characters to search</p>
            <div className="mt-3 flex items-center justify-center gap-4 text-xs text-subtext">
              <span className="flex items-center gap-1"><CalendarDays size={12} /> Bookings by reference</span>
              <span className="flex items-center gap-1"><Users size={12} /> Guests by name or email</span>
              <span className="flex items-center gap-1"><BedDouble size={12} /> Rooms by number</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
