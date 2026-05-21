import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Wrench, ChevronRight, CheckCircle, XCircle } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useMaintenanceRequests, useCreateMaintenanceRequest, useUpdateMaintenanceRequest } from '@/hooks/useMaintenance'
import { useRooms } from '@/hooks/useRooms'
import { formatDate } from '@/lib/utils'
import {
  MAINTENANCE_CATEGORY_LABELS, MAINTENANCE_PRIORITY_LABELS,
  MAINTENANCE_PRIORITY_COLORS, MAINTENANCE_CATEGORY_COLORS,
  MAINTENANCE_STATUS_LABELS, MAINTENANCE_STATUS_COLORS,
} from '@/lib/constants'
import type { MaintenanceRequest, MaintenanceStatus } from '@/types'

const CATEGORIES = [
  'plumbing', 'electrical', 'hvac', 'furniture', 'appliance', 'structural', 'general',
] as const

const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const

const COLUMNS: { status: MaintenanceStatus; label: string; next?: MaintenanceStatus; nextLabel?: string }[] = [
  { status: 'open', label: 'Open', next: 'in_progress', nextLabel: 'Start Work' },
  { status: 'in_progress', label: 'In Progress', next: 'completed', nextLabel: 'Mark Complete' },
  { status: 'completed', label: 'Completed', next: 'closed', nextLabel: 'Close' },
  { status: 'closed', label: 'Closed' },
]

const schema = z.object({
  category: z.enum(['plumbing', 'electrical', 'hvac', 'furniture', 'appliance', 'structural', 'general']),
  description: z.string().min(5, 'Please describe the issue'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  room_id: z.string().optional(),
  assigned_to: z.string().optional(),
})
type FormData = z.infer<typeof schema>

function RequestCard({
  req,
  nextStatus,
  nextLabel,
  onMove,
}: {
  req: MaintenanceRequest
  nextStatus?: MaintenanceStatus
  nextLabel?: string
  onMove: (id: string, status: MaintenanceStatus) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg bg-white ring-1 ring-mid p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <Badge
              label={MAINTENANCE_CATEGORY_LABELS[req.category]}
              className={`text-xs ${MAINTENANCE_CATEGORY_COLORS[req.category]}`}
            />
            <Badge
              label={MAINTENANCE_PRIORITY_LABELS[req.priority]}
              className={`text-xs ${MAINTENANCE_PRIORITY_COLORS[req.priority]}`}
            />
          </div>
          {req.room && (
            <p className="text-xs font-medium text-navy">Room {req.room.number}</p>
          )}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded p-0.5 text-subtext hover:text-body"
        >
          <ChevronRight size={14} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      </div>

      <p className={`text-xs text-body ${expanded ? '' : 'line-clamp-2'}`}>{req.description}</p>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {req.assigned_to && (
            <p className="text-xs text-subtext">Assigned to: {req.assigned_to}</p>
          )}
          {req.resolution_notes && (
            <p className="text-xs text-subtext italic">{req.resolution_notes}</p>
          )}
          <p className="text-xs text-subtext">{formatDate(req.created_at)}</p>
        </div>
      )}

      {nextStatus && nextLabel && (
        <button
          onClick={() => onMove(req.id, nextStatus)}
          className="mt-2 w-full rounded-md border border-mid py-1 text-xs font-medium text-subtext hover:bg-light hover:text-body transition-colors flex items-center justify-center gap-1"
        >
          {nextStatus === 'completed' ? <CheckCircle size={12} /> : nextStatus === 'closed' ? <XCircle size={12} /> : <ChevronRight size={12} />}
          {nextLabel}
        </button>
      )}
    </div>
  )
}

