import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@tanstack/react-query'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import type { Booking } from '@/types'

const schema = z.object({
  id_type: z.enum(['passport', 'national_id', 'driving_licence', 'other']),
  id_number: z.string().min(1, 'ID number is required'),
  nationality: z.string().min(1, 'Nationality is required'),
  arrival_time: z.string().optional(),
  special_requests: z.string().optional(),
})
type FormData = z.infer<typeof schema>

function useBookingByToken(token: string) {
  return useQuery<Booking | null>({
    queryKey: ['pre-checkin', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, guest:guests(first_name, last_name, email), room:rooms(number), room_type:room_types(name)')
        .eq('pre_checkin_token', token)
        .single()
      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }
      return data as Booking
    },
    retry: false,
    staleTime: Infinity,
  })
}

export default function PreCheckin() {
  const { token } = useParams<{ token: string }>()
  const [submitted, setSubmitted] = useState(false)

  const { data: booking, isLoading, error } = useBookingByToken(token ?? '')

  const completeCheckin = useMutation({
    mutationFn: async (formData: FormData) => {
      if (!booking) return
      const { error: guestErr } = await supabase
        .from('guests')
        .update({
          id_type: formData.id_type,
          id_number: formData.id_number,
          nationality: formData.nationality,
        })
        .eq('id', booking.guest_id ?? '')

      if (guestErr) throw guestErr

      const { error: bookingErr } = await supabase
        .from('bookings')
        .update({
          pre_checkin_completed: true,
          special_requests: formData.special_requests || booking.special_requests,
          internal_notes: formData.arrival_time
            ? `Expected arrival: ${formData.arrival_time}. ${booking.internal_notes ?? ''}`.trim()
            : booking.internal_notes,
        })
        .eq('id', booking.id)

      if (bookingErr) throw bookingErr
    },
    onSuccess: () => setSubmitted(true),
  })

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy border-t-transparent" />
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light p-6">
        <div className="max-w-md w-full rounded-2xl bg-white shadow-lg p-8 text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-body mb-2">Link Not Found</h1>
          <p className="text-sm text-subtext">
            This pre-check-in link is invalid or has expired. Please contact the hotel directly.
          </p>
        </div>
      </div>
    )
  }

  if (booking.pre_checkin_completed || submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light p-6">
        <div className="max-w-md w-full rounded-2xl bg-white shadow-lg p-8 text-center">
          <CheckCircle size={48} className="text-green-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-body mb-2">Pre-check-in Complete!</h1>
          <p className="text-sm text-subtext mb-6">
            Thank you! Your information has been received. We look forward to welcoming you.
          </p>
          {booking.check_in_date && (
            <p className="text-sm font-medium text-navy">
              See you on {formatDate(booking.check_in_date)}
            </p>
          )}
        </div>
      </div>
    )
  }

  const guestName = booking.guest
    ? `${booking.guest.first_name} ${booking.guest.last_name}`
    : 'Guest'

  return (
    <div className="min-h-screen bg-light py-10 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="rounded-2xl bg-navy text-white p-6 mb-6 text-center">
          <p className="text-sm text-blue-200 mb-1">Pre-Check-In</p>
          <h1 className="text-2xl font-bold">Welcome, {guestName.split(' ')[0]}!</h1>
          <p className="text-sm text-blue-200 mt-1">
            Complete your details before arrival to speed up check-in
          </p>
        </div>

        {/* Booking summary */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-mid p-5 mb-6">
          <h2 className="text-sm font-semibold text-body mb-3">Your Reservation</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-subtext">Reference</p>
              <p className="font-mono font-semibold text-navy">{booking.booking_reference}</p>
            </div>
            <div>
              <p className="text-xs text-subtext">Room</p>
              <p className="font-medium text-body">
                {booking.room?.number ? `Room ${booking.room.number}` : booking.room_type?.name ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-subtext">Check-in</p>
              <p className="font-medium text-body">{formatDate(booking.check_in_date)}</p>
            </div>
            <div>
              <p className="text-xs text-subtext">Check-out</p>
              <p className="font-medium text-body">{formatDate(booking.check_out_date)}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-mid p-6">
          <h2 className="text-sm font-semibold text-body mb-4">Your Details</h2>

          <form onSubmit={handleSubmit((d) => completeCheckin.mutate(d))} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-body">ID Type</label>
              <select
                {...register('id_type')}
                className="mt-1 w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
              >
                <option value="passport">Passport</option>
                <option value="national_id">National ID</option>
                <option value="driving_licence">Driving Licence</option>
                <option value="other">Other</option>
              </select>
            </div>

            <Input
              label="ID / Passport Number"
              {...register('id_number')}
              error={errors.id_number?.message}
              placeholder="Enter your document number"
            />

            <Input
              label="Nationality"
              {...register('nationality')}
              error={errors.nationality?.message}
              placeholder="e.g. Cypriot, British, German"
            />

            <Input
              label="Expected Arrival Time"
              type="time"
              {...register('arrival_time')}
              hint="Helps us prepare your room"
            />

            <div>
              <label className="text-sm font-medium text-body">Special Requests</label>
              <textarea
                {...register('special_requests')}
                rows={3}
                defaultValue={booking.special_requests ?? ''}
                placeholder="Any preferences or requests for your stay…"
                className="mt-1 w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
              />
            </div>

            {completeCheckin.isError && (
              <p className="text-sm text-red-600">
                Something went wrong. Please try again or contact the hotel.
              </p>
            )}

            <Button type="submit" fullWidth loading={isSubmitting || completeCheckin.isPending}>
              Complete Pre-Check-In
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
