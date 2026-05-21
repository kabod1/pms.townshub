import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import {
  Plus,
  X,
  Droplets,
  Zap,
  Wind,
  Monitor,
  Building,
  Paintbrush,
  Shield,
  Flower,
  LayoutGrid,
  Settings,
  Filter,
} from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  usePropertyMaintenanceList,
  useCreatePropertyMaintenance,
  useUpdatePropertyMaintenance,
} from '@/hooks/usePropertyMaintenance'
import { useUnits, useProperties } from '@/hooks/useProperties'
import type {
  PropertyMaintenance,
  PropertyMaintenanceStatus,
  PropertyMaintenancePriority,
  PropertyMaintenanceCategory,
  CostResponsibility,
  ReportedByType,
} from '@/types/database'

// ─── Category icons ────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<PropertyMaintenanceCategory, React.ReactNode> = {
  plumbing: <Droplets size={14} />,
  electrical: <Zap size={14} />,
  hvac: <Wind size={14} />,
  appliance: <Monitor size={14} />,
  structural: <Building size={14} />,
  cosmetic: <Paintbrush size={14} />,
  security: <Shield size={14} />,
  garden: <Flower size={14} />,
  common_area: <LayoutGrid size={14} />,
  general: <Settings size={14} />,
}

// ─── Priority badge ────────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<PropertyMaintenancePriority, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-orange-100 text-orange-700',
  emergency: 'bg-red-100 text-red-700',
}

