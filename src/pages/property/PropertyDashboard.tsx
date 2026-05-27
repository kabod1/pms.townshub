import { Link } from 'react-router-dom'
import {
  Home, Building2, CheckCircle2, Clock, Wrench, Plus, ChevronRight,
  DollarSign, AlertCircle, Key,
} from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { StatCard } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useProperties, useUnits } from '@/hooks/useProperties'
import { useRentSummary } from '@/hooks/useRentCollection'
import { useExpiringLeases } from '@/hooks/useLeases'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatDate, formatCurrency } from '@/lib/utils'

function useOpenMaintenanceCount() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['property-maintenance-open-count', tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('property_maintenance')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', useAuthStore.getState().tenant!.id)
        .in('status', ['reported', 'assessed', 'quoted', 'approved', 'in_progress'])
      if (error) throw error
      return count ?? 0
    },
  })
}

export default function PropertyDashboard() {
  const { tenant } = useAuthStore()
  const { data: properties = [], isLoading: propertiesLoading } = useProperties()
  const { data: units = [], isLoading: unitsLoading } = useUnits()
  const { data: rentSummary } = useRentSummary()
  const { data: expiringLeases = [] } = useExpiringLeases(30)
  const { data: openMaintenance = 0 } = useOpenMaintenanceCount()

  const isLoading = propertiesLoading || unitsLoading

  const totalProperties = properties.length
  const activeProperties = properties.filter((p) => p.is_active).length
  const totalUnits = units.length
  const occupiedUnits = units.filter((u) => u.status === 'occupied').length
  const vacantUnits = units.filter((u) => u.status === 'vacant').length

  const recentProperties = [...properties]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  if (isLoading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-body">Property Dashboard</h1>
            <p className="text-sm text-subtext mt-0.5">
              Overview of your property portfolio
            </p>
          </div>
          <Link to="/properties/new">
            <Button size="md">
              <Plus size={16} />
              Add Property
            </Button>
          </Link>
        </div>

        {/* Summary Cards — Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Total Properties"
            value={totalProperties}
            subtitle={`${activeProperties} active`}
            icon={<Home size={20} />}
            color="navy"
          />
          <StatCard
            title="Total Units"
            value={totalUnits}
            icon={<Building2 size={20} />}
            color="blue"
          />
          <StatCard
            title="Occupied Units"
            value={occupiedUnits}
            subtitle={totalUnits > 0 ? `${Math.round((occupiedUnits / totalUnits) * 100)}% occupancy` : undefined}
            icon={<CheckCircle2 size={20} />}
            color="green"
          />
          <StatCard
            title="Vacant Units"
            value={vacantUnits}
            icon={<Clock size={20} />}
            color="gold"
          />
          <StatCard
            title="Pending Maintenance"
            value={openMaintenance}
            subtitle="Open requests"
            icon={<Wrench size={20} />}
            color={openMaintenance > 0 ? 'gold' : 'blue'}
          />
        </div>

        {/* Summary Cards — Row 2 (Financial) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Rent Collected (MTD)"
            value={formatCurrency(rentSummary?.totalCollectedThisMonth ?? 0, tenant?.currency)}
            subtitle={rentSummary && rentSummary.totalDueThisMonth > 0
              ? `${Math.round((rentSummary.totalCollectedThisMonth / rentSummary.totalDueThisMonth) * 100)}% of ${formatCurrency(rentSummary.totalDueThisMonth, tenant?.currency)} due`
              : 'No rent due this month'}
            icon={<DollarSign size={20} />}
            color="green"
          />
          <StatCard
            title="Overdue Rent"
            value={formatCurrency(rentSummary?.totalOverdueAmount ?? 0, tenant?.currency)}
            subtitle={`${rentSummary?.overdueCount ?? 0} overdue entries`}
            icon={<AlertCircle size={20} />}
            color={rentSummary && rentSummary.totalOverdueAmount > 0 ? 'gold' : 'green'}
          />
          <StatCard
            title="Leases Expiring (30d)"
            value={expiringLeases.length}
            subtitle={expiringLeases.length > 0 ? 'Requires attention' : 'No upcoming expirations'}
            icon={<Key size={20} />}
            color={expiringLeases.length > 0 ? 'gold' : 'blue'}
          />
          <StatCard
            title="Upcoming Payments (7d)"
            value={formatCurrency(rentSummary?.upcomingAmount ?? 0, tenant?.currency)}
            subtitle={`${rentSummary?.upcomingCount ?? 0} payments`}
            icon={<Clock size={20} />}
            color="navy"
          />
        </div>

        {/* Expiring Leases Alert */}
        {expiringLeases.length > 0 && (
          <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 p-4">
            <div className="flex items-start gap-3">
              <Key size={18} className="text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-900">
                  {expiringLeases.length} lease{expiringLeases.length > 1 ? 's' : ''} expiring within 30 days
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {expiringLeases.slice(0, 4).map((lease) => {
                    const unit = lease.unit
                    const renter = lease.property_tenant
                    const renterName = renter ? `${renter.first_name} ${renter.last_name}` : '—'
                    return (
                      <Link
                        key={lease.id}
                        to={`/leases/${lease.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200 transition-colors"
                      >
                        <span>{unit?.unit_number ?? lease.unit_id.slice(0, 6)}</span>
                        <span className="text-amber-600">·</span>
                        <span>{renterName}</span>
                        <span className="text-amber-600">·</span>
                        <span>{formatDate(lease.end_date!)}</span>
                      </Link>
                    )
                  })}
                  {expiringLeases.length > 4 && (
                    <Link
                      to="/leases"
                      className="inline-flex items-center rounded-lg bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200 transition-colors"
                    >
                      +{expiringLeases.length - 4} more
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Properties */}
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-mid">
            <h2 className="text-sm font-semibold text-body">Recent Properties</h2>
            <Link
              to="/properties"
              className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View all <ChevronRight size={14} />
            </Link>
          </div>

          {recentProperties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Home size={32} className="text-subtext mb-3" />
              <p className="text-sm font-medium text-body">No properties yet</p>
              <p className="text-xs text-subtext mt-1">Add your first property to get started</p>
              <Link to="/properties/new" className="mt-4">
                <Button size="sm">
                  <Plus size={14} />
                  Add Property
                </Button>
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-mid">
              {recentProperties.map((property) => {
                const ownerName = property.owner
                  ? property.owner.company_name
                    ? property.owner.company_name
                    : `${property.owner.first_name} ${property.owner.last_name}`
                  : null

                // Count units for this property
                const propUnits = units.filter((u) => u.property_id === property.id)
                const propOccupied = propUnits.filter((u) => u.status === 'occupied').length

                return (
                  <li key={property.id}>
                    <Link
                      to={`/properties/${property.id}`}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-light transition-colors"
                    >
                      <div className="h-9 w-9 rounded-lg bg-navy/10 flex items-center justify-center shrink-0">
                        <Home size={18} className="text-navy" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-body truncate">{property.name}</p>
                        <p className="text-xs text-subtext truncate">
                          {property.city} {ownerName ? `· ${ownerName}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {propUnits.length > 0 && (
                          <span className="text-xs text-subtext">
                            {propOccupied}/{propUnits.length} occupied
                          </span>
                        )}
                        <Badge
                          label={property.type.replace('_', ' ')}
                          className="bg-blue-50 text-blue-700 capitalize"
                        />
                        <Badge
                          label={property.is_active ? 'Active' : 'Inactive'}
                          className={property.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}
                        />
                        <span className="text-xs text-subtext">{formatDate(property.created_at)}</span>
                        <ChevronRight size={14} className="text-subtext" />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
