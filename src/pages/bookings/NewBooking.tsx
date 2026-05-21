import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { Card } from '@/components/ui/Card'
import { useRooms, useRoomTypes } from '@/hooks/useRooms'
import { useGuests, useCreateGuest } from '@/hooks/useGuests'
import { useCreateBooking } from '@/hooks/useBookings'
import { calculateTotalAmount } from '@/lib/utils'
import { BOOKING_SOURCE_LABELS } from '@/lib/constants'
import type { BookingSource } from '@/types'

const schema = z.object({
  guestMode: z.enum(['existing', 'new']),
  guestId: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  roomId: z.string().min(1, 'Select a room'),
  checkInDate: z.string().min(1, 'Check-in date required'),
  checkOutDate: z.string().min(1, 'Check-out date required'),
  adults: z.coerce.number().min(1),
  children: z.coerce.number().min(0),
  source: z.string().min(1),
  roomRate: z.coerce.number().min(0),
  specialRequests: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function NewBooking() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [guestMode, setGuestMode] = useState<'existing' | 'new'>('new')

  const { data: rooms } = useRooms()
  useRoomTypes()
  const { data: guests } = useGuests()
  const createGuest = useCreateGuest()
  const createBooking = useCreateBooking()

  const prefillDate = searchParams.get('date') ?? ''
  const prefillRoomId = searchParams.get('room_id') ?? ''

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      guestMode: 'new',
      adults: 1,
      children: 0,
      source: 'direct',
      roomRate: 0,
      checkInDate: prefillDate,
      roomId: prefillRoomId,
    },
  })

  const checkIn = watch('checkInDate')
  const checkOut = watch('checkOutDate')
  const roomRate = watch('roomRate')
  const total = checkIn && checkOut && roomRate
    ? calculateTotalAmount(Number(roomRate), checkIn, checkOut)
    : 0

  const roomOptions = (rooms ?? []).map((r) => ({
    value: r.id,
    label: `Room ${r.number} — ${r.room_type?.name ?? 'No type'} (${r.status.replace('_', ' ')})`,
  }))
  const guestOptions = (guests ?? []).map((g) => ({
    value: g.id,
    label: `${g.first_name} ${g.last_name}${g.email ? ` (${g.email})` : ''}`,
  }))
  const sourceOptions = (Object.keys(BOOKING_SOURCE_LABELS) as BookingSource[]).map((k) => ({
    value: k,
    label: BOOKING_SOURCE_LABELS[k],
  }))

  async function onSubmit(data: FormData) {
    let guestId = data.guestId

    if (guestMode === 'new' && data.firstName && data.lastName) {
      const guest = await createGuest.mutateAsync({
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email || null,
        phone: data.phone || null,
      })
      guestId = guest.id
    }

    const room = rooms?.find((r) => r.id === data.roomId)
    await createBooking.mutateAsync({
      guest_id: guestId ?? null,
      room_id: data.roomId,
      room_type_id: room?.room_type_id ?? null,
      check_in_date: data.checkInDate,
      check_out_date: data.checkOutDate,
      adults: data.adults,
      children: data.children,
      source: data.source as BookingSource,
      room_rate: data.roomRate,
      total_amount: total,
      special_requests: data.specialRequests ?? null,
      status: 'confirmed',
    })
    navigate('/bookings')
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/bookings')}>
            <ArrowLeft size={16} /> Back
          </Button>
          <h1 className="text-xl font-bold text-body">New Booking</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Guest */}
          <Card>
            <h2 className="text-sm font-semibold text-body mb-4">Guest</h2>
            <div className="flex gap-2 mb-4">
              {(['new', 'existing'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setGuestMode(m)}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium border transition-colors ${
                    guestMode === m
                      ? 'border-gold bg-gold text-white'
                      : 'border-mid text-subtext hover:border-navy'
                  }`}
                >
                  {m === 'new' ? 'New Guest' : 'Existing Guest'}
                </button>
              ))}
            </div>

            {guestMode === 'existing' ? (
              <Select
                label="Select Guest"
                options={guestOptions}
                placeholder="Search guest..."
                error={errors.guestId?.message}
                {...register('guestId')}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Input label="First Name" placeholder="Nikos" error={errors.firstName?.message} {...register('firstName')} />
                <Input label="Last Name" placeholder="Papadopoulos" error={errors.lastName?.message} {...register('lastName')} />
                <Input label="Email" type="email" placeholder="guest@email.com" {...register('email')} />
                <Input label="Phone" placeholder="+357 99..." {...register('phone')} />
              </div>
            )}
          </Card>

          {/* Stay */}
          <Card>
            <h2 className="text-sm font-semibold text-body mb-4">Stay Details</h2>
            <div className="space-y-3">
              <Select
                label="Room"
                options={roomOptions}
                placeholder="Select room..."
                error={errors.roomId?.message}
                {...register('roomId')}
              />
              <div className="grid grid-cols-2 gap-3">
                <DatePicker label="Check-in Date" error={errors.checkInDate?.message} {...register('checkInDate')} />
                <DatePicker label="Check-out Date" error={errors.checkOutDate?.message} {...register('checkOutDate')} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Adults" type="number" min={1} {...register('adults')} />
                <Input label="Children" type="number" min={0} {...register('children')} />
                <Select label="Source" options={sourceOptions} {...register('source')} />
              </div>
              <Input
                label="Room Rate (per night)"
                type="number"
                min={0}
                step={0.01}
                error={errors.roomRate?.message}
                {...register('roomRate')}
              />
              {total > 0 && (
                <p className="text-sm text-subtext">
                  Estimated total: <span className="font-semibold text-body">€{total.toFixed(2)}</span>
                </p>
              )}
              <Input
                label="Special Requests"
                placeholder="Dietary needs, late arrival, etc."
                {...register('specialRequests')}
              />
            </div>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" type="button" onClick={() => navigate('/bookings')}>Cancel</Button>
            <Button type="submit" loading={createBooking.isPending || createGuest.isPending}>
              Create Booking
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
