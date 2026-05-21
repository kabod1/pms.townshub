import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserPlus, UserCheck, Building2 } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useOwners } from '@/hooks/useOwners'
import type { PropertyOwner } from '@/types/database'

function maskIban(iban: string | null): string {
  if (!iban) return '—'
  if (iban.length <= 4) return iban
  return `${'•'.repeat(iban.length - 4)}${iban.slice(-4)}`
}

export default function OwnersList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const { data: owners, isLoading } = useOwners()

  const filtered = (owners ?? []).filter((o) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      o.first_name.toLowerCase().includes(q) ||
      o.last_name.toLowerCase().includes(q) ||
      (o.email ?? '').toLowerCase().includes(q) ||
      (o.company_name ?? '').toLowerCase().includes(q)
    )
  })

  const columns = [
    {
      key: 'name',
      header: 'Owner',
      render: (o: PropertyOwner) => (
        <div>
          <p className="font-medium text-body">
            {o.first_name} {o.last_name}
          </p>
          {o.company_name && (
            <p className="text-xs text-subtext flex items-center gap-1">
              <Building2 size={11} />
              {o.company_name}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (o: PropertyOwner) => (
        <div className="text-xs space-y-0.5">
          <p>{o.email ?? '—'}</p>
          <p className="text-subtext">{o.phone ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'fee',
      header: 'Mgmt Fee',
      render: (o: PropertyOwner) => (
        <span className="text-sm">
          {o.management_fee_type === 'percentage'
            ? `${o.management_fee_rate}%`
            : `${o.management_fee_rate} (fixed)`}
        </span>
      ),
    },
    {
      key: 'iban',
      header: 'IBAN',
      render: (o: PropertyOwner) => (
        <span className="text-xs font-mono text-subtext">{maskIban(o.bank_iban)}</span>
      ),
    },
    {
      key: 'portal',
      header: 'Portal',
      render: (o: PropertyOwner) =>
        o.portal_access ? (
          <Badge label="Active" className="bg-green-100 text-green-800" />
        ) : (
          <Badge label="None" className="bg-gray-100 text-gray-500" />
        ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-body">Owners</h1>
          <Button size="sm" onClick={() => navigate('/owners/new')}>
            <UserPlus size={16} /> Add Owner
          </Button>
        </div>

        <Input
          placeholder="Search by name, email or company..."
          leftIcon={<Search size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<UserCheck size={40} />}
            title="No owners yet"
            description="Add property owners to start managing their portfolios."
          />
        ) : (
          <Table
            columns={columns}
            data={filtered}
            keyExtractor={(o) => o.id}
            onRowClick={(o) => navigate(`/owners/${o.id}`)}
            emptyMessage="No owners match your search"
          />
        )}
      </div>
    </DashboardLayout>
  )
}
