import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserPlus, Users, Download } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Table } from '@/components/ui/Table'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useGuests } from '@/hooks/useGuests'
import { formatDate } from '@/lib/utils'
import type { Guest } from '@/types'

function exportGuestsCSV(guests: Guest[]) {
  const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Nationality', 'Total Stays', 'Registered']
  const rows = guests.map((g) => [g.first_name, g.last_name, g.email ?? '', g.phone ?? '', g.nationality ?? '', g.total_stays, formatDate(g.created_at)])
  const csv = [headers, ...rows].map((r) => r.map(String).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `guests_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function GuestDirectory() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const { data: guests, isLoading } = useGuests(search || undefined)
  const handleExport = useCallback(() => exportGuestsCSV(guests ?? []), [guests])

  const columns = [
    {
      key: 'name',
      header: 'Guest',
      render: (g: Guest) => (
        <div>
          <p className="font-medium">{g.first_name} {g.last_name}</p>
          <p className="text-xs text-subtext">{g.nationality ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      className: 'hidden sm:table-cell',
      render: (g: Guest) => (
        <div className="text-xs space-y-0.5">
          <p>{g.email ?? '—'}</p>
          <p className="text-subtext">{g.phone ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'stays',
      header: 'Total Stays',
      render: (g: Guest) => <span className="font-medium">{g.total_stays}</span>,
    },
    {
      key: 'created',
      header: 'Registered',
      render: (g: Guest) => (
        <span className="text-xs text-subtext">{formatDate(g.created_at)}</span>
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-body">Guest Directory</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!guests?.length}>
              <Download size={16} /> Export
            </Button>
            <Button size="sm" onClick={() => navigate('/guests/new')}>
              <UserPlus size={16} /> Add Guest
            </Button>
          </div>
        </div>

        <Input
          placeholder="Search by name or email..."
          leftIcon={<Search size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : (guests ?? []).length === 0 ? (
          <EmptyState
            icon={<Users size={40} />}
            title="No guests yet"
            description="Guests are created automatically when you add bookings."
          />
        ) : (
          <Table
            columns={columns}
            data={guests ?? []}
            keyExtractor={(g) => g.id}
            onRowClick={(g) => navigate(`/guests/${g.id}`)}
            emptyMessage="No guests found"
          />
        )}
      </div>
    </DashboardLayout>
  )
}
