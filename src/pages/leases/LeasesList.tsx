import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Key } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useLeases } from '@/hooks/useLeases'
import { formatDate } from '@/lib/utils'
import type { Lease } from '@/types/database'

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'renewed', label: 'Renewed' },
]

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-800',
  expired: 'bg-amber-100 text-amber-800',
  terminated: 'bg-red-100 text-red-700',
  renewed: 'bg-blue-100 text-blue-800',
}

export default function LeasesList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const { data: leases, isLoading } = useLeases(statusFilter ? { status: statusFilter } : undefined)

  const filtered = (leases ?? []).filter((l) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      l.lease_reference.toLowerCase().includes(q)
    )
  })

  const columns = [
    {
      key: 'reference',
      header: 'Lease Reference',
      render: (l: Lease) => (
        <span className="font-mono text-sm font-medium text-body">{l.lease_reference}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (l: Lease) => (
        <Badge
          label={l.status.charAt(0).toUpperCase() + l.status.slice(1)}
          className={STATUS_STYLES[l.status] ?? 'bg-gray-100 text-gray-700'}
        />
      ),
    },
    {
      key: 'rent',
      header: 'Monthly Rent',
      render: (l: Lease) => (
        <span className="text-sm font-medium">{l.monthly_rent.toLocaleString()}</span>
      ),
    },
    {
      key: 'dates',
      header: 'Period',
      render: (l: Lease) => (
        <div className="text-xs text-subtext space-y-0.5">
          <p>From: {formatDate(l.start_date)}</p>
          <p>{l.end_date ? `To: ${formatDate(l.end_date)}` : 'Rolling'}</p>
        </div>
      ),
    },
    {
      key: 'deposit',
      header: 'Deposit',
      render: (l: Lease) =>
        l.deposit_paid ? (
          <Badge label="Paid" className="bg-green-100 text-green-800" />
        ) : (
          <Badge label="Unpaid" className="bg-red-100 text-red-700" />
        ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-body">Leases</h1>
          <Button size="sm" onClick={() => navigate('/leases/new')}>
            <Plus size={16} /> New Lease
          </Button>
        </div>

        <div className="flex gap-3">
          <Input
            placeholder="Search by lease reference..."
            leftIcon={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-48"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Key size={40} />}
            title="No leases yet"
            description="Create a lease to start managing rental agreements."
          />
        ) : (
          <Table
            columns={columns}
            data={filtered}
            keyExtractor={(l) => l.id}
            onRowClick={(l) => navigate(`/leases/${l.id}`)}
            emptyMessage="No leases match your search"
          />
        )}
      </div>
    </DashboardLayout>
  )
}
