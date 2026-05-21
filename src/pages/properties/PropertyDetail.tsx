import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Home, Building2, Edit2, Trash2, MapPin, Calendar,
  Maximize2, ChevronRight, X, Check,
} from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  useProperty,
  useUpdateProperty,
  useDeleteProperty,
  useUnits,
} from '@/hooks/useProperties'
import type { PropertyType, UnitStatus } from '@/types/database'

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

const UNIT_STATUS_COLORS: Record<UnitStatus, string> = {
  vacant: 'bg-green-50 text-green-700',
  occupied: 'bg-blue-50 text-blue-700',
  reserved: 'bg-amber-50 text-amber-700',
  maintenance: 'bg-red-50 text-red-700',
  not_available: 'bg-gray-100 text-gray-500',
}

export default function PropertyDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: property, isLoading } = useProperty(id)
  const { data: units = [] } = useUnits(id)
  const updateProperty = useUpdateProperty()
  const deleteProperty = useDeleteProperty()

  const [activeTab, setActiveTab] = useState<'overview' | 'units'>('overview')
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    )
  }

  if (!property) {
    return (
      <DashboardLayout>
        <EmptyState
          icon={<Home size={40} />}
          title="Property not found"
          action={{ label: 'Back to Properties', onClick: () => navigate('/properties') }}
        />
      </DashboardLayout>
    )
  }

  function startEdit() {
    if (!property) return
    setEditName(property.name)
    setEditDescription(property.description ?? '')
    setEditAddress(property.address)
    setEditing(true)
  }

  async function saveEdit() {
    await updateProperty.mutateAsync({
      id: property!.id,
      name: editName,
      description: editDescription || null,
      address: editAddress,
    })
    setEditing(false)
  }

  async function handleDelete() {
    await deleteProperty.mutateAsync(property!.id)
    navigate('/properties')
  }

  const ownerName = property.owner
    ? property.owner.company_name ||
      `${property.owner.first_name} ${property.owner.last_name}`
    : null

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Back + header */}
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/properties')}
            className="mt-1 rounded-lg p-1.5 text-subtext hover:bg-light transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            {editing ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-xl font-bold"
              />
            ) : (
              <h1 className="text-2xl font-bold text-body truncate">{property.name}</h1>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge label={TYPE_LABELS[property.type]} className={TYPE_COLORS[property.type]} />
              <Badge
                label={property.is_active ? 'Active' : 'Inactive'}
                className={property.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}
              />
              <span className="flex items-center gap-1 text-xs text-subtext">
                <MapPin size={12} /> {property.city}, {property.country}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(false)}
                >
                  <X size={14} /> Cancel
                </Button>
                <Button
                  size="sm"
                  loading={updateProperty.isPending}
                  onClick={saveEdit}
                >
                  <Check size={14} /> Save
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={startEdit}>
                  <Edit2 size={14} /> Edit
                </Button>
                {confirmDelete ? (
                  <>
                    <span className="text-xs text-red-600 font-medium">Sure?</span>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={deleteProperty.isPending}
                      onClick={handleDelete}
                    >
                      Yes, delete
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                      No
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 size={14} /> Delete
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-mid">
          <div className="flex gap-6">
            {(['overview', 'units'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                  activeTab === tab
                    ? 'border-navy text-body'
                    : 'border-transparent text-subtext hover:text-body'
                }`}
              >
                {tab === 'units' ? `Units (${units.length})` : tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Key stats */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <h3 className="text-sm font-semibold text-body mb-3">Key Details</h3>
                <dl className="space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <dt className="text-subtext flex items-center gap-1.5">
                      <Home size={14} /> Total Units
                    </dt>
                    <dd className="font-medium text-body">{property.total_units}</dd>
                  </div>
                  {property.year_built && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-subtext flex items-center gap-1.5">
                        <Calendar size={14} /> Year Built
                      </dt>
                      <dd className="font-medium text-body">{property.year_built}</dd>
                    </div>
                  )}
                  {property.total_area_sqm && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-subtext flex items-center gap-1.5">
                        <Maximize2 size={14} /> Total Area
                      </dt>
                      <dd className="font-medium text-body">{property.total_area_sqm} m²</dd>
                    </div>
                  )}
                  {ownerName && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-subtext">Owner</dt>
                      <dd className="font-medium text-body">{ownerName}</dd>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <dt className="text-subtext">Address</dt>
                    <dd className="font-medium text-body text-right max-w-[160px]">
                      {editing ? (
                        <Input
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                        />
                      ) : (
                        property.address
                      )}
                    </dd>
                  </div>
                  {property.postal_code && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-subtext">Postal Code</dt>
                      <dd className="font-medium text-body">{property.postal_code}</dd>
                    </div>
                  )}
                </dl>
              </Card>
            </div>

            {/* Description + amenities */}
            <div className="lg:col-span-2 space-y-4">
              {(property.description || editing) && (
                <Card>
                  <h3 className="text-sm font-semibold text-body mb-2">Description</h3>
                  {editing ? (
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-mid px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
                      placeholder="Add a description…"
                    />
                  ) : (
                    <p className="text-sm text-subtext">{property.description}</p>
                  )}
                </Card>
              )}

              {property.amenities && property.amenities.length > 0 && (
                <Card>
                  <h3 className="text-sm font-semibold text-body mb-3">Amenities</h3>
                  <div className="flex flex-wrap gap-2">
                    {property.amenities.map((amenity) => (
                      <span
                        key={amenity}
                        className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

        {activeTab === 'units' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-subtext">{units.length} units in this property</p>
              <Button size="sm" onClick={() => navigate('/units/new')}>
                <Building2 size={14} /> Add Unit
              </Button>
            </div>

            {units.length === 0 ? (
              <EmptyState
                icon={<Building2 size={40} />}
                title="No units yet"
                description="Add units to this property to start managing them."
                action={{ label: 'Add Unit', onClick: () => navigate('/units/new') }}
              />
            ) : (
              <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mid bg-light">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">Unit</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">Floor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">Area</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-subtext uppercase tracking-wide">Rent</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mid">
                    {units.map((unit) => (
                      <tr
                        key={unit.id}
                        onClick={() => navigate(`/units/${unit.id}`)}
                        className="hover:bg-light cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3 font-medium text-body">{unit.unit_number}</td>
                        <td className="px-4 py-3 text-subtext capitalize">{unit.type}</td>
                        <td className="px-4 py-3 text-subtext">
                          {unit.floor != null ? `Floor ${unit.floor}` : '—'}
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
                        <td className="px-4 py-3">
                          <ChevronRight size={14} className="text-subtext" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
