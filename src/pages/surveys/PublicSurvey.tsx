import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { CheckCircle, AlertCircle, Star } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

interface BookingRaw {
  id: string
  booking_reference: string
  check_in_date: string
  check_out_date: string
  guest_id: string
  tenant_id: string
  guest: { first_name: string; last_name: string; email: string | null } | { first_name: string; last_name: string; email: string | null }[] | null
  room: { number: string } | { number: string }[] | null
}

interface BookingWithGuest {
  id: string
  booking_reference: string
  check_in_date: string
  check_out_date: string
  guest_id: string
  tenant_id: string
  guest: { first_name: string; last_name: string; email: string | null } | null
  room: { number: string } | null
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const val = i + 1
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(val)}
            onMouseEnter={() => setHover(val)}
            onMouseLeave={() => setHover(0)}
            className="text-2xl transition-colors"
          >
            <Star
              size={28}
              className={(hover || value) >= val ? 'text-gold fill-gold' : 'text-gray-300'}
            />
          </button>
        )
      })}
    </div>
  )
}

function NPSPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: 11 }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors border ${
            value === i
              ? 'bg-navy text-white border-navy'
              : 'border-mid text-body hover:border-navy hover:bg-light'
          }`}
        >
          {i}
        </button>
      ))}
    </div>
  )
}

export default function PublicSurvey() {
  const { ref } = useParams<{ ref: string }>()
  const [submitted, setSubmitted] = useState(false)

  const [overall, setOverall] = useState(0)
  const [cleanliness, setCleanliness] = useState(0)
  const [service, setService] = useState(0)
  const [amenities, setAmenities] = useState(0)
  const [nps, setNps] = useState<number | null>(null)
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null)
  const [comments, setComments] = useState('')

  const { data: booking, isLoading, error } = useQuery<BookingWithGuest | null>({
    queryKey: ['public-survey-booking', ref],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, booking_reference, check_in_date, check_out_date, guest_id, tenant_id, guest:guests(first_name, last_name, email), room:rooms(number)')
        .eq('booking_reference', ref!)
        .single()
      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }
      const raw = data as unknown as BookingRaw
      return {
        ...raw,
        guest: Array.isArray(raw.guest) ? (raw.guest[0] ?? null) : raw.guest,
        room: Array.isArray(raw.room) ? (raw.room[0] ?? null) : raw.room,
      } as BookingWithGuest
    },
    retry: false,
    staleTime: Infinity,
    enabled: !!ref,
  })

  const submitSurvey = useMutation({
    mutationFn: async () => {
      if (!booking) return
      const { error } = await supabase.from('surveys').insert({
        tenant_id: booking.tenant_id,
        booking_id: booking.id,
        guest_id: booking.guest_id,
        overall_rating: overall || null,
        cleanliness_rating: cleanliness || null,
        service_rating: service || null,
        amenities_rating: amenities || null,
        nps_score: nps,
        would_recommend: wouldRecommend,
        comments: comments || null,
        submitted_at: new Date().toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => setSubmitted(true),
  })

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
            This survey link is invalid or has expired. Please contact the hotel.
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light p-6">
        <div className="max-w-md w-full rounded-2xl bg-white shadow-lg p-8 text-center">
          <CheckCircle size={48} className="text-green-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-body mb-2">Thank You!</h1>
          <p className="text-sm text-subtext">
            Your feedback has been received. We really appreciate you taking the time to share your experience.
          </p>
        </div>
      </div>
    )
  }

  const guestName = booking.guest
    ? `${booking.guest.first_name} ${booking.guest.last_name}`
    : 'Guest'

  return (
    <div className="min-h-screen bg-light py-10 px-4">
      <div className="max-w-lg mx-auto space-y-5">

        {/* Header */}
        <div className="rounded-2xl bg-navy text-white p-6 text-center">
          <p className="text-sm text-blue-200 mb-1">Post-Stay Survey</p>
          <h1 className="text-2xl font-bold">How was your stay, {guestName.split(' ')[0]}?</h1>
          <p className="text-sm text-blue-200 mt-1">
            Booking {booking.booking_reference} · {booking.check_in_date} to {booking.check_out_date}
          </p>
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-mid p-6 space-y-6">

          {/* Overall rating */}
          <div>
            <p className="text-sm font-semibold text-body mb-2">Overall rating</p>
            <StarPicker value={overall} onChange={setOverall} />
          </div>

          {/* Category ratings */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: 'Cleanliness', value: cleanliness, set: setCleanliness },
              { label: 'Service', value: service, set: setService },
              { label: 'Amenities', value: amenities, set: setAmenities },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <p className="text-xs font-medium text-subtext mb-1.5">{label}</p>
                <StarPicker value={value} onChange={set} />
              </div>
            ))}
          </div>

          {/* NPS */}
          <div>
            <p className="text-sm font-semibold text-body mb-1">
              How likely are you to recommend us? (0 = Not at all, 10 = Definitely)
            </p>
            <NPSPicker value={nps} onChange={setNps} />
          </div>

          {/* Would recommend */}
          <div>
            <p className="text-sm font-semibold text-body mb-2">Would you stay with us again?</p>
            <div className="flex gap-3">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setWouldRecommend(v)}
                  className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors ${
                    wouldRecommend === v
                      ? 'border-navy bg-navy text-white'
                      : 'border-mid text-body hover:bg-light'
                  }`}
                >
                  {v ? 'Yes, definitely!' : 'Probably not'}
                </button>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div>
            <label className="text-sm font-semibold text-body">Comments (optional)</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              placeholder="Tell us about your experience — what you loved, what we can improve…"
              className="mt-1.5 w-full rounded-xl border border-mid px-3 py-2.5 text-sm text-body placeholder:text-subtext focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue resize-none"
            />
          </div>

          {submitSurvey.isError && (
            <p className="text-sm text-red-600">Something went wrong. Please try again.</p>
          )}

          <Button
            fullWidth
            onClick={() => submitSurvey.mutate()}
            loading={submitSurvey.isPending}
            disabled={overall === 0}
          >
            Submit Feedback
          </Button>
        </div>
      </div>
    </div>
  )
}
