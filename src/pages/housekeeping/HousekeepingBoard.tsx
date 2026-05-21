import { useState, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Sparkles, Zap, Clock, CheckSquare, Trash2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  useHousekeepingTasks,
  useCreateHousekeepingTask,
  useUpdateTaskStatus,
  useUpdateTaskChecklist,
  useAutoGenerateTasks,
  DEFAULT_CHECKLISTS,
} from '@/hooks/useHousekeeping'
import { useRooms } from '@/hooks/useRooms'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import {
  HOUSEKEEPING_STATUS_LABELS,
  HOUSEKEEPING_TYPE_LABELS,
  HOUSEKEEPING_PRIORITY_LABELS,
} from '@/lib/constants'
import type {
  HousekeepingTask,
  HousekeepingStatus,
  HousekeepingTaskType,
  HousekeepingPriority,
  ChecklistItem,
} from '@/types'
import { classNames } from '@/lib/utils'

const PRIORITY_COLORS: Record<HousekeepingPriority, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  normal: 'bg-blue-100 text-blue-700',
  low: 'bg-gray-100 text-gray-600',
}

const COLUMNS: { status: HousekeepingStatus; label: string; color: string }[] = [
  { status: 'pending', label: 'Pending', color: 'border-t-amber-400' },
  { status: 'in_progress', label: 'In Progress', color: 'border-t-blue-500' },
  { status: 'completed', label: 'Completed', color: 'border-t-green-500' },
]

const TASK_TYPE_OPTIONS: { value: HousekeepingTaskType; label: string }[] = [
  { value: 'checkout_clean', label: 'Checkout Clean' },
  { value: 'stayover_clean', label: 'Stayover Clean' },
  { value: 'deep_clean', label: 'Deep Clean' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'turndown', label: 'Turndown' },
]

const PRIORITY_OPTIONS: { value: HousekeepingPriority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
]

