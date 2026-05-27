import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Key } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
// LoadingSpinner imported for future use
import { EmptyState } from '@/components/ui/EmptyState'
import { useLeases } from '@/hooks/useLeases'
import { formatDate } from '@/lib/utils'
import type { LeaseWithDetails } from '@/hooks/useLeases'

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

function LeaseSkeleton() {
  return (
    <tr className="animate-pulse">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-100 rounded w-24" />
        </td>
      ))}
    </tr>
  )
}

export default function LeasesList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const { data: leases = [], isLoading } = useLeases(statusFilter ? { status: statusFilter } : undefined)

  const filtered = leases.filter((l) => {
    if (!search) return true
    const q = search.toLowerCase()
    const unit = l.unit
    const renter = l.property_tenant
    return (
      l.lease_reference.toLowerCase().includes(q) ||
      (unit?.unit_number ?? '').toLowerCase().includes(q) ||
      (unit?.property?.name ?? '').toLowerCase().includes(q) ||
      (renter ? `${renter.first_name} ${renter.last_name}`.toLowerCase() : '').includes(q)
    )
  })

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-body">Leases</h1>
            <p className="text-sm text-subtext mt-0.5">
              {leases.length} lease{leases.length === 1 ? '' : 's'} total
            </p>
          </div>
          <Button size="sm" onClick={() => navigate('/leases/new')}>
            <Plus size={16} /> New Lease
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by reference, unit or renter…"
              leftIcon={<Search size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-48"
          />
        </div>

        {!isLoading && filtered.length === 0 ? (
          <EmptyState
            icon={<Key size={40} />}
            title="No leases yet"
            description={
              search || statusFilter
                ? 'No leases match your current filters.'
                : 'Create a lease to start managing rental agreements.'
            }
          />
        ) : (
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mid bg-light">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">
                    Reference
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">
                    Renter
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">
                    Unit
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">
                    Monthly Rent
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">
                    Period
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">
                    Deposit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mid">
                {isLoading
                  ? [...Array(6)].map((_, i) => <LeaseSkeleton key={i} />)
                  : filtered.map((lease: LeaseWithDetails) => {
                      const renter = lease.property_tenant
                      const unit = lease.unit
                      const renterName = renter
                        ? `${renter.first_name} ${renter.last_name}`
                        : '—'
                      const unitDisplay = unit
                        ? unit.property
                          ? `${unit.unit_number} (${unit.property.name})`
                          : unit.unit_number
                        : '—'

                      return (
                        <tr
                          key={lease.id}
                          onClick={() => navigate(`/leases/${lease.id}`)}
                          className="hover:bg-light cursor-pointer transition-colors"
                        >
                          <td className="px-5 py-3">
                            <span className="font-mono text-sm font-medium text-body">
                              {lease.lease_reference}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-body">{renterName}</p>
                            {renter?.email && (
                              <p className="text-xs text-subtext truncate max-w-[160px]">{renter.email}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-body text-sm">{unitDisplay}</td>
                          <td className="px-4 py-3">
                            <Badge
                              label={lease.status.charAt(0).toUpperCase() + lease.status.slice(1)}
                              className={STATUS_STYLES[lease.status] ?? 'bg-gray-100 text-gray-700'}
                            />
                          </td>
                          <td className="px-4 py-3 text-body font-medium">
                            {lease.monthly_rent.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-subtext space-y-0.5">
                              <p>From: {formatDate(lease.start_date)}</p>
                              <p>{lease.end_date ? `To: ${formatDate(lease.end_date)}` : 'Rolling'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {lease.deposit_paid ? (
                              <Badge label="Paid" className="bg-green-100 text-green-800" />
                            ) : (
                              <Badge label="Unpaid" className="bg-red-100 text-red-700" />
                            )}
                          </td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
