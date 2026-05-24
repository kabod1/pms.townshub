import { useQuery } from '@tanstack/react-query'
import { Star, Link2, Copy } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { StatCard } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Survey } from '@/types'
import toast from 'react-hot-toast'

function RatingBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null
  const pct = (value / 5) * 100
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-subtext w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-light rounded-full overflow-hidden">
        <div className="h-full bg-gold rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-body w-6 text-right">{value.toFixed(1)}</span>
    </div>
  )
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <span key={i} className={`text-sm ${i < value ? 'text-gold' : 'text-gray-200'}`}>★</span>
      ))}
    </div>
  )
}

function useSurveys() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['surveys', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surveys')
        .select('*, guest:guests(first_name,last_name), booking:bookings(booking_reference,check_in_date,check_out_date)')
        .eq('tenant_id', tenant!.id)
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return data as Survey[]
    },
    enabled: !!tenant,
  })
}

function npsCategory(score: number) {
  if (score >= 9) return { label: 'Promoter', color: 'bg-green-100 text-green-700' }
  if (score >= 7) return { label: 'Passive', color: 'bg-amber-100 text-amber-800' }
  return { label: 'Detractor', color: 'bg-red-100 text-red-700' }
}

function copySurveyLink(bookingRef: string) {
  const url = `${window.location.origin}/survey/${bookingRef}`
  navigator.clipboard.writeText(url).then(() => toast.success('Survey link copied!')).catch(() => toast.error('Copy failed'))
}

export default function SurveysPage() {
  const { data: surveys = [], isLoading } = useSurveys()

  const withNPS = surveys.filter((s) => s.nps_score !== null)
  const avgNPS = withNPS.length > 0
    ? Math.round(withNPS.reduce((s, r) => s + (r.nps_score ?? 0), 0) / withNPS.length)
    : null

  const promoters = withNPS.filter((s) => (s.nps_score ?? 0) >= 9).length
  const detractors = withNPS.filter((s) => (s.nps_score ?? 0) <= 6).length
  const npsScore = withNPS.length > 0
    ? Math.round(((promoters - detractors) / withNPS.length) * 100)
    : null

  const avgOverall = surveys.filter((s) => s.overall_rating).length > 0
    ? surveys.reduce((s, r) => s + (r.overall_rating ?? 0), 0) / surveys.filter((s) => s.overall_rating).length
    : null

  const wouldRecommend = surveys.filter((s) => s.would_recommend === true).length
  const recommendPct = surveys.length > 0 ? Math.round((wouldRecommend / surveys.length) * 100) : 0

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-body">Guest Satisfaction Surveys</h1>
            <p className="text-sm text-subtext">NPS scores and post-stay feedback</p>
          </div>
          <div className="flex items-center gap-2">
            <Link2 size={14} className="text-subtext" />
            <span className="text-xs text-subtext">Survey link:</span>
            <code className="text-xs bg-light px-2 py-1 rounded-md text-body font-mono truncate max-w-[180px]">
              /survey/BOOKING_REF
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const example = `${window.location.origin}/survey/HTL-XXXXXX`
                navigator.clipboard.writeText(example).then(() => toast.success('Example link copied — replace XXXXXX with booking ref')).catch(() => {})
              }}
            >
              <Copy size={14} /> Copy template
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                title="NPS Score"
                value={npsScore !== null ? `${npsScore > 0 ? '+' : ''}${npsScore}` : '—'}
                subtitle="Net Promoter Score"
                icon={<Star size={20} />}
                color="gold"
              />
              <StatCard
                title="Avg NPS Rating"
                value={avgNPS !== null ? `${avgNPS}/10` : '—'}
                subtitle="Average out of 10"
                icon={<Star size={20} />}
                color="green"
              />
              <StatCard
                title="Overall Rating"
                value={avgOverall !== null ? `${avgOverall.toFixed(1)}/5` : '—'}
                icon={<Star size={20} />}
                color="navy"
              />
              <StatCard
                title="Would Recommend"
                value={`${recommendPct}%`}
                subtitle={`${wouldRecommend} of ${surveys.length}`}
                icon={<Star size={20} />}
                color="blue"
              />
            </div>

            {/* NPS breakdown */}
            {withNPS.length > 0 && (
              <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-3 sm:p-5">
                <h2 className="text-sm font-semibold text-body mb-3">NPS Breakdown</h2>
                <div className="flex gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{promoters}</p>
                    <p className="text-xs text-subtext">Promoters (9–10)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-600">{withNPS.length - promoters - detractors}</p>
                    <p className="text-xs text-subtext">Passives (7–8)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{detractors}</p>
                    <p className="text-xs text-subtext">Detractors (0–6)</p>
                  </div>
                </div>
              </div>
            )}

            {/* Survey list */}
            {surveys.length === 0 ? (
              <EmptyState
                icon={<Star size={32} />}
                title="No surveys yet"
                description="Guest surveys will appear here after post-stay emails are sent."
              />
            ) : (
              <div className="space-y-3">
                {surveys.map((survey) => {
                  const guest = survey.guest as { first_name: string; last_name: string } | null
                  const booking = survey.booking as { booking_reference: string; check_in_date: string } | null
                  return (
                    <div key={survey.id} className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-body">
                              {guest ? `${guest.first_name} ${guest.last_name}` : 'Anonymous'}
                            </p>
                            {booking && (
                              <button
                                onClick={() => copySurveyLink(booking.booking_reference)}
                                className="flex items-center gap-1 text-xs text-subtext font-mono hover:text-navy transition-colors"
                                title="Copy survey link"
                              >
                                {booking.booking_reference}
                                <Copy size={11} />
                              </button>
                            )}
                            {survey.nps_score !== null && (
                              <Badge label={npsCategory(survey.nps_score).label} className={npsCategory(survey.nps_score).color + ' text-xs'} />
                            )}
                            {survey.would_recommend && (
                              <Badge label="Would recommend" className="bg-green-100 text-green-700 text-xs" />
                            )}
                          </div>
                          {survey.nps_score !== null && (
                            <div className="mt-1.5">
                              <p className="text-xs text-subtext mb-0.5">NPS: {survey.nps_score}/10</p>
                              <StarRating value={survey.nps_score} />
                            </div>
                          )}
                          <div className="mt-2 space-y-1">
                            <RatingBar label="Cleanliness" value={survey.cleanliness_rating} />
                            <RatingBar label="Service" value={survey.service_rating} />
                            <RatingBar label="Amenities" value={survey.amenities_rating} />
                            <RatingBar label="Overall" value={survey.overall_rating} />
                          </div>
                          {survey.comments && (
                            <p className="mt-2 text-sm text-body italic border-l-2 border-gold pl-3">
                              "{survey.comments}"
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-subtext shrink-0">
                          {new Date(survey.submitted_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
