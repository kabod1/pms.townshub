import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Plus, Search } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { useUnits, useProperties } from '@/hooks/useProperties'
import type { UnitStatus } from '@/types/database'

const UNIT_STATUS_COLORS: Record<UnitStatus, string> = {
  vacant: 'bg-green-50 text-green-700',
  occupied: 'bg-blue-50 text-blue-700',
  reserved: 'bg-amber-50 text-amber-700',
  maintenance: 'bg-red-50 text-red-700',
  not_available: 'bg-gray-100 text-gray-500',
}

const UNIT_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All Statuses' },
  { value: 'vacant', label: 'Vacant' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'not_available', label: 'Not Available' },
]

const UNIT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All Types' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'studio', label: 'Studio' },
  { value: 'villa', label: 'Villa' },
  { value: 'penthouse', label: 'Penthouse' },
  { value: 'maisonette', label: 'Maisonette' },
  { value: 'room', label: 'Room' },
  { value: 'office', label: 'Office' },
  { value: 'retail', label: 'Retail' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'desk', label: 'Desk' },
  { value: 'other', label: 'Other' },
]

function UnitSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-5 py-3"><div className="h-4 bg-gray-100 rounded w-16" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-100 rounded w-24" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-100 rounded w-16" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-100 rounded w-8" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-100 rounded w-12" /></td>
      <td className="px-4 py-3"><div className="h-6 bg-gray-100 rounded-full w-20" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-100 rounded w-16" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-100 rounded w-8" /></td>
    </tr>
  )
}

export default function UnitsList() {
  const navigate = useNavigate()
  const { data: units = [], isLoading } = useUnits()
  const { data: properties = [] } = useProperties()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [propertyFilter, setPropertyFilter] = useState('')

  const filtered = units.filter((u) => {
    const searchLower = search.toLowerCase()
    const matchesSearch = !search || u.unit_number.toLowerCase().includes(searchLower)
    const matchesStatus = !statusFilter || u.status === statusFilter
    const matchesType = !typeFilter || u.type === typeFilter
    const matchesProperty = !propertyFilter || u.property_id === propertyFilter
    return matchesSearch && matchesStatus && matchesType && matchesProperty
  })

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-body">Units</h1>
            <p className="text-sm text-subtext mt-0.5">
              {units.length} unit{units.length === 1 ? '' : 's'} total
            </p>
          </div>
          <Button onClick={() => navigate('/units/new')}>
            <Plus size={16} />
            Add Unit
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by unit number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search size={15} />}
            />
          </div>
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
          >
            <option value="">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
          >
            {UNIT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
          >
            {UNIT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        {!isLoading && filtered.length === 0 ? (
          <EmptyState
            icon={<Building2 size={40} />}
            title="No units found"
            description={
              search || statusFilter || typeFilter || propertyFilter
                ? 'No units match your current filters.'
                : 'Add your first unit to get started.'
            }
            action={
              !search && !statusFilter && !typeFilter && !propertyFilter
                ? { label: 'Add Unit', onClick: () => navigate('/units/new') }
                : undefined
            }
          />
        ) : (
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mid bg-light">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">Unit #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">Property</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">Floor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">Area</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">Rent</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">Furnished</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mid">
                {isLoading
                  ? [...Array(6)].map((_, i) => <UnitSkeleton key={i} />)
                  : filtered.map((unit) => {
                      const propertyName =
                        (unit.property as { name?: string } | undefined)?.name ??
                        properties.find((p) => p.id === unit.property_id)?.name ??
                        '—'

                      return (
                        <tr
                          key={unit.id}
                          onClick={() => navigate(`/units/${unit.id}`)}
                          className="hover:bg-light cursor-pointer transition-colors"
                        >
                          <td className="px-5 py-3 font-medium text-body">{unit.unit_number}</td>
                          <td className="px-4 py-3 text-subtext truncate max-w-[160px]">{propertyName}</td>
                          <td className="px-4 py-3 text-subtext capitalize">{unit.type}</td>
                          <td className="px-4 py-3 text-subtext">
                            {unit.floor != null ? `${unit.floor}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-subtext">
                            {unit.area_sqm ? `${unit.area_sqm} m²` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              label={unit.status.replace('_', ' ')}
                              className={UNIT_STATUS_COLORS[unit.status]}
                            />
                          </td>
                          <td className="px-4 py-3 text-subtext">
                            {unit.market_rent ? `€${unit.market_rent}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-subtext capitalize">
                            {unit.furnished.replace('_', ' ')}
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
