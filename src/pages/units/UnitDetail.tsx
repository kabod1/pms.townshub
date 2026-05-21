import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Building2, Edit2, Trash2, Home,
  Maximize2, BedDouble, Bath, Car, CheckCircle2, X, Check,
} from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useUnit, useUpdateUnit, useDeleteUnit, useUnitLeases } from '@/hooks/useProperties'
import type { UnitStatus } from '@/types/database'

const UNIT_STATUS_COLORS: Record<UnitStatus, string> = {
  vacant: 'bg-green-50 text-green-700',
  occupied: 'bg-blue-50 text-blue-700',
  reserved: 'bg-amber-50 text-amber-700',
  maintenance: 'bg-red-50 text-red-700',
  not_available: 'bg-gray-100 text-gray-500',
}

export default function UnitDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: unit, isLoading } = useUnit(id)
  const { data: leases = [] } = useUnitLeases(id)
  const updateUnit = useUpdateUnit()
  const deleteUnit = useDeleteUnit()

  const [editing, setEditing] = useState(false)
  const [editUnitNumber, setEditUnitNumber] = useState('')
  const [editFloor, setEditFloor] = useState<string>('')
  const [editMarketRent, setEditMarketRent] = useState<string>('')
  const [editNotes, setEditNotes] = useState('')
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

  if (!unit) {
    return (
      <DashboardLayout>
        <EmptyState
          icon={<Building2 size={40} />}
          title="Unit not found"
          action={{ label: 'Back to Units', onClick: () => navigate('/units') }}
        />
      </DashboardLayout>
    )
  }

  function startEdit() {
    if (!unit) return
    setEditUnitNumber(unit.unit_number)
    setEditFloor(unit.floor != null ? String(unit.floor) : '')
    setEditMarketRent(unit.market_rent != null ? String(unit.market_rent) : '')
    setEditNotes(unit.notes ?? '')
    setEditing(true)
  }

  async function saveEdit() {
    await updateUnit.mutateAsync({
      id: unit!.id,
      unit_number: editUnitNumber,
      floor: editFloor !== '' ? Number(editFloor) : null,
      market_rent: editMarketRent !== '' ? Number(editMarketRent) : null,
      notes: editNotes || null,
    })
    setEditing(false)
  }

  async function handleDelete() {
    await deleteUnit.mutateAsync(unit!.id)
    navigate('/units')
  }

  const propertyId =
    (unit.property as { id?: string } | undefined)?.id ?? unit.property_id
  const propertyName =
    (unit.property as { name?: string } | undefined)?.name ?? 'Property'

  const activeLease = leases[0]

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/units')}
            className="mt-1 rounded-lg p-1.5 text-subtext hover:bg-light transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {editing ? (
                <Input
                  value={editUnitNumber}
                  onChange={(e) => setEditUnitNumber(e.target.value)}
                  className="text-xl font-bold w-36"
                />
              ) : (
                <h1 className="text-2xl font-bold text-body">Unit {unit.unit_number}</h1>
              )}
              <Badge
                label={unit.status.replace('_', ' ')}
                className={UNIT_STATUS_COLORS[unit.status]}
              />
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-subtext">
              <span className="capitalize">{unit.type}</span>
              <span>·</span>
              <Link
                to={`/properties/${propertyId}`}
                className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Home size={12} /> {propertyName}
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                  <X size={14} /> Cancel
                </Button>
                <Button size="sm" loading={updateUnit.isPending} onClick={saveEdit}>
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
                      loading={deleteUnit.isPending}
                      onClick={handleDelete}
                    >
                      Yes, delete
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                      No
                    </Button>
                  </>
                ) : (
                  <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={14} /> Delete
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Key info */}
          <div className="space-y-4">
            <Card>
              <h3 className="text-sm font-semibold text-body mb-3">Key Details</h3>
              <dl className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <dt className="text-subtext flex items-center gap-1.5">
                    <Building2 size={14} /> Floor
                  </dt>
                  <dd className="font-medium text-body">
                    {editing ? (
                      <Input
                        type="number"
                        value={editFloor}
                        onChange={(e) => setEditFloor(e.target.value)}
                        className="w-20"
                      />
                    ) : (
                      unit.floor != null ? `Floor ${unit.floor}` : '—'
                    )}
                  </dd>
                </div>
                {unit.area_sqm && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-subtext flex items-center gap-1.5">
                      <Maximize2 size={14} /> Area
                    </dt>
                    <dd className="font-medium text-body">{unit.area_sqm} m²</dd>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <dt className="text-subtext flex items-center gap-1.5">
                    <BedDouble size={14} /> Bedrooms
                  </dt>
                  <dd className="font-medium text-body">{unit.bedrooms}</dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-subtext flex items-center gap-1.5">
                    <Bath size={14} /> Bathrooms
                  </dt>
                  <dd className="font-medium text-body">{unit.bathrooms}</dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-subtext flex items-center gap-1.5">
                    <Car size={14} /> Parking
                  </dt>
                  <dd className="font-medium text-body">{unit.parking_spaces}</dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-subtext">Furnished</dt>
                  <dd className="font-medium text-body capitalize">
                    {unit.furnished.replace('_', ' ')}
                  </dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-subtext">Market Rent</dt>
                  <dd className="font-medium text-body">
                    {editing ? (
                      <Input
                        type="number"
                        value={editMarketRent}
                        onChange={(e) => setEditMarketRent(e.target.value)}
                        className="w-24"
                      />
                    ) : (
                      unit.market_rent ? `€${unit.market_rent}` : '—'
                    )}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Active lease */}
            <Card>
              <h3 className="text-sm font-semibold text-body mb-3 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-600" />
                Active Lease
              </h3>
              {activeLease ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-subtext">Tenant</dt>
                    <dd className="font-medium text-body">
                      {(activeLease as { property_tenant?: { first_name: string; last_name: string } }).property_tenant
                        ? `${(activeLease as { property_tenant: { first_name: string; last_name: string } }).property_tenant.first_name} ${(activeLease as { property_tenant: { first_name: string; last_name: string } }).property_tenant.last_name}`
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-subtext">Reference</dt>
                    <dd className="font-medium text-body">{activeLease.lease_reference}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-subtext">Monthly Rent</dt>
                    <dd className="font-medium text-body">€{activeLease.monthly_rent}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-subtext">Start Date</dt>
                    <dd className="font-medium text-body">{activeLease.start_date}</dd>
                  </div>
                  {activeLease.end_date && (
                    <div className="flex justify-between">
                      <dt className="text-subtext">End Date</dt>
                      <dd className="font-medium text-body">{activeLease.end_date}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-subtext">No active lease</p>
              )}
            </Card>

            {/* Features */}
            {unit.features && unit.features.length > 0 && (
              <Card>
                <h3 className="text-sm font-semibold text-body mb-3">Features</h3>
                <div className="flex flex-wrap gap-2">
                  {unit.features.map((feature) => (
                    <span
                      key={feature}
                      className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* Notes */}
            {(unit.notes || editing) && (
              <Card>
                <h3 className="text-sm font-semibold text-body mb-2">Notes</h3>
                {editing ? (
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-mid px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
                    placeholder="Internal notes…"
                  />
                ) : (
                  <p className="text-sm text-subtext">{unit.notes}</p>
                )}
              </Card>
            )}

            {/* Photos placeholder */}
            <Card>
              <h3 className="text-sm font-semibold text-body mb-3">Photos</h3>
              <div className="flex items-center justify-center h-24 rounded-lg bg-light text-subtext text-sm">
                Photo gallery coming soon
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
