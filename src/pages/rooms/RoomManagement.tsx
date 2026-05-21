import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, BedDouble } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useRooms, useRoomTypes, useCreateRoom, useUpdateRoom, useUpdateRoomStatus } from '@/hooks/useRooms'
import { ROOM_STATUS_LABELS, ROOM_STATUS_COLORS } from '@/lib/constants'
import type { Room, RoomStatus } from '@/types'

const ALL_STATUSES: RoomStatus[] = [
  'vacant_clean', 'vacant_dirty', 'occupied', 'maintenance', 'out_of_order',
]

const ROOMS_NAV = [
  { to: '/rooms', label: 'Rooms' },
  { to: '/rooms/types', label: 'Room Types' },
  { to: '/rooms/rates', label: 'Seasonal Rates' },
]

const schema = z.object({
  number: z.string().min(1, 'Room number required'),
  room_type_id: z.string().optional(),
  floor: z.coerce.number().int().optional().nullable(),
  status: z.string().min(1),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function RoomManagement() {
  const [filterType, setFilterType] = useState('')
  const [editRoom, setEditRoom] = useState<Room | null>(null)
  const [showModal, setShowModal] = useState(false)

  const { data: rooms, isLoading } = useRooms()
  const { data: roomTypes } = useRoomTypes()
  const updateStatus = useUpdateRoomStatus()
  const createRoom = useCreateRoom()
  const updateRoom = useUpdateRoom()

  const filtered = (rooms ?? []).filter(
    (r) => !filterType || r.room_type_id === filterType,
  )

  const typeOptions = [
    { value: '', label: 'All Types' },
    ...(roomTypes ?? []).map((t) => ({ value: t.id, label: t.name })),
  ]
  const typeSelectOptions = [
    { value: '', label: 'No room type' },
    ...(roomTypes ?? []).map((t) => ({ value: t.id, label: t.name })),
  ]
  const statusOptions = ALL_STATUSES.map((s) => ({ value: s, label: ROOM_STATUS_LABELS[s] }))

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'vacant_clean' },
  })

  function openCreate() {
    setEditRoom(null)
    reset({ status: 'vacant_clean', number: '', floor: undefined, room_type_id: '', notes: '' })
    setShowModal(true)
  }

  function openEdit(room: Room) {
    setEditRoom(room)
    reset({
      number: room.number,
      room_type_id: room.room_type_id ?? '',
      floor: room.floor ?? undefined,
      status: room.status,
      notes: room.notes ?? '',
    })
    setShowModal(true)
  }

  async function onSubmit(data: FormData) {
    const payload = {
      number: data.number,
      room_type_id: data.room_type_id || null,
      floor: data.floor ?? null,
      status: data.status as RoomStatus,
      notes: data.notes || null,
    }
    if (editRoom) {
      await updateRoom.mutateAsync({ id: editRoom.id, ...payload })
    } else {
      await createRoom.mutateAsync(payload)
    }
    setShowModal(false)
  }

  if (isLoading) return <DashboardLayout><LoadingSpinner fullPage /></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-body">Rooms</h1>
          <div className="flex items-center gap-2">
            <Select
              options={typeOptions}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-40"
            />
            <Button size="sm" onClick={openCreate}>
              <Plus size={16} /> Add Room
            </Button>
          </div>
        </div>

        {/* Sub-nav */}
        <div className="flex gap-1 border-b border-mid">
          {ROOMS_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive ? 'border-gold text-gold' : 'border-transparent text-subtext hover:text-body'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* Status summary */}
        <div className="flex gap-3 flex-wrap">
          {ALL_STATUSES.map((s) => {
            const count = (rooms ?? []).filter((r) => r.status === s).length
            return (
              <div key={s} className="rounded-lg bg-white shadow-sm ring-1 ring-mid px-4 py-2 flex items-center gap-2">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${ROOM_STATUS_COLORS[s].split(' ')[0].replace('-100', '-500')}`} />
                <span className="text-xs text-subtext">{ROOM_STATUS_LABELS[s]}</span>
                <span className="text-sm font-bold text-body">{count}</span>
              </div>
            )
          })}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<BedDouble size={40} />}
            title="No rooms found"
            description={filterType ? 'No rooms match the selected type.' : 'Add your first room to get started.'}
            action={!filterType ? { label: 'Add Room', onClick: openCreate } : undefined}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                statusOptions={statusOptions}
                onStatusChange={(status) => updateStatus.mutate({ id: room.id, status })}
                onEdit={() => openEdit(room)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Room Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editRoom ? `Edit Room ${editRoom.number}` : 'Add New Room'}
        size="sm"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Room Number"
              placeholder="101"
              error={errors.number?.message}
              {...register('number')}
            />
            <Input
              label="Floor"
              type="number"
              placeholder="1"
              {...register('floor')}
            />
          </div>
          <Select
            label="Room Type"
            options={typeSelectOptions}
            {...register('room_type_id')}
          />
          <Select
            label="Status"
            options={statusOptions}
            {...register('status')}
          />
          <Input
            label="Notes"
            placeholder="Any notes about this room…"
            {...register('notes')}
          />
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createRoom.isPending || updateRoom.isPending}>
              {editRoom ? 'Save Changes' : 'Add Room'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}

function RoomCard({
  room,
  statusOptions,
  onStatusChange,
  onEdit,
}: {
  room: Room
  statusOptions: { value: string; label: string }[]
  onStatusChange: (s: RoomStatus) => void
  onEdit: () => void
}) {
  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-lg font-bold text-body">Room {room.number}</p>
          <p className="text-xs text-subtext">
            {room.room_type?.name ?? 'No type'}{room.floor ? ` · Floor ${room.floor}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge label={ROOM_STATUS_LABELS[room.status]} className={ROOM_STATUS_COLORS[room.status]} />
          <button
            onClick={onEdit}
            className="p-1 rounded text-subtext hover:text-body hover:bg-light transition-colors"
            title="Edit room"
          >
            <Pencil size={13} />
          </button>
        </div>
      </div>
      <Select
        options={statusOptions}
        value={room.status}
        onChange={(e) => onStatusChange(e.target.value as RoomStatus)}
        className="text-xs"
      />
      {room.notes && <p className="mt-2 text-xs text-subtext line-clamp-2">{room.notes}</p>}
    </div>
  )
}
