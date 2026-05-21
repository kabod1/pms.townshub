import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Gift } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { usePackages, useCreatePackage, useUpdatePackage } from '@/hooks/usePackages'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Package } from '@/types'

const SETTINGS_NAV = [
  { to: '/settings', label: 'Hotel' },
  { to: '/settings/users', label: 'Users' },
  { to: '/settings/billing', label: 'Billing' },
  { to: '/settings/packages', label: 'Packages' },
  { to: '/settings/promotions', label: 'Promotions' },
  { to: '/settings/vouchers', label: 'Vouchers' },
]

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  price: z.coerce.number().min(0),
  includes_text: z.string().optional(),
  valid_from: z.string().optional(),
  valid_to: z.string().optional(),
  min_nights: z.coerce.number().int().min(1).default(1),
  sort_order: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true),
})
type FormData = z.infer<typeof schema>

function toFormDefaults(pkg?: Package): FormData {
  return {
    name: pkg?.name ?? '',
    description: pkg?.description ?? '',
    price: pkg?.price ?? 0,
    includes_text: pkg?.includes?.join('\n') ?? '',
    valid_from: pkg?.valid_from ?? '',
    valid_to: pkg?.valid_to ?? '',
    min_nights: pkg?.min_nights ?? 1,
    sort_order: pkg?.sort_order ?? 0,
    is_active: pkg?.is_active ?? true,
  }
}

export default function Packages() {
  const { data: packages, isLoading } = usePackages()
  const createPackage = useCreatePackage()
  const updatePackage = useUpdatePackage()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Package | null>(null)

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: toFormDefaults() })

  function openCreate() {
    setEditing(null)
    reset(toFormDefaults())
    setModalOpen(true)
  }

  function openEdit(pkg: Package) {
    setEditing(pkg)
    reset(toFormDefaults(pkg))
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  async function onSubmit(data: FormData) {
    const includes = data.includes_text
      ? data.includes_text.split('\n').map((s) => s.trim()).filter(Boolean)
      : []
    const payload = {
      name: data.name,
      description: data.description || null,
      price: data.price,
      includes,
      valid_from: data.valid_from || null,
      valid_to: data.valid_to || null,
      min_nights: data.min_nights,
      sort_order: data.sort_order,
      is_active: data.is_active,
      room_type_ids: [],
    }
    if (editing) {
      await updatePackage.mutateAsync({ id: editing.id, ...payload })
    } else {
      await createPackage.mutateAsync(payload)
    }
    closeModal()
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-body">Settings</h1>
          <Button onClick={openCreate} size="sm">
            <Plus size={16} /> Add Package
          </Button>
        </div>

        <div className="flex gap-1 border-b border-mid overflow-x-auto">
          {SETTINGS_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
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
        ) : !packages?.length ? (
          <EmptyState
            icon={<Gift size={40} />}
            title="No packages yet"
            description="Create packages to bundle room stays with add-ons at a set price."
            action={{ label: 'Add Package', onClick: openCreate }}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => (
              <div key={pkg.id} className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-body truncate">{pkg.name}</p>
                    {pkg.description && (
                      <p className="text-xs text-subtext line-clamp-2 mt-0.5">{pkg.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge
                      label={pkg.is_active ? 'Active' : 'Inactive'}
                      className={pkg.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}
                    />
                    <button
                      onClick={() => openEdit(pkg)}
                      className="rounded-md p-1 text-subtext hover:bg-light hover:text-body"
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                </div>

                <p className="text-lg font-bold text-navy mb-3">{formatCurrency(pkg.price)}</p>

                {pkg.includes && pkg.includes.length > 0 && (
                  <ul className="space-y-1 mb-3">
                    {pkg.includes.slice(0, 4).map((item, i) => (
                      <li key={i} className="text-xs text-subtext flex items-center gap-1.5">
                        <span className="text-gold">✓</span> {item}
                      </li>
                    ))}
                    {pkg.includes.length > 4 && (
                      <li className="text-xs text-subtext">+{pkg.includes.length - 4} more included</li>
                    )}
                  </ul>
                )}

                <div className="flex flex-wrap gap-2 text-xs text-subtext">
                  <span>Min {pkg.min_nights} night{pkg.min_nights !== 1 ? 's' : ''}</span>
                  {pkg.valid_from && pkg.valid_to && (
                    <span>{formatDate(pkg.valid_from)} – {formatDate(pkg.valid_to)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Package' : 'Add Package'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Package Name" {...register('name')} error={errors.name?.message} />

          <div>
            <label className="text-sm font-medium text-body">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              className="mt-1 w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
              placeholder="What's included in this package…"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Price"
              type="number"
              step="0.01"
              min="0"
              {...register('price')}
              error={errors.price?.message}
            />
            <Input
              label="Min Nights"
              type="number"
              min="1"
              {...register('min_nights')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Valid From" type="date" {...register('valid_from')} />
            <Input label="Valid To" type="date" {...register('valid_to')} />
          </div>

          <div>
            <label className="text-sm font-medium text-body">What&apos;s Included</label>
            <textarea
              {...register('includes_text')}
              rows={4}
              className="mt-1 w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
              placeholder="One item per line:&#10;Daily breakfast&#10;Airport transfer&#10;Spa access"
            />
            <p className="mt-1 text-xs text-subtext">Enter one item per line</p>
          </div>

          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <input
                  type="checkbox"
                  id="pkg_active"
                  checked={field.value}
                  onChange={field.onChange}
                  className="h-4 w-4 rounded border-mid text-gold focus:ring-gold"
                />
              )}
            />
            <label htmlFor="pkg_active" className="text-sm text-body">Active</label>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-mid">
            <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>
              {editing ? 'Save Changes' : 'Create Package'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