const schema = z.object({
  room_id: z.string().optional(),
  type: z.string().min(1),
  priority: z.string().min(1),
  assigned_to: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function HousekeepingBoard() {
  const [showModal, setShowModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<HousekeepingTask | null>(null)
  const [filterType, setFilterType] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterStaff, setFilterStaff] = useState('')
  const [editChecklist, setEditChecklist] = useState<ChecklistItem[]>([])
  const [newItemText, setNewItemText] = useState('')

  const { tenant } = useAuthStore()
  const { data: tasks, isLoading } = useHousekeepingTasks()
  const { data: rooms } = useRooms()
  const updateStatus = useUpdateTaskStatus()
  const updateChecklist = useUpdateTaskChecklist()
  const createTask = useCreateHousekeepingTask()
  const autoGenerate = useAutoGenerateTasks()

  const { data: staffUsers } = useQuery({
    queryKey: ['staff-users', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('tenant_id', tenant!.id)
        .eq('is_active', true)
        .order('full_name')
      if (error) throw error
      return data as { id: string; full_name: string }[]
    },
    enabled: !!tenant,
  })

  const { register, handleSubmit, watch, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'checkout_clean', priority: 'normal' },
  })

  const selectedType = watch('type') as HousekeepingTaskType

  useEffect(() => {
    setEditChecklist(DEFAULT_CHECKLISTS[selectedType]?.map((i) => ({ ...i })) ?? [])
  }, [selectedType])

  const enrichedTasks = useMemo(() => {
    return (tasks ?? []).map((t) => ({
      ...t,
      room: rooms?.find((r) => r.id === t.room_id) ?? undefined,
      assignee: staffUsers?.find((u) => u.id === t.assigned_to)
        ? { full_name: staffUsers.find((u) => u.id === t.assigned_to)!.full_name } as HousekeepingTask['assignee']
        : undefined,
    } as HousekeepingTask))
  }, [tasks, rooms, staffUsers])

  const filteredTasks = useMemo(() => {
    return enrichedTasks.filter((t) => {
      if (filterType && t.type !== filterType) return false
      if (filterPriority && t.priority !== filterPriority) return false
      if (filterStaff && t.assigned_to !== filterStaff) return false
      return true
    })
  }, [enrichedTasks, filterType, filterPriority, filterStaff])

  if (isLoading) return <DashboardLayout><LoadingSpinner fullPage /></DashboardLayout>

  const byStatus = (status: HousekeepingStatus) =>
    filteredTasks.filter((t) => t.status === status)

  const NEXT_STATUS: Partial<Record<HousekeepingStatus, HousekeepingStatus>> = {
    pending: 'in_progress',
    in_progress: 'completed',
  }

  const roomOptions = [
    { value: '', label: 'No specific room' },
    ...(rooms ?? []).map((r) => ({ value: r.id, label: `Room ${r.number}` })),
  ]

  const staffOptions = [
    { value: '', label: 'Unassigned' },
    ...(staffUsers ?? []).map((u) => ({ value: u.id, label: u.full_name })),
  ]

  async function onSubmit(data: FormData) {
    try {
      await createTask.mutateAsync({
        room_id: data.room_id || null,
        type: data.type as HousekeepingTaskType,
        priority: data.priority as HousekeepingPriority,
        assigned_to: data.assigned_to || null,
        notes: data.notes || null,
        checklist: editChecklist,
      })
      reset({ type: 'checkout_clean', priority: 'normal' })
      setShowModal(false)
    } catch {
      // error shown via toast
    }
  }

  function toggleEditItem(i: number) {
    setEditChecklist((prev) => prev.map((item, idx) => idx === i ? { ...item, done: !item.done } : item))
  }

  function removeEditItem(i: number) {
    setEditChecklist((prev) => prev.filter((_, idx) => idx !== i))
  }

  function addEditItem() {
    const text = newItemText.trim()
    if (!text) return
    setEditChecklist((prev) => [...prev, { item: text, done: false }])
    setNewItemText('')
  }

  function toggleChecklistItem(index: number) {
    if (!selectedTask) return
    const current: ChecklistItem[] = selectedTask.checklist?.length
      ? selectedTask.checklist
      : DEFAULT_CHECKLISTS[selectedTask.type]
    const updated = current.map((item, i) =>
      i === index ? { ...item, done: !item.done } : item
    )
    const updatedTask = { ...selectedTask, checklist: updated }
    setSelectedTask(updatedTask)
    updateChecklist.mutate({ id: selectedTask.id, checklist: updated })
  }

  const activeChecklist: ChecklistItem[] = selectedTask
    ? (selectedTask.checklist?.length
        ? selectedTask.checklist
        : DEFAULT_CHECKLISTS[selectedTask.type])
    : []

  const doneCount = activeChecklist.filter((i) => i.done).length

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-body">Housekeeping Board</h1>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => autoGenerate.mutate()}
              loading={autoGenerate.isPending}
            >
              <Zap size={15} /> Auto-Generate Tasks
            </Button>
            <Button size="sm" onClick={() => setShowModal(true)}>
              <Plus size={15} /> New Task
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-mid bg-white px-3 py-1.5 text-sm text-body focus:outline-none focus:ring-2 focus:ring-gold"
          >
            <option value="">All Types</option>
            {TASK_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="rounded-lg border border-mid bg-white px-3 py-1.5 text-sm text-body focus:outline-none focus:ring-2 focus:ring-gold"
          >
            <option value="">All Priorities</option>
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={filterStaff}
            onChange={(e) => setFilterStaff(e.target.value)}
            className="rounded-lg border border-mid bg-white px-3 py-1.5 text-sm text-body focus:outline-none focus:ring-2 focus:ring-gold"
          >
            <option value="">All Staff</option>
            {(staffUsers ?? []).map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
          {(filterType || filterPriority || filterStaff) && (
            <button
              onClick={() => { setFilterType(''); setFilterPriority(''); setFilterStaff('') }}
              className="text-sm text-blue underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Kanban Board */}
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const colTasks = byStatus(col.status)
            return (
              <div key={col.status} className={classNames('rounded-xl bg-light border-t-4', col.color)}>
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-body">{col.label}</span>
                  <span className="text-xs font-bold bg-white rounded-full px-2 py-0.5 shadow-sm text-subtext">
                    {colTasks.length}
                  </span>
                </div>
                <div className="px-3 pb-3 space-y-2">
                  {colTasks.length === 0 ? (
                    <EmptyState
                      icon={<Sparkles size={24} />}
                      title={`No ${col.label.toLowerCase()} tasks`}
                    />
                  ) : (
                    colTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        nextStatus={NEXT_STATUS[task.status]}
                        onMove={(status) => updateStatus.mutate({ id: task.id, status })}
                        onDetail={() => setSelectedTask(task)}
                        loading={updateStatus.isPending}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* New Task Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); reset(); setNewItemText('') }} title="New Housekeeping Task" size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select label="Room" options={roomOptions} {...register('room_id')} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Task Type" options={TASK_TYPE_OPTIONS} {...register('type')} />
            <Select label="Priority" options={PRIORITY_OPTIONS} {...register('priority')} />
          </div>
          <Select label="Assigned To" options={staffOptions} {...register('assigned_to')} />
          <Input label="Notes" placeholder="Any specific instructions…" {...register('notes')} />

          {/* Editable checklist */}
          <div className="rounded-lg border border-mid">
            <div className="px-3 py-2 border-b border-mid flex items-center justify-between">
              <p className="text-xs font-semibold text-body">Checklist</p>
              <span className="text-xs text-subtext">{editChecklist.length} items</span>
            </div>
            <ul className="max-h-48 overflow-y-auto divide-y divide-mid">
              {editChecklist.map((item, i) => (
                <li key={i} className="flex items-center gap-2 px-3 py-1.5 group">
                  <button
                    type="button"
                    onClick={() => toggleEditItem(i)}
                    className={classNames(
                      'w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors',
                      item.done ? 'bg-gold border-gold' : 'border-mid bg-white'
                    )}
                  >
                    {item.done && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className={classNames('flex-1 text-xs', item.done ? 'line-through text-subtext' : 'text-body')}>
                    {item.item}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeEditItem(i)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 px-3 py-2 border-t border-mid">
              <input
                type="text"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEditItem() } }}
                placeholder="Add item…"
                className="flex-1 text-xs rounded border border-mid px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gold"
              />
              <button
                type="button"
                onClick={addEditItem}
                className="text-xs bg-gold text-white rounded px-2 py-1 hover:bg-gold/90"
              >
                Add
              </button>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" type="button" onClick={() => { setShowModal(false); reset(); setNewItemText('') }}>Cancel</Button>
            <Button type="submit" loading={createTask.isPending}>Create Task</Button>
          </div>
        </form>
      </Modal>

      {/* Task Detail Modal */}
      <Modal
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title={selectedTask ? `${HOUSEKEEPING_TYPE_LABELS[selectedTask.type]} — ${selectedTask.room ? `Room ${selectedTask.room.number}` : 'General'}` : ''}
        size="sm"
      >
        {selectedTask && (
          <div className="space-y-4">
            {/* Meta */}
            <div className="flex flex-wrap gap-2">
              <Badge
                label={HOUSEKEEPING_PRIORITY_LABELS[selectedTask.priority]}
                className={PRIORITY_COLORS[selectedTask.priority]}
              />
              <Badge
                label={HOUSEKEEPING_STATUS_LABELS[selectedTask.status]}
                className="bg-gray-100 text-gray-700"
              />
            </div>

            {selectedTask.assigned_to && (
              <p className="text-sm text-subtext">
                Assigned to: <span className="font-medium text-body">
                  {(selectedTask as HousekeepingTask & { assignee?: { full_name: string } }).assignee?.full_name ?? selectedTask.assigned_to}
                </span>
              </p>
            )}

            {/* Time info */}
            {(selectedTask.started_at || selectedTask.completed_at) && (
              <div className="flex gap-4 text-xs text-subtext">
                {selectedTask.started_at && (
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> Started: {new Date(selectedTask.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {selectedTask.completed_at && (
                  <span className="flex items-center gap-1">
                    <CheckSquare size={12} /> Done: {new Date(selectedTask.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            )}

            {selectedTask.notes && (
              <p className="rounded-lg bg-light px-3 py-2 text-sm text-subtext">{selectedTask.notes}</p>
            )}

            {/* Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-body">Checklist</p>
                <span className="text-xs text-subtext">{doneCount}/{activeChecklist.length} done</span>
              </div>
              <div className="w-full bg-mid rounded-full h-1.5 mb-3">
                <div
                  className="bg-gold h-1.5 rounded-full transition-all"
                  style={{ width: activeChecklist.length ? `${(doneCount / activeChecklist.length) * 100}%` : '0%' }}
                />
              </div>
              <ul className="space-y-1.5">
                {activeChecklist.map((item, i) => (
                  <li
                    key={i}
                    onClick={() => toggleChecklistItem(i)}
                    className="flex items-center gap-2.5 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-light transition-colors"
                  >
                    <div className={classNames(
                      'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                      item.done ? 'bg-gold border-gold' : 'border-mid bg-white'
                    )}>
                      {item.done && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={classNames('text-sm', item.done ? 'line-through text-subtext' : 'text-body')}>
                      {item.item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Status actions */}
            {selectedTask.status !== 'completed' && (
              <div className="flex gap-2 pt-1">
                {selectedTask.status === 'pending' && (
                  <Button
                    fullWidth
                    variant="outline"
                    onClick={() => {
                      updateStatus.mutate({ id: selectedTask.id, status: 'in_progress' })
                      setSelectedTask({ ...selectedTask, status: 'in_progress', started_at: new Date().toISOString() })
                    }}
                    loading={updateStatus.isPending}
                  >
                    Start Task
                  </Button>
                )}
                <Button
                  fullWidth
                  onClick={() => {
                    updateStatus.mutate({ id: selectedTask.id, status: 'completed' })
                    setSelectedTask(null)
                  }}
                  loading={updateStatus.isPending}
                >
                  Mark Complete
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </DashboardLayout>
  )
}

function TaskCard({
  task,
  nextStatus,
  onMove,
  onDetail,
  loading,
}: {
  task: HousekeepingTask
  nextStatus?: HousekeepingStatus
  onMove: (s: HousekeepingStatus) => void
  onDetail: () => void
  loading: boolean
}) {
  const assigneeName = (task as HousekeepingTask & { assignee?: { full_name: string } }).assignee?.full_name
  const checklist = task.checklist?.length ? task.checklist : DEFAULT_CHECKLISTS[task.type]
  const doneCount = checklist.filter((i) => i.done).length

  return (
    <div
      onClick={onDetail}
      className="rounded-lg bg-white shadow-sm ring-1 ring-mid p-3 space-y-2 cursor-pointer hover:ring-gold transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-body">
          {task.room ? `Room ${task.room.number}` : 'General'}
        </p>
        <Badge
          label={HOUSEKEEPING_PRIORITY_LABELS[task.priority]}
          className={PRIORITY_COLORS[task.priority]}
        />
      </div>
      <p className="text-xs text-subtext">{HOUSEKEEPING_TYPE_LABELS[task.type]}</p>
      {assigneeName && (
        <p className="text-xs text-blue-700">👤 {assigneeName}</p>
      )}

      {/* Checklist mini progress */}
      {checklist.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-mid rounded-full h-1">
            <div
              className="bg-gold h-1 rounded-full"
              style={{ width: `${(doneCount / checklist.length) * 100}%` }}
            />
          </div>
          <span className="text-xs text-subtext">{doneCount}/{checklist.length}</span>
        </div>
      )}

      {task.notes && <p className="text-xs text-subtext line-clamp-1">{task.notes}</p>}

      {nextStatus && (
        <Button
          size="sm"
          variant="outline"
          fullWidth
          loading={loading}
          onClick={(e) => { e.stopPropagation(); onMove(nextStatus) }}
        >
          Mark {HOUSEKEEPING_STATUS_LABELS[nextStatus]}
        </Button>
      )}
    </div>
  )
}
