import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, CalendarRange } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useRoomTypes } from '@/hooks/useRooms'
import {
  useSeasonalRates,
  useCreateSeasonalRate,
  useUpdateSeasonalRate,
  useDeleteSeasonalRate,
} from '@/hooks/useSeasonalRates'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { SeasonalRate } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  room_type_id: z.string().min(1, 'Room type is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  price_override: z.coerce.number().min(0, 'Must be ≥ 0'),
  min_nights: z.coerce.number().int().min(1).default(1),
}).refine((d) => !d.start_date || !d.end_date || d.end_date >= d.start_date, {
  message: 'End date must be on or after start date',
  path: ['end_date'],
})
type FormData = z.infer<typeof schema>

const ROOMS_NAV = [
  { to: '/rooms', label: 'Rooms' },
  { to: '/rooms/types', label: 'Room Types' },
  { to: '/rooms/rates', label: 'Seasonal Rates' },
]

function toFormDefaults(rate?: SeasonalRate): FormData {
  return {
    name: rate?.name ?? '',
    room_type_id: rate?.room_type_id ?? '',
    start_date: rate?.start_date ?? '',
    end_date: rate?.end_date ?? '',
    price_override: rate?.price_override ?? 0,
    min_nights: rate?.min_nights ?? 1,
  }
}

export default function SeasonalRates() {
  const { data: rates, isLoading } = useSeasonalRates()
  const { data: roomTypes } = useRoomTypes()
  const createRate = useCreateSeasonalRate()
  const updateRate = useUpdateSeasonalRate()
  const deleteRate = useDeleteSeasonalRate()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SeasonalRate | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<SeasonalRate | null>(null)

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: toFormDefaults() })

  const watchedStartDate = watch('start_date')

  function openCreate() {
    setEditing(null)
    reset(toFormDefaults())
    setModalOpen(true)
  }

  function openEdit(rate: SeasonalRate) {
    setEditing(rate)
    reset(toFormDefaults(rate))
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  async function onSubmit(data: FormData) {
    try {
      if (editing) {
        await updateRate.mutateAsync({ id: editing.id, ...data })
      } else {
        await createRate.mutateAsync(data)
      }
      closeModal()
    } catch {
      // error already shown via toast in the mutation
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    await deleteRate.mutateAsync(confirmDelete.id)
    setConfirmDelete(null)
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-body">Rooms</h1>
          <Button onClick={openCreate} size="sm">
            <Plus size={16} /> Add Seasonal Rate
          </Button>
        </div>

        <div className="flex gap-1 border-b border-mid">
          {ROOMS_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-gold text-gold'
                    : 'border-transparent text-subtext hover:text-body'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : !rates?.length ? (
          <EmptyState
            icon={<CalendarRange size={40} />}
            title="No seasonal rates yet"
            description="Add seasonal pricing to override base rates during peak or off-peak periods."
            action={{ label: 'Add Rate', onClick: openCreate }}
          />
        ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-mid">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mid bg-light">
                  <th className="px-4 py-3 text-left font-medium text-subtext">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-subtext">Room Type</th>
                  <th className="px-4 py-3 text-left font-medium text-subtext">Period</th>
                  <th className="px-4 py-3 text-left font-medium text-subtext">Min Nights</th>
                  <th className="px-4 py-3 text-right font-medium text-subtext">Price / Night</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-mid">
                {rates.map((rate) => (
                  <tr key={rate.id} className="hover:bg-light/50">
                    <td className="px-4 py-3 font-medium text-body">{rate.name}</td>
                    <td className="px-4 py-3 text-subtext">
                      {rate.room_type?.name ?? roomTypes?.find((rt) => rt.id === rate.room_type_id)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-subtext">
                      {formatDate(rate.start_date)} – {formatDate(rate.end_date)}
                    </td>
                    <td className="px-4 py-3 text-subtext">{rate.min_nights} night{rate.min_nights !== 1 ? 's' : ''}</td>
                    <td className="px-4 py-3 text-right font-semibold text-navy">
                      {formatCurrency(rate.price_override)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(rate)}
                          className="rounded-md p-1 text-subtext hover:bg-light hover:text-body"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(rate)}
                          className="rounded-md p-1 text-subtext hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Seasonal Rate' : 'Add Seasonal Rate'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Rate Name" {...register('name')} error={errors.name?.message} placeholder="e.g. Summer Peak" />

          <div>
            <label className="text-sm font-medium text-body">Room Type</label>
            <select
              {...register('room_type_id')}
              className="mt-1 w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
            >
              <option value="">Select room type</option>
              {roomTypes?.map((rt) => (
                <option key={rt.id} value={rt.id}>{rt.name}</option>
              ))}
            </select>
            {errors.room_type_id && (
              <p className="mt-1 text-xs text-red-600">{errors.room_type_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              {...register('start_date')}
              error={errors.start_date?.message}
            />
            <Input
              label="End Date"
              type="date"
              min={watchedStartDate || undefined}
              {...register('end_date')}
              error={errors.end_date?.message}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Price Override (per night)"
              type="number"
              step="0.01"
              min="0"
              {...register('price_override')}
              error={errors.price_override?.message}
            />
            <Input
              label="Min Nights"
              type="number"
              min="1"
              {...register('min_nights')}
              error={errors.min_nights?.message}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-mid">
            <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>
              {editing ? 'Save Changes' : 'Create Rate'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Seasonal Rate" size="sm">
        <p className="text-sm text-subtext mb-6">
          Are you sure you want to delete <strong>{confirmDelete?.name}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} loading={deleteRate.isPending}>Delete</Button>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
