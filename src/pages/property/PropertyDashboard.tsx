import { Link } from 'react-router-dom'
import {
  Home, Building2, CheckCircle2, Clock, Wrench, Plus, ChevronRight,
} from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { StatCard } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useProperties, useUnits } from '@/hooks/useProperties'
import { formatDate } from '@/lib/utils'

export default function PropertyDashboard() {
  const { data: properties = [], isLoading: propertiesLoading } = useProperties()
  const { data: units = [], isLoading: unitsLoading } = useUnits()

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

        {/* Summary Cards */}
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
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5 flex items-start gap-4">
            <div className="rounded-lg p-2.5 shrink-0 bg-gray-100 text-subtext">
              <Wrench size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-subtext truncate">Pending Maintenance</p>
              <p className="mt-0.5 text-2xl font-bold text-body">0</p>
              <p className="mt-0.5 text-xs text-subtext italic">Coming soon</p>
            </div>
          </div>
        </div>

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
