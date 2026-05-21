import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserPlus, Users } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Table } from '@/components/ui/Table'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useGuests } from '@/hooks/useGuests'
import { formatDate } from '@/lib/utils'
import type { Guest } from '@/types'

export default function GuestDirectory() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const { data: guests, isLoading } = useGuests(search || undefined)

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
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-body">Guest Directory</h1>
          <Button size="sm" onClick={() => navigate('/guests/new')}>
            <UserPlus size={16} /> Add Guest
          </Button>
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