function PriorityBadge({ priority }: { priority: PropertyMaintenancePriority }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_STYLES[priority]}`}>
      {priority}
    </span>
  )
}

// ─── Kanban columns ────────────────────────────────────────────────────────────

const COLUMNS: { status: PropertyMaintenanceStatus; label: string; color: string }[] = [
  { status: 'reported', label: 'Reported', color: 'border-blue-400 bg-blue-50' },
  { status: 'in_progress', label: 'In Progress', color: 'border-amber-400 bg-amber-50' },
  { status: 'quoted', label: 'Quoted', color: 'border-purple-400 bg-purple-50' },
  { status: 'completed', label: 'Completed', color: 'border-green-400 bg-green-50' },
]

// ─── Maintenance Card ─────────────────────────────────────────────────────────

function MaintenanceCard({
  item,
  unitMap,
  onStatusChange,
}: {
  item: PropertyMaintenance
  unitMap: Record<string, string>
  onStatusChange: (id: string, status: PropertyMaintenanceStatus) => void
}) {
  const nextStatuses: Record<PropertyMaintenanceStatus, PropertyMaintenanceStatus | null> = {
    reported: 'in_progress',
    assessed: 'in_progress',
    in_progress: 'quoted',
    quoted: 'approved',
    approved: 'in_progress',
    completed: 'closed',
    closed: null,
    rejected: null,
  }
  const next = nextStatuses[item.status]

  return (
    <div className="rounded-xl border border-mid bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-subtext">
          {CATEGORY_ICONS[item.category]}
          <span className="text-xs capitalize">{item.category}</span>
        </div>
        <PriorityBadge priority={item.priority} />
      </div>
      <p className="mt-2 text-sm font-semibold text-body leading-tight">{item.title}</p>
      {unitMap[item.unit_id ?? ''] && (
        <p className="mt-1 text-xs text-subtext">Unit {unitMap[item.unit_id ?? '']}</p>
      )}
      {item.estimated_cost != null && (
        <p className="mt-1 text-xs text-subtext">
          Est. cost: ${item.estimated_cost.toLocaleString()}
        </p>
      )}
      {item.contractor_name && (
        <p className="mt-1 text-xs text-subtext">Contractor: {item.contractor_name}</p>
      )}
      {next && (
        <button
          onClick={() => onStatusChange(item.id, next)}
          className="mt-3 w-full rounded-lg border border-mid py-1 text-xs font-medium text-body hover:bg-light transition-colors"
        >
          Move to {next.replace('_', ' ')}
        </button>
      )}
    </div>
  )
}

// ─── New Request Form ──────────────────────────────────────────────────────────

interface MaintenanceFormValues {
  unit_id: string
  title: string
  description: string
  category: PropertyMaintenanceCategory
  priority: PropertyMaintenancePriority
  reported_by_type: ReportedByType
  estimated_cost: string
  cost_responsibility: CostResponsibility
  contractor_name: string
  contractor_phone: string
  scheduled_date: string
}

function NewRequestModal({ onClose }: { onClose: () => void }) {
  const { data: units = [] } = useUnits()
  const { mutate: create, isPending } = useCreatePropertyMaintenance()
  const { register, handleSubmit, formState: { errors } } = useForm<MaintenanceFormValues>({
    defaultValues: {
      priority: 'normal',
      category: 'general',
      reported_by_type: 'tenant',
      cost_responsibility: 'owner',
    },
  })

  const onSubmit = (values: MaintenanceFormValues) => {
    create(
      {
        unit_id: values.unit_id || null,
        reported_by_type: values.reported_by_type,
        category: values.category,
        title: values.title,
        description: values.description,
        priority: values.priority,
        estimated_cost: values.estimated_cost ? Number(values.estimated_cost) : null,
        cost_responsibility: values.cost_responsibility,
        contractor_name: values.contractor_name || null,
        contractor_phone: values.contractor_phone || null,
        scheduled_date: values.scheduled_date || null,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-mid px-6 py-4">
          <h2 className="text-base font-semibold text-body">New Maintenance Request</h2>
          <button onClick={onClose} className="text-subtext hover:text-body">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[75vh] overflow-y-auto p-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-body">Unit</label>
            <select
              className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              {...register('unit_id')}
            >
              <option value="">Select unit...</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.unit_number}</option>
              ))}
            </select>
          </div>

          <Input
            label="Title"
            placeholder="Brief description of issue"
            {...register('title', { required: 'Title is required' })}
            error={errors.title?.message}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-body">Description</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Detailed description..."
              {...register('description', { required: 'Description is required' })}
            />
            {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-body">Category</label>
              <select
                className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                {...register('category')}
              >
                {(['plumbing','electrical','hvac','appliance','structural','cosmetic','security','garden','common_area','general'] as PropertyMaintenanceCategory[]).map((c) => (
                  <option key={c} value={c}>{c.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-body">Priority</label>
              <select
                className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                {...register('priority')}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-body">Reported By</label>
              <select
                className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                {...register('reported_by_type')}
              >
                <option value="tenant">Tenant</option>
                <option value="owner">Owner</option>
                <option value="manager">Manager</option>
                <option value="inspection">Inspection</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-body">Cost Responsibility</label>
              <select
                className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                {...register('cost_responsibility')}
              >
                <option value="owner">Owner</option>
                <option value="tenant">Tenant</option>
                <option value="insurance">Insurance</option>
                <option value="shared">Shared</option>
              </select>
            </div>
          </div>

          <Input
            label="Estimated Cost"
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register('estimated_cost')}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Contractor Name"
              placeholder="Optional"
              {...register('contractor_name')}
            />
            <Input
              label="Contractor Phone"
              placeholder="Optional"
              {...register('contractor_phone')}
            />
          </div>

          <Input
            label="Scheduled Date"
            type="date"
            {...register('scheduled_date')}
          />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" fullWidth loading={isPending}>
              Submit Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PropertyMaintenancePage() {
  const [showModal, setShowModal] = useState(false)
  const [filterProperty, setFilterProperty] = useState('')
  const [filterCategory, setFilterCategory] = useState<PropertyMaintenanceCategory | ''>('')
  const [filterPriority, setFilterPriority] = useState<PropertyMaintenancePriority | ''>('')

  const { data: items = [], isLoading } = usePropertyMaintenanceList({
    property_id: filterProperty || undefined,
    category: filterCategory || undefined,
    priority: filterPriority || undefined,
  })
  const { data: properties = [] } = useProperties()
  const { data: units = [] } = useUnits()
  const { mutate: updateStatus } = useUpdatePropertyMaintenance()

  const unitMap = useMemo(
    () => Object.fromEntries(units.map((u) => [u.id, u.unit_number])),
    [units],
  )

  const handleStatusChange = (id: string, status: PropertyMaintenanceStatus) => {
    updateStatus({ id, status })
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-body">Property Maintenance</h1>
            <p className="mt-0.5 text-sm text-subtext">Track maintenance requests for rental properties</p>
          </div>
          <Button onClick={() => setShowModal(true)}>
            <Plus size={15} />
            New Request
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Filter size={15} className="text-subtext" />
          <select
            value={filterProperty}
            onChange={(e) => setFilterProperty(e.target.value)}
            className="rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as PropertyMaintenanceCategory | '')}
            className="rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Categories</option>
            {(['plumbing','electrical','hvac','appliance','structural','cosmetic','security','garden','common_area','general'] as PropertyMaintenanceCategory[]).map((c) => (
              <option key={c} value={c}>{c.replace('_', ' ')}</option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as PropertyMaintenancePriority | '')}
            className="rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>

        {/* Kanban Board */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-sm text-subtext">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((col) => {
              const colItems = items.filter((item) => item.status === col.status)
              return (
                <div key={col.status} className={`rounded-xl border-t-4 ${col.color} p-4`}>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-body">{col.label}</h3>
                    <span className="rounded-full bg-white border border-mid px-2 py-0.5 text-xs font-medium text-subtext">
                      {colItems.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {colItems.length === 0 ? (
                      <p className="text-center text-xs text-subtext py-4">No items</p>
                    ) : (
                      colItems.map((item) => (
                        <MaintenanceCard
                          key={item.id}
                          item={item}
                          unitMap={unitMap}
                          onStatusChange={handleStatusChange}
                        />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && <NewRequestModal onClose={() => setShowModal(false)} />}
    </DashboardLayout>
  )
}
