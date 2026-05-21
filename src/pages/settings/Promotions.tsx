import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Copy, Check, Tag } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { usePromotions, useCreatePromotion, useUpdatePromotion } from '@/hooks/usePromotions'
import { formatDate } from '@/lib/utils'
import type { Promotion } from '@/types'

const SETTINGS_NAV = [
  { to: '/settings', label: 'Hotel' },
  { to: '/settings/users', label: 'Users' },
  { to: '/settings/billing', label: 'Billing' },
  { to: '/settings/packages', label: 'Packages' },
  { to: '/settings/promotions', label: 'Promotions' },
  { to: '/settings/vouchers', label: 'Vouchers' },
]

const schema = z.object({
  code: z.string().min(1, 'Code is required').toUpperCase(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.coerce.number().min(0),
  applies_to: z.enum(['room', 'total', 'extras']),
  valid_from: z.string().optional(),
  valid_to: z.string().optional(),
  max_uses: z.coerce.number().int().min(0).optional().or(z.literal('')),
  min_nights: z.coerce.number().int().min(1).default(1),
  min_amount: z.coerce.number().min(0).default(0),
  is_active: z.boolean().default(true),
})
type FormData = z.infer<typeof schema>

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function toFormDefaults(promo?: Promotion): FormData {
  return {
    code: promo?.code ?? '',
    name: promo?.name ?? '',
    description: promo?.description ?? '',
    discount_type: (promo?.discount_type ?? 'percentage') as 'percentage' | 'fixed',
    discount_value: promo?.discount_value ?? 0,
    applies_to: (promo?.applies_to ?? 'room') as 'room' | 'total' | 'extras',
    valid_from: promo?.valid_from ?? '',
    valid_to: promo?.valid_to ?? '',
    max_uses: promo?.max_uses ?? '',
    min_nights: promo?.min_nights ?? 1,
    min_amount: promo?.min_amount ?? 0,
    is_active: promo?.is_active ?? true,
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      className="rounded-md p-1 text-subtext hover:bg-light hover:text-body transition-colors"
      title="Copy code"
    >
      {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
    </button>
  )
}

export default function Promotions() {
  const { data: promotions, isLoading } = usePromotions()
  const createPromotion = useCreatePromotion()
  const updatePromotion = useUpdatePromotion()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Promotion | null>(null)

  const { register, handleSubmit, reset, control, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: toFormDefaults() })

  const discountType = watch('discount_type')

  function openCreate() {
    setEditing(null)
    reset(toFormDefaults())
    setModalOpen(true)
  }

  function openEdit(promo: Promotion) {
    setEditing(promo)
    reset(toFormDefaults(promo))
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  async function onSubmit(data: FormData) {
    const payload = {
      code: data.code.toUpperCase(),
      name: data.name,
      description: data.description || null,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      applies_to: data.applies_to,
      valid_from: data.valid_from || null,
      valid_to: data.valid_to || null,
      max_uses: data.max_uses === '' || data.max_uses === undefined ? null : Number(data.max_uses),
      min_nights: data.min_nights,
      min_amount: data.min_amount,
      room_type_ids: [],
      is_active: data.is_active,
    }
    if (editing) {
      await updatePromotion.mutateAsync({ id: editing.id, ...payload })
    } else {
      await createPromotion.mutateAsync(payload)
    }
    closeModal()
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-body">Settings</h1>
          <Button onClick={openCreate} size="sm">
            <Plus size={16} /> Add Promotion
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
        ) : !promotions?.length ? (
          <EmptyState
            icon={<Tag size={40} />}
            title="No promotions yet"
            description="Create discount codes for direct bookings, early birds, and special offers."
            action={{ label: 'Add Promotion', onClick: openCreate }}
          />
        ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-mid">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mid bg-light">
                  <th className="px-4 py-3 text-left font-medium text-subtext">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-subtext">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-subtext">Discount</th>
                  <th className="px-4 py-3 text-left font-medium text-subtext">Validity</th>
                  <th className="px-4 py-3 text-left font-medium text-subtext">Usage</th>
                  <th className="px-4 py-3 text-left font-medium text-subtext">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-mid">
                {promotions.map((promo) => (
                  <tr key={promo.id} className="hover:bg-light/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs font-semibold bg-light rounded px-1.5 py-0.5">
                          {promo.code}
                        </span>
                        <CopyButton text={promo.code} />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-body">{promo.name}</td>
                    <td className="px-4 py-3 text-subtext">
                      {promo.discount_type === 'percentage'
                        ? `${promo.discount_value}%`
                        : `€${promo.discount_value}`}{' '}
                      off {promo.applies_to}
                    </td>
                    <td className="px-4 py-3 text-subtext text-xs">
                      {promo.valid_from && promo.valid_to
                        ? `${formatDate(promo.valid_from)} – ${formatDate(promo.valid_to)}`
                        : promo.valid_from
                        ? `From ${formatDate(promo.valid_from)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-subtext">
                      {promo.current_uses}
                      {promo.max_uses ? ` / ${promo.max_uses}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={promo.is_active ? 'Active' : 'Inactive'}
                        className={promo.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEdit(promo)}
                        className="rounded-md p-1 text-subtext hover:bg-light hover:text-body"
                      >
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Promotion' : 'Add Promotion'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                label="Promo Code"
                {...register('code')}
                error={errors.code?.message}
                placeholder="e.g. SUMMER25"
                className="uppercase"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setValue('code', randomCode())}
            >
              Generate
            </Button>
          </div>

          <Input label="Promotion Name" {...register('name')} error={errors.name?.message} placeholder="e.g. Summer Discount" />

          <div>
            <label className="text-sm font-medium text-body">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              className="mt-1 w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-body">Discount Type</label>
              <select
                {...register('discount_type')}
                className="mt-1 w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (€)</option>
              </select>
            </div>
            <Input
              label={discountType === 'percentage' ? 'Discount %' : 'Discount Amount'}
              type="number"
              step="0.01"
              min="0"
              max={discountType === 'percentage' ? 100 : undefined}
              {...register('discount_value')}
              error={errors.discount_value?.message}
            />
            <div>
              <label className="text-sm font-medium text-body">Applies To</label>
              <select
                {...register('applies_to')}
                className="mt-1 w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
              >
                <option value="room">Room charges</option>
                <option value="total">Total bill</option>
                <option value="extras">Extras only</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Valid From" type="date" {...register('valid_from')} />
            <Input label="Valid To" type="date" {...register('valid_to')} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input label="Max Uses" type="number" min="0" placeholder="Unlimited" {...register('max_uses')} />
            <Input label="Min Nights" type="number" min="1" {...register('min_nights')} />
            <Input label="Min Amount (€)" type="number" step="0.01" min="0" {...register('min_amount')} />
          </div>

          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <input
                  type="checkbox"
                  id="promo_active"
                  checked={field.value}
                  onChange={field.onChange}
                  className="h-4 w-4 rounded border-mid text-gold focus:ring-gold"
                />
              )}
            />
            <label htmlFor="promo_active" className="text-sm text-body">Active</label>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-mid">
            <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>
              {editing ? 'Save Changes' : 'Create Promotion'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
