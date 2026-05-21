import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Copy, Check, TicketPercent } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Table } from '@/components/ui/Table'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useGiftVouchers, useCreateGiftVoucher } from '@/hooks/useGiftVouchers'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { GiftVoucher } from '@/types'

const SETTINGS_NAV = [
  { to: '/settings', label: 'Hotel' },
  { to: '/settings/users', label: 'Users' },
  { to: '/settings/billing', label: 'Billing' },
  { to: '/settings/packages', label: 'Packages' },
  { to: '/settings/promotions', label: 'Promotions' },
  { to: '/settings/vouchers', label: 'Vouchers' },
]

const VOUCHER_STATUS_COLORS: Record<GiftVoucher['status'], string> = {
  active: 'bg-green-100 text-green-800',
  redeemed: 'bg-gray-100 text-gray-600',
  expired: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-800',
}

function randomCode() {
  return Array.from({ length: 10 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')
}

function CodeCell({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs font-bold tracking-widest text-navy">{code}</span>
      <button onClick={(e) => { e.stopPropagation(); copy() }} className="text-subtext hover:text-body">
        {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
      </button>
    </div>
  )
}

const schema = z.object({
  code: z.string().min(4, 'Code required'),
  value: z.coerce.number().min(1, 'Value required'),
  issued_to: z.string().optional(),
  issued_to_email: z.string().email().optional().or(z.literal('')),
  message: z.string().optional(),
  expires_at: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function GiftVouchers() {
  const [open, setOpen] = useState(false)
  const { data: vouchers, isLoading } = useGiftVouchers()
  const createVoucher = useCreateGiftVoucher()

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { code: randomCode() },
  })

  function openCreate() {
    reset({ code: randomCode() })
    setOpen(true)
  }

  async function onSubmit(data: FormData) {
    await createVoucher.mutateAsync({
      code: data.code.toUpperCase(),
      value: data.value,
      issued_to: data.issued_to || null,
      issued_to_email: data.issued_to_email || null,
      message: data.message || null,
      expires_at: data.expires_at || null,
      booking_id: null,
    })
    setOpen(false)
  }

  const columns = [
    {
      key: 'code',
      header: 'Code',
      render: (v: GiftVoucher) => <CodeCell code={v.code} />,
    },
    {
      key: 'issued_to',
      header: 'Issued To',
      render: (v: GiftVoucher) => (
        <div>
          <p className="text-sm">{v.issued_to || <span className="text-subtext italic">—</span>}</p>
          {v.issued_to_email && <p className="text-xs text-subtext">{v.issued_to_email}</p>}
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      render: (v: GiftVoucher) => (
        <div>
          <p className="font-medium">{formatCurrency(v.value)}</p>
          {v.balance !== v.value && (
            <p className="text-xs text-subtext">Balance: {formatCurrency(v.balance)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'expires',
      header: 'Expires',
      render: (v: GiftVoucher) => (
        <span className="text-xs text-subtext">{v.expires_at ? formatDate(v.expires_at) : '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (v: GiftVoucher) => (
        <Badge label={v.status.charAt(0).toUpperCase() + v.status.slice(1)} className={VOUCHER_STATUS_COLORS[v.status]} />
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-body">Settings</h1>
          <Button size="sm" onClick={openCreate}>
            <Plus size={16} /> New Voucher
          </Button>
        </div>

        {/* Sub-nav */}
        <div className="flex gap-1 border-b border-mid overflow-x-auto">
          {SETTINGS_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive ? 'border-gold text-gold' : 'border-transparent text-subtext hover:text-body'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : (vouchers ?? []).length === 0 ? (
          <EmptyState
            icon={<TicketPercent size={32} />}
            title="No gift vouchers yet"
            description="Create gift vouchers for guests to redeem against bookings."
            action={{ label: 'Create Voucher', onClick: openCreate }}
          />
        ) : (
          <Table
            columns={columns}
            data={vouchers ?? []}
            keyExtractor={(v) => v.id}
            emptyMessage="No vouchers"
          />
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Gift Voucher">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Voucher Code"
                placeholder="SUMMER2025"
                error={errors.code?.message}
                {...register('code')}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mb-0.5"
              onClick={() => setValue('code', randomCode())}
            >
              Regenerate
            </Button>
          </div>
          <Input
            label="Value (€)"
            type="number"
            min={1}
            step={0.01}
            placeholder="50.00"
            error={errors.value?.message}
            {...register('value')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Recipient Name" placeholder="John Smith" {...register('issued_to')} />
            <Input label="Recipient Email" type="email" placeholder="john@example.com" {...register('issued_to_email')} />
          </div>
          <Input label="Personal Message" placeholder="Happy Birthday!" {...register('message')} />
          <Input label="Expiry Date" type="date" {...register('expires_at')} />
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={createVoucher.isPending}>Create Voucher</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
