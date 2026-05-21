import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, ClipboardList, Bell } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatDate } from '@/lib/utils'
import { WAITLIST_STATUS_LABELS } from '@/lib/constants'
import toast from 'react-hot-toast'
import type { WaitlistEntry, WaitlistStatus, RoomType } from '@/types'

const schema = z.object({
  guest_id: z.string().optional(),
  room_type_id: z.string().optional(),
  check_in_date: z.string().min(1, 'Check-in date required'),
  check_out_date: z.string().min(1, 'Check-out date required'),
  adults: z.coerce.number().min(1),
  children: z.coerce.number().min(0),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const STATUS_COLORS: Record<WaitlistStatus, string> = {
  waiting: 'bg-amber-100 text-amber-800',
  offered: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-600',
}

function useWaitlist() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['waitlist', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waitlist_entries')
        .select('*, guest:guests(first_name,last_name,email,phone), room_type:room_types(name)')
        .eq('tenant_id', tenant!.id)
        .not('status', 'eq', 'cancelled')
        .order('created_at')
      if (error) throw error
      return data as WaitlistEntry[]
    },
    enabled: !!tenant,
  })
}

function useRoomTypes() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['room-types-waitlist', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('room_types')
        .select('id, name')
        .eq('tenant_id', tenant!.id)
        .eq('is_active', true)
      if (error) throw error
      return data as Pick<RoomType, 'id' | 'name'>[]
    },
    enabled: !!tenant,
  })
}

export default function WaitlistPage() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data: entries = [], isLoading } = useWaitlist()
  const { data: roomTypes = [] } = useRoomTypes()

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { adults: 1, children: 0 },
  })

  const addEntry = useMutation({
    mutationFn: async (data: FormData) => {
      await supabase.from('waitlist_entries').insert({
        tenant_id: tenant!.id,
        guest_id: data.guest_id || null,
        room_type_id: data.room_type_id || null,
        check_in_date: data.check_in_date,
        check_out_date: data.check_out_date,
        adults: data.adults,
        children: data.children,
        notes: data.notes || null,
        status: 'waiting',
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waitlist'] })
      toast.success('Added to waitlist')
      setShowModal(false)
      form.reset({ adults: 1, children: 0 })
    },
    onError: () => toast.error('Failed to add to waitlist'),
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: WaitlistStatus }) => {
      const update: Record<string, unknown> = { status }
      if (status === 'offered') update.notified_at = new Date().toISOString()
      await supabase.from('waitlist_entries').update(update).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['waitlist'] }),
  })

  const roomTypeOptions = [
    { value: '', label: 'Any room type' },
    ...roomTypes.map((rt) => ({ value: rt.id, label: rt.name })),
  ]

  const waitingCount = entries.filter((e) => e.status === 'waiting').length
  const offeredCount = entries.filter((e) => e.status === 'offered').length

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-body">Waitlist</h1>
            <p className="text-sm text-subtext">Manage overbooking waitlist and room availability requests</p>
          </div>
          <Button size="sm" onClick={() => { form.reset({ adults: 1, children: 0 }); setShowModal(true) }}>
            <Plus size={15} /> Add to Waitlist
          </Button>
        </div>

        <div className="flex gap-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-center">
            <p className="text-xl font-bold text-amber-700">{waitingCount}</p>
            <p className="text-xs text-amber-600">Waiting</p>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-center">
            <p className="text-xl font-bold text-blue-700">{offeredCount}</p>
            <p className="text-xs text-blue-600">Offered</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : entries.length === 0 ? (
          <EmptyState icon={<ClipboardList size={32} />} title="No waitlist entries" description="Waitlist entries will appear here when rooms are unavailable." />
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const guest = entry.guest as { first_name: string; last_name: string; email: string; phone: string } | null
              const roomType = entry.room_type as { name: string } | null
              return (
                <div key={entry.id} className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-body">
                          {guest ? `${guest.first_name} ${guest.last_name}` : 'Walk-in request'}
                        </p>
                        <Badge label={WAITLIST_STATUS_LABELS[entry.status]} className={STATUS_COLORS[entry.status] + ' text-xs'} />
                      </div>
                      {guest?.email && <p className="text-xs text-subtext">{guest.email} · {guest.phone}</p>}
                      <p className="text-sm text-body mt-1">
                        {formatDate(entry.check_in_date)} → {formatDate(entry.check_out_date)}
                        {' · '}{entry.adults}A {entry.children > 0 ? `${entry.children}C` : ''}
                        {roomType ? ` · ${roomType.name}` : ' · Any room'}
                      </p>
                      {entry.notes && <p className="text-xs text-subtext mt-0.5 italic">{entry.notes}</p>}
                      {entry.notified_at && (
                        <p className="text-xs text-subtext mt-0.5">Notified: {formatDate(entry.notified_at)}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap">
                      {entry.status === 'waiting' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus.mutate({ id: entry.id, status: 'offered' })}
                        >
                          <Bell size={13} /> Notify
                        </Button>
                      )}
                      {entry.status === 'offered' && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus.mutate({ id: entry.id, status: 'confirmed' })}
                        >
                          Confirm
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => updateStatus.mutate({ id: entry.id, status: 'cancelled' })}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Add to Waitlist"
      >
        <form onSubmit={form.handleSubmit((d) => addEntry.mutate(d))} className="space-y-4">
          <Select label="Room Type (optional)" options={roomTypeOptions} {...form.register('room_type_id')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Check-in Date" type="date" error={form.formState.errors.check_in_date?.message} {...form.register('check_in_date')} />
            <Input label="Check-out Date" type="date" error={form.formState.errors.check_out_date?.message} {...form.register('check_out_date')} />
            <Input label="Adults" type="number" min={1} {...form.register('adults')} />
            <Input label="Children" type="number" min={0} {...form.register('children')} />
          </div>
          <Input label="Notes" placeholder="Guest contact, preferences…" {...form.register('notes')} />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={addEntry.isPending}>Add to Waitlist</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
