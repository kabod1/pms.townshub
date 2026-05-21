import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ClipboardCheck, Plus, X, ChevronDown, ChevronUp } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useUnits } from '@/hooks/useProperties'
import type {
  PropertyInspection,
  InspectionType,
  InspectionStatus,
  ConditionRating,
} from '@/types/database'

// ─── Inline hooks ─────────────────────────────────────────────────────────────

function useInspections() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['property-inspections', tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_inspections')
        .select('*, unit:units(unit_number)')
        .eq('tenant_id', useAuthStore.getState().tenant!.id)
        .order('scheduled_date', { ascending: false })
      if (error) throw error
      return (data ?? []) as PropertyInspection[]
    },
  })
}

function useCreateInspection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<PropertyInspection>) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('property_inspections')
        .insert({ ...data, tenant_id: tenant.id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['property-inspections'] }),
  })
}

// ─── Condition badge ──────────────────────────────────────────────────────────

const CONDITION_STYLES: Record<ConditionRating, string> = {
  excellent: 'bg-green-100 text-green-800',
  good: 'bg-blue-100 text-blue-800',
  fair: 'bg-amber-100 text-amber-800',
  poor: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}

function ConditionBadge({ condition }: { condition: ConditionRating }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${CONDITION_STYLES[condition]}`}>
      {condition}
    </span>
  )
}

// ─── Inspection type badge ────────────────────────────────────────────────────

const TYPE_LABELS: Record<InspectionType, string> = {
  move_in: 'Move In',
  move_out: 'Move Out',
  routine: 'Routine',
  maintenance: 'Maintenance',
  emergency: 'Emergency',
}

const TYPE_STYLES: Record<InspectionType, string> = {
  move_in: 'bg-teal-100 text-teal-800',
  move_out: 'bg-purple-100 text-purple-800',
  routine: 'bg-blue-100 text-blue-800',
  maintenance: 'bg-amber-100 text-amber-800',
  emergency: 'bg-red-100 text-red-800',
}

function TypeBadge({ type }: { type: InspectionType }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[type]}`}>
      {TYPE_LABELS[type]}
    </span>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<InspectionStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-600',
}

// ─── Schedule Inspection Modal ────────────────────────────────────────────────

interface InspectionFormValues {
  unit_id: string
  inspection_type: InspectionType
  scheduled_date: string
  notes: string
}