export default function MaintenancePage() {
  const { data: requests, isLoading } = useMaintenanceRequests()
  const { data: rooms } = useRooms()
  const createRequest = useCreateMaintenanceRequest()
  const updateRequest = useUpdateMaintenanceRequest()

  const [modalOpen, setModalOpen] = useState(false)
  const [activeColumn, setActiveColumn] = useState<MaintenanceStatus | 'all'>('all')

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { category: 'general', priority: 'normal' },
    })

  async function onSubmit(data: FormData) {
    await createRequest.mutateAsync({
      ...data,
      room_id: data.room_id || null,
      assigned_to: data.assigned_to || null,
    })
    reset()
    setModalOpen(false)
  }

  function handleMove(id: string, status: MaintenanceStatus) {
    updateRequest.mutate({ id, status })
  }

  const allRequests = requests ?? []

  const countByStatus = (s: MaintenanceStatus) => allRequests.filter((r) => r.status === s).length

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-body">Maintenance</h1>
            <p className="text-sm text-subtext">{allRequests.filter((r) => r.status === 'open').length} open requests</p>
          </div>
          <Button onClick={() => setModalOpen(true)} size="sm">
            <Plus size={16} /> New Request
          </Button>
        </div>

        {/* Mobile status filter */}
        <div className="flex gap-1 border-b border-mid overflow-x-auto lg:hidden">
          <button
            onClick={() => setActiveColumn('all')}
            className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeColumn === 'all' ? 'border-gold text-gold' : 'border-transparent text-subtext'
            }`}
          >
            All
          </button>
          {COLUMNS.map((col) => (
            <button
              key={col.status}
              onClick={() => setActiveColumn(col.status)}
              className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeColumn === col.status ? 'border-gold text-gold' : 'border-transparent text-subtext'
              }`}
            >
              {col.label}
              {countByStatus(col.status) > 0 && (
                <span className="ml-1.5 rounded-full bg-light px-1.5 text-xs text-subtext">
                  {countByStatus(col.status)}
                </span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : allRequests.length === 0 ? (
          <EmptyState
            icon={<Wrench size={40} />}
            title="No maintenance requests"
            description="Log maintenance issues to track and resolve them efficiently."
            action={{ label: 'New Request', onClick: () => setModalOpen(true) }}
          />
        ) : (
          /* Kanban board */
          <div className="grid gap-4 lg:grid-cols-4">
            {COLUMNS.map((col) => {
              const colRequests = allRequests.filter((r) => r.status === col.status)
              const isVisible = activeColumn === 'all' || activeColumn === col.status

              return (
                <div
                  key={col.status}
                  className={`${isVisible ? 'block' : 'hidden lg:block'}`}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-body">{col.label}</span>
                      <span className="rounded-full bg-light px-2 py-0.5 text-xs text-subtext font-medium">
                        {colRequests.length}
                      </span>
                    </div>
                    <Badge
                      label={MAINTENANCE_STATUS_LABELS[col.status]}
                      className={`text-xs ${MAINTENANCE_STATUS_COLORS[col.status]}`}
                    />
                  </div>

                  {/* Cards */}
                  <div className="space-y-2 min-h-24">
                    {colRequests.length === 0 ? (
                      <div className="rounded-lg border-2 border-dashed border-mid py-8 text-center">
                        <p className="text-xs text-subtext">No {col.label.toLowerCase()} requests</p>
                      </div>
                    ) : (
                      colRequests.map((req) => (
                        <RequestCard
                          key={req.id}
                          req={req}
                          nextStatus={col.next}
                          nextLabel={col.nextLabel}
                          onMove={handleMove}
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

      {/* New Request Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Maintenance Request" size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-body">Room (optional)</label>
              <select
                {...register('room_id')}
                className="mt-1 w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
              >
                <option value="">No specific room</option>
                {rooms?.map((r) => (
                  <option key={r.id} value={r.id}>Room {r.number}{r.room_type ? ` — ${r.room_type.name}` : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-body">Category</label>
              <select
                {...register('category')}
                className="mt-1 w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{MAINTENANCE_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-body">Priority</label>
              <select
                {...register('priority')}
                className="mt-1 w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{MAINTENANCE_PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <Input
              label="Assigned To (optional)"
              placeholder="e.g. John the plumber"
              {...register('assigned_to')}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-body">Description</label>
            <textarea
              {...register('description')}
              rows={4}
              placeholder="Describe the issue in detail…"
              className="mt-1 w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-mid">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>Submit Request</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
