import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, Plus, Search } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { useProperties } from '@/hooks/useProperties'
import type { PropertyType } from '@/types/database'

const TYPE_LABELS: Record<PropertyType, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  mixed_use: 'Mixed Use',
  land: 'Land',
}

const TYPE_COLORS: Record<PropertyType, string> = {
  residential: 'bg-blue-50 text-blue-700',
  commercial: 'bg-purple-50 text-purple-700',
  mixed_use: 'bg-amber-50 text-amber-700',
  land: 'bg-green-50 text-green-700',
}

const PROPERTY_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All Types' },
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'mixed_use', label: 'Mixed Use' },
  { value: 'land', label: 'Land' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

function PropertySkeleton() {
  return (
    <div className="animate-pulse rounded-xl bg-white shadow-sm ring-1 ring-mid p-5 flex items-center gap-4">
      <div className="h-10 w-10 rounded-lg bg-gray-100" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-100 rounded w-1/3" />
        <div className="h-3 bg-gray-100 rounded w-1/4" />
      </div>
      <div className="h-6 w-20 bg-gray-100 rounded-full" />
    </div>
  )
}

export default function PropertiesList() {
  const navigate = useNavigate()
  const { data: properties = [], isLoading } = useProperties()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const filtered = properties.filter((p) => {
    const searchLower = search.toLowerCase()
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(searchLower) ||
      p.city.toLowerCase().includes(searchLower) ||
      p.address.toLowerCase().includes(searchLower)

    const matchesType = !typeFilter || p.type === typeFilter
    const matchesStatus =
      !statusFilter ||
      (statusFilter === 'active' ? p.is_active : !p.is_active)

    return matchesSearch && matchesType && matchesStatus
  })

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-body">Properties</h1>
            <p className="text-sm text-subtext mt-0.5">
              {properties.length} propert{properties.length === 1 ? 'y' : 'ies'} total
            </p>
          </div>
          <Button onClick={() => navigate('/properties/new')}>
            <Plus size={16} />
            Add Property
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by name, city or address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search size={15} />}
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
          >
            {PROPERTY_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <PropertySkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Home size={40} />}
            title="No properties yet"
            description={
              search || typeFilter || statusFilter
                ? 'No properties match your current filters.'
                : 'Add your first property to start managing your portfolio.'
            }
            action={
              !search && !typeFilter && !statusFilter
                ? { label: 'Add Property', onClick: () => navigate('/properties/new') }
                : undefined
            }
          />
        ) : (
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mid bg-light">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">
                    Property
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">
                    City
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">
                    Units
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">
                    Owner
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mid">
                {filtered.map((property) => {
                  const ownerName = property.owner
                    ? property.owner.company_name ||
                      `${property.owner.first_name} ${property.owner.last_name}`
                    : '—'

                  return (
                    <tr
                      key={property.id}
                      onClick={() => navigate(`/properties/${property.id}`)}
                      className="hover:bg-light cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-navy/10 flex items-center justify-center shrink-0">
                            <Home size={16} className="text-navy" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-body truncate">{property.name}</p>
                            <p className="text-xs text-subtext truncate">{property.address}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          label={TYPE_LABELS[property.type]}
                          className={TYPE_COLORS[property.type]}
                        />
                      </td>
                      <td className="px-4 py-3 text-body">{property.city}</td>
                      <td className="px-4 py-3 text-body">{property.total_units}</td>
                      <td className="px-4 py-3 text-body">{ownerName}</td>
                      <td className="px-4 py-3">
                        <Badge
                          label={property.is_active ? 'Active' : 'Inactive'}
                          className={
                            property.is_active
                              ? 'bg-green-50 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }
                        />
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