function ScheduleModal({ onClose }: { onClose: () => void }) {
  const { data: units = [] } = useUnits()
  const { mutate: create, isPending } = useCreateInspection()
  const { register, handleSubmit, formState: { errors } } = useForm<InspectionFormValues>({
    defaultValues: { inspection_type: 'routine', scheduled_date: '', notes: '' },
  })

  const onSubmit = (values: InspectionFormValues) => {
    create(
      {
        unit_id: values.unit_id,
        inspection_type: values.inspection_type,
        scheduled_date: values.scheduled_date || null,
        notes: values.notes || null,
        status: 'scheduled',
        report: {},
        photos: [],
        lease_id: null,
        conducted_by: null,
        overall_condition: null,
        completed_date: null,
        tenant_signature_url: null,
        manager_signature_url: null,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-mid px-6 py-4">
          <h2 className="text-base font-semibold text-body">Schedule Inspection</h2>
          <button onClick={onClose} className="text-subtext hover:text-body">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-body">Unit</label>
            <select
              className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              {...register('unit_id', { required: 'Unit is required' })}
            >
              <option value="">Select unit...</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.unit_number}</option>
              ))}
            </select>
            {errors.unit_id && <p className="mt-1 text-xs text-red-600">{errors.unit_id.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-body">Inspection Type</label>
            <select
              className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              {...register('inspection_type')}
            >
              <option value="move_in">Move In</option>
              <option value="move_out">Move Out</option>
              <option value="routine">Routine</option>
              <option value="maintenance">Maintenance</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>

          <Input
            label="Scheduled Date"
            type="date"
            {...register('scheduled_date', { required: 'Date is required' })}
            error={errors.scheduled_date?.message}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-body">Notes</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Optional notes..."
              {...register('notes')}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" fullWidth loading={isPending}>
              Schedule
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Inspection Row ──────────────────────────────────────────────────────────

function InspectionRow({ inspection }: { inspection: PropertyInspection }) {
  const [expanded, setExpanded] = useState(false)
  const unit = (inspection as PropertyInspection & { unit?: { unit_number: string } }).unit

  const reportEntries = inspection.report
    ? Object.entries(inspection.report as Record<string, unknown>)
    : []

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-light/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3">
          <TypeBadge type={inspection.inspection_type} />
        </td>
        <td className="px-4 py-3 text-sm text-body">
          {unit?.unit_number ?? '—'}
        </td>
        <td className="px-4 py-3 text-sm text-body">
          {inspection.scheduled_date
            ? new Date(inspection.scheduled_date).toLocaleDateString()
            : '—'}
        </td>
        <td className="px-4 py-3 text-sm text-body">
          {inspection.completed_date
            ? new Date(inspection.completed_date).toLocaleDateString()
            : '—'}
        </td>
        <td className="px-4 py-3">
          {inspection.overall_condition ? (
            <ConditionBadge condition={inspection.overall_condition} />
          ) : (
            <span className="text-subtext text-sm">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[inspection.status]}`}>
            {inspection.status}
          </span>
        </td>
        <td className="px-4 py-3 text-subtext">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-light px-6 py-4">
            <div className="space-y-2">
              {inspection.notes && (
                <p className="text-sm text-body"><strong>Notes:</strong> {inspection.notes}</p>
              )}
              {reportEntries.length > 0 ? (
                <div>
                  <p className="mb-2 text-sm font-medium text-body">Inspection Report</p>
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-mid bg-white p-3 text-xs md:grid-cols-3">
                    {reportEntries.map(([key, val]) => (
                      <div key={key} className="flex flex-col">
                        <span className="font-medium text-subtext capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="text-body">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-subtext">No report data available.</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const TABS: { status: InspectionStatus | 'all'; label: string }[] = [
  { status: 'scheduled', label: 'Scheduled' },
  { status: 'completed', label: 'Completed' },
  { status: 'cancelled', label: 'Cancelled' },
]

export default function InspectionsPage() {
  const [activeTab, setActiveTab] = useState<InspectionStatus>('scheduled')
  const [showModal, setShowModal] = useState(false)

  const { data: inspections = [], isLoading } = useInspections()

  const filtered = inspections.filter((i) => i.status === activeTab)

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-body">Inspections</h1>
            <p className="mt-0.5 text-sm text-subtext">Manage property inspections and condition reports</p>
          </div>
          <Button onClick={() => setShowModal(true)}>
            <Plus size={15} />
            Schedule Inspection
          </Button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 rounded-xl border border-mid bg-white p-1 w-fit shadow-sm">
          {TABS.map((tab) => (
            <button
              key={tab.status}
              onClick={() => setActiveTab(tab.status as InspectionStatus)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.status
                  ? 'bg-navy text-white'
                  : 'text-subtext hover:text-body'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 rounded-full bg-black/10 px-1.5 py-0.5 text-xs">
                {inspections.filter((i) => i.status === tab.status).length}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-mid bg-white shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-sm text-subtext">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-subtext">
              <ClipboardCheck size={40} className="mb-3 opacity-30" />
              <p className="text-sm">No {activeTab} inspections</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mid bg-light text-left text-xs font-medium text-subtext uppercase tracking-wide">
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Scheduled</th>
                  <th className="px-4 py-3">Completed</th>
                  <th className="px-4 py-3">Condition</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-mid">
                {filtered.map((inspection) => (
                  <InspectionRow key={inspection.id} inspection={inspection} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && <ScheduleModal onClose={() => setShowModal(false)} />}
    </DashboardLayout>
  )
}
