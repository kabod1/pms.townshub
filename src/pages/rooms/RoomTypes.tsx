import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, BedDouble } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useRoomTypes, useCreateRoomType, useUpdateRoomType } from '@/hooks/useRooms'
import { formatCurrency } from '@/lib/utils'
import type { RoomType } from '@/types'

const BED_TYPES = ['single', 'double', 'twin', 'king', 'queen', 'suite', 'other']

const AMENITIES = [
  'WiFi', 'Air Conditioning', 'TV', 'Minibar', 'Balcony',
  'Sea View', 'Mountain View', 'Safe', 'Hair Dryer', 'Bathtub',
  'Jacuzzi', 'Kitchen', 'Living Area', 'Private Pool',
]

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  base_price: z.coerce.number().min(0, 'Must be ≥ 0'),
  max_occupancy: z.coerce.number().int().min(1, 'At least 1 guest'),
  max_children: z.coerce.number().int().min(0),
  bed_type: z.string().optional(),
  size_sqm: z.coerce.number().min(0).optional().or(z.literal('')),
  amenities: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().default(0),
})
type FormData = z.infer<typeof schema>

const ROOMS_NAV = [
  { to: '/rooms', label: 'Rooms' },
  { to: '/rooms/types', label: 'Room Types' },
  { to: '/rooms/rates', label: 'Seasonal Rates' },
]

function toFormDefaults(rt?: RoomType): FormData {
  return {
    name: rt?.name ?? '',
    description: rt?.description ?? '',
    base_price: rt?.base_price ?? 0,
    max_occupancy: rt?.max_occupancy ?? 2,
    max_children: rt?.max_children ?? 1,
    bed_type: rt?.bed_type ?? '',
    size_sqm: rt?.size_sqm ?? '' as unknown as number,
    amenities: rt?.amenities ?? [],
    is_active: rt?.is_active ?? true,
    sort_order: rt?.sort_order ?? 0,
  }
}

export default function RoomTypes() {
  const { data: roomTypes, isLoading } = useRoomTypes()
  const createRoomType = useCreateRoomType()
  const updateRoomType = useUpdateRoomType()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RoomType | null>(null)

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: toFormDefaults() })

  function openCreate() {
    setEditing(null)
    reset(toFormDefaults())
    setModalOpen(true)
  }

  function openEdit(rt: RoomType) {
    setEditing(rt)
    reset(toFormDefaults(rt))
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  async function onSubmit(data: FormData) {
    const payload = {
      ...data,
      size_sqm: data.size_sqm === '' || data.size_sqm === undefined ? null : Number(data.size_sqm),
      description: data.description || null,
      bed_type: data.bed_type || null,
    }
    if (editing) {
      await updateRoomType.mutateAsync({ id: editing.id, ...payload })
    } else {
      await createRoomType.mutateAsync(payload as Parameters<typeof createRoomType.mutateAsync>[0])
    }
    closeModal()
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Sub-nav */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-body">Rooms</h1>
          <Button onClick={openCreate} size="sm">
            <Plus size={16} /> Add Room Type
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
        ) : !roomTypes?.length ? (
          <EmptyState
            icon={<BedDouble size={40} />}
            title="No room types yet"
            description="Create room types to categorise your rooms and set pricing."
            action={{ label: 'Add Room Type', onClick: openCreate }}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roomTypes.map((rt) => (
              <div key={rt.id} className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-body truncate">{rt.name}</p>
                    {rt.bed_type && (
                      <p className="text-xs text-subtext capitalize">{rt.bed_type} bed</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      label={rt.is_active ? 'Active' : 'Inactive'}
                      className={rt.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}
                    />
                    <button
                      onClick={() => openEdit(rt)}
                      className="rounded-md p-1 text-subtext hover:bg-light hover:text-body"
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="font-bold text-navy text-lg">
                    {formatCurrency(rt.base_price)} <span className="text-xs font-normal text-subtext">/ night</span>
                  </span>
                  <span className="text-xs text-subtext">
                    Up to {rt.max_occupancy} adults{rt.max_children > 0 ? `, ${rt.max_children} children` : ''}
                  </span>
                </div>

                {rt.size_sqm && (
                  <p className="text-xs text-subtext mb-2">{rt.size_sqm} m²</p>
                )}

                {rt.amenities && rt.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {rt.amenities.slice(0, 4).map((a) => (
                      <span key={a} className="rounded-full bg-light px-2 py-0.5 text-xs text-subtext">{a}</span>
                    ))}
                    {rt.amenities.length > 4 && (
                      <span className="rounded-full bg-light px-2 py-0.5 text-xs text-subtext">
                        +{rt.amenities.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Room Type' : 'Add Room Type'}
        size="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Row 1: Name (full width) */}
          <Input label="Name *" {...register('name')} error={errors.name?.message} />

          {/* Row 2: Price + Bed Type */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Base Price / night"
              type="number"
              step="0.01"
              min="0"
              {...register('base_price')}
              error={errors.base_price?.message}
            />
            <div>
              <label className="text-sm font-medium text-body">Bed Type</label>
              <select
                {...register('bed_type')}
                className="mt-1 w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
              >
                <option value="">Select bed type</option>
                {BED_TYPES.map((b) => (
                  <option key={b} value={b} className="capitalize">{b.charAt(0).toUpperCase() + b.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Occupancy + Size */}
          <div className="grid grid-cols-4 gap-3">
            <Input label="Max Adults" type="number" min="1" {...register('max_occupancy')} error={errors.max_occupancy?.message} />
            <Input label="Max Children" type="number" min="0" {...register('max_children')} error={errors.max_children?.message} />
            <Input label="Size (m²)" type="number" step="0.1" min="0" placeholder="e.g. 32" {...register('size_sqm')} />
            <Input label="Sort Order" type="number" min="0" {...register('sort_order')} />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-body">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              placeholder="Brief description of this room type…"
              className="mt-1 w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
            />
          </div>

          {/* Amenities */}
          <div>
            <p className="text-sm font-medium text-body mb-2">Amenities</p>
            <Controller
              control={control}
              name="amenities"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-1.5">
                  {AMENITIES.map((amenity) => {
                    const checked = (field.value ?? []).includes(amenity)
                    return (
                      <label key={amenity} className="flex items-center gap-2 cursor-pointer text-sm text-body">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const current = field.value ?? []
                            field.onChange(
                              checked ? current.filter((a) => a !== amenity) : [...current, amenity]
                            )
                          }}
                          className="h-4 w-4 rounded border-mid text-gold focus:ring-gold"
                        />
                        {amenity}
                      </label>
                    )
                  })}
                </div>
              )}
            />
          </div>

          {/* Active + Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-mid">
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="is_active"
                render={({ field }) => (
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={field.value}
                    onChange={field.onChange}
                    className="h-4 w-4 rounded border-mid text-gold focus:ring-gold"
                  />
                )}
              />
              <label htmlFor="is_active" className="text-sm text-body">Active</label>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
              <Button type="submit" loading={isSubmitting}>
                {editing ? 'Save Changes' : 'Create Room Type'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
