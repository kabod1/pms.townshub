import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserPlus, Users } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useRenters } from '@/hooks/useRenters'
import type { PropertyTenant } from '@/types/database'

const TENANT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'individual', label: 'Individual' },
  { value: 'company', label: 'Company' },
]

export default function RentersList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const { data: renters, isLoading } = useRenters()

  const filtered = (renters ?? []).filter((r) => {
    const matchesType = !typeFilter || r.tenant_type === typeFilter
    if (!matchesType) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.first_name.toLowerCase().includes(q) ||
      r.last_name.toLowerCase().includes(q) ||
      (r.email ?? '').toLowerCase().includes(q) ||
      (r.company_name ?? '').toLowerCase().includes(q)
    )
  })

  const columns = [
    {
      key: 'name',
      header: 'Renter',
      render: (r: PropertyTenant) => (
        <div>
          <p className="font-medium text-body">
            {r.first_name} {r.last_name}
          </p>
          {r.tenant_type === 'company' && r.company_name && (
            <p className="text-xs text-subtext">{r.company_name}</p>
          )}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (r: PropertyTenant) => (
        <div className="text-xs space-y-0.5">
          <p>{r.email ?? '—'}</p>
          <p className="text-subtext">{r.phone ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'nationality',
      header: 'Nationality',
      render: (r: PropertyTenant) => (
        <span className="text-sm text-subtext">{r.nationality ?? '—'}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (r: PropertyTenant) => (
        <Badge
          label={r.tenant_type === 'company' ? 'Company' : 'Individual'}
          className={
            r.tenant_type === 'company'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-700'
          }
        />
      ),
    },
    {
      key: 'properties',
      header: 'Rentals',
      render: (r: PropertyTenant) => (
        <span className="text-sm font-medium">{r.total_properties_rented}</span>
      ),
    },
    {
      key: 'tags',
      header: 'Tags',
      render: (r: PropertyTenant) => (
        <div className="flex flex-wrap gap-1">
          {(r.tags ?? []).slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
            >
              {tag}
            </span>
          ))}
          {(r.tags ?? []).length > 3 && (
            <span className="text-xs text-subtext">+{r.tags.length - 3}</span>
          )}
        </div>
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-body">Renters</h1>
          <Button size="sm" onClick={() => navigate('/renters/new')}>
            <UserPlus size={16} /> Add Renter
          </Button>
        </div>

        <div className="flex gap-3">
          <Input
            placeholder="Search by name or email..."
            leftIcon={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select
            options={TENANT_TYPE_OPTIONS}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-44"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users size={40} />}
            title="No renters yet"
            description="Add renters to assign them to leases."
          />
        ) : (
          <Table
            columns={columns}
            data={filtered}
            keyExtractor={(r) => r.id}
            onRowClick={(r) => navigate(`/renters/${r.id}`)}
            emptyMessage="No renters match your search"
          />
        )}
      </div>
    </DashboardLayout>
  )
}
