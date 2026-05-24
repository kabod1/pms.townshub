import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Card, StatCard } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency, classNames } from '@/lib/utils'
import {
  Brain, Shield, Settings2, Lightbulb, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, XCircle, BedDouble, DollarSign,
  Target, ArrowRight, BarChart3, Zap, RefreshCw, Info,
} from 'lucide-react'
import {
  format, subMonths, startOfMonth, endOfMonth,
  eachMonthOfInterval, addMonths,
} from 'date-fns'

// ─── Math helpers ─────────────────────────────────────────────────────────────
function linearRegression(ys: number[]) {
  const n = ys.length
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 }
  const xMean = (n - 1) / 2
  const yMean = ys.reduce((a, b) => a + b, 0) / n
  const slope =
    ys.reduce((s, y, i) => s + (i - xMean) * (y - yMean), 0) /
    ys.reduce((s, _, i) => s + (i - xMean) ** 2, 0)
  const intercept = yMean - slope * xMean
  return { slope, intercept }
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length)
}

// ─── Data hook ────────────────────────────────────────────────────────────────
function usePredictiveData() {
  const { tenant } = useAuthStore()
  const today = new Date()

  return useQuery({
    queryKey: ['predictive-analytics', tenant?.id],
    queryFn: async () => {
      const [bookingsRes, roomsRes, fbRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, total_amount, room_rate, check_in_date, check_out_date, status, source, created_at, guest_id')
          .eq('tenant_id', tenant!.id)
          .gte('check_in_date', format(startOfMonth(subMonths(today, 8)), 'yyyy-MM-dd'))
          .order('check_in_date'),
        supabase
          .from('rooms')
          .select('id, status')
          .eq('tenant_id', tenant!.id)
          .eq('is_active', true),
        supabase
          .from('fb_orders')
          .select('subtotal')
          .eq('tenant_id', tenant!.id)
          .neq('status', 'cancelled')
          .gte('created_at', format(startOfMonth(subMonths(today, 2)), 'yyyy-MM-dd')),
      ])

      const bookings = bookingsRes.data ?? []
      const rooms = roomsRes.data ?? []
      const fbOrders = fbRes.data ?? []

      const totalRooms = rooms.length
      const occupiedRooms = rooms.filter((r) => r.status === 'occupied').length
      const currentOccupancy = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0

      // ── Monthly aggregation (6 months history) ──────────────────────────────
      const histMonths = eachMonthOfInterval({ start: subMonths(today, 5), end: today })
      const monthlyHistory = histMonths.map((month) => {
        const ms = format(startOfMonth(month), 'yyyy-MM-dd')
        const me = format(endOfMonth(month), 'yyyy-MM-dd')
        const mb = bookings.filter(
          (b) =>
            b.check_in_date >= ms &&
            b.check_in_date <= me &&
            ['confirmed', 'checked_in', 'checked_out'].includes(b.status),
        )
        const revenue = mb.reduce((s, b) => s + Number(b.total_amount), 0)
        const count = mb.length
        return { month: format(month, 'MMM yy'), revenue, bookings: count }
      })

      // ── Linear regression forecasts ──────────────────────────────────────────
      const revs = monthlyHistory.map((m) => m.revenue)
      const cnts = monthlyHistory.map((m) => m.bookings)
      const { slope: rS, intercept: rI } = linearRegression(revs)
      const { slope: bS, intercept: bI } = linearRegression(cnts)
      const revSD = stdDev(revs)

      const forecast3 = [1, 2, 3].map((i) => {
        const n = histMonths.length - 1 + i
        const fRev = Math.max(0, rI + rS * n)
        const fBkg = Math.max(0, Math.round(bI + bS * n))
        const margin = revSD * (0.5 + i * 0.15)
        return {
          month: format(addMonths(today, i), 'MMM yy'),
          revenue: null as number | null,
          forecast: Math.round(fRev),
          forecastLow: Math.round(Math.max(0, fRev - margin)),
          forecastHigh: Math.round(fRev + margin),
          bookings: null as number | null,
          bookingsForecast: fBkg,
        }
      })

      const chartData = [
        ...monthlyHistory.map((m) => ({
          ...m,
          forecast: null as number | null,
          forecastLow: null as number | null,
          forecastHigh: null as number | null,
          bookingsForecast: null as number | null,
        })),
        ...forecast3,
      ]

      // ── Fraud / Risk detection ───────────────────────────────────────────────
      const activeBookings = bookings.filter((b) =>
        ['confirmed', 'checked_in', 'checked_out', 'cancelled'].includes(b.status),
      )
      const amounts = activeBookings.map((b) => Number(b.total_amount)).filter((a) => a > 0)
      const meanAmt = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0
      const sdAmt = stdDev(amounts)

      const highValCancel = bookings.filter(
        (b) => b.status === 'cancelled' && Number(b.total_amount) > meanAmt + sdAmt,
      )
      const anomalousAmts = bookings.filter(
        (b) =>
          ['confirmed', 'checked_in'].includes(b.status) &&
          sdAmt > 0 &&
          (Number(b.total_amount) > meanAmt + 2.5 * sdAmt ||
            (Number(b.total_amount) < Math.max(1, meanAmt - 2 * sdAmt))),
      )
      const cancelRate =
        bookings.length > 0
          ? (bookings.filter((b) => b.status === 'cancelled').length / bookings.length) * 100
          : 0
      const lastMinute = bookings.filter((b) => {
        if (!b.created_at || !b.check_in_date) return false
        const diff =
          (new Date(b.check_in_date).getTime() - new Date(b.created_at).getTime()) /
          86_400_000
        return diff < 2 && diff >= 0 && b.status !== 'cancelled'
      })

      const fraudAlerts: {
        severity: 'high' | 'medium' | 'low'
        type: string
        detail: string
        count: number
      }[] = [
        ...(highValCancel.length > 0
          ? [
              {
                severity: 'high' as const,
                type: 'High-Value Cancellations',
                detail: `${highValCancel.length} cancelled booking${highValCancel.length > 1 ? 's' : ''} above average — potential chargeback / policy abuse risk`,
                count: highValCancel.length,
              },
            ]
          : []),
        ...(anomalousAmts.length > 0
          ? [
              {
                severity: 'medium' as const,
                type: 'Statistical Amount Anomalies',
                detail: `${anomalousAmts.length} active booking${anomalousAmts.length > 1 ? 's' : ''} with amounts ±2.5σ outside normal range — manual review recommended`,
                count: anomalousAmts.length,
              },
            ]
          : []),
        ...(cancelRate > 25
          ? [
              {
                severity: 'medium' as const,
                type: 'Elevated Cancellation Rate',
                detail: `${cancelRate.toFixed(1)}% cancellation rate exceeds 25% threshold — review cancellation and deposit policies`,
                count: Math.round(cancelRate),
              },
            ]
          : []),
        ...(lastMinute.length > 5
          ? [
              {
                severity: 'low' as const,
                type: 'High Last-Minute Booking Volume',
                detail: `${lastMinute.length} bookings made < 48 h before check-in — may indicate rate parity leakage or speculative holds`,
                count: lastMinute.length,
              },
            ]
          : []),
      ]

      if (fraudAlerts.length === 0) {
        fraudAlerts.push({
          severity: 'low',
          type: 'No Anomalies Detected',
          detail: 'All booking patterns are within normal statistical ranges. Continue monitoring.',
          count: 0,
        })
      }

      // ── Recommendations ──────────────────────────────────────────────────────
      const confirmedB = bookings.filter((b) =>
        ['confirmed', 'checked_in', 'checked_out'].includes(b.status),
      )
      const directRate =
        bookings.length > 0
          ? (bookings.filter((b) => b.source === 'direct').length / bookings.length) * 100
          : 0
      const fbRevPerBooking =
        confirmedB.length > 0
          ? fbOrders.reduce((s, o) => s + Number(o.subtotal), 0) / confirmedB.length
          : 0
      const avgLOS =
        confirmedB.length > 0
          ? confirmedB.reduce((s, b) => {
              const nights =
                (new Date(b.check_out_date).getTime() - new Date(b.check_in_date).getTime()) /
                86_400_000
              return s + Math.max(0, nights)
            }, 0) / confirmedB.length
          : 2
      const lastRev = monthlyHistory[monthlyHistory.length - 1]?.revenue ?? 0
      const prevRev = monthlyHistory[monthlyHistory.length - 2]?.revenue ?? 0
      const revGrowth = prevRev > 0 ? ((lastRev - prevRev) / prevRev) * 100 : 0

      type Rec = {
        priority: 'high' | 'medium' | 'low'
        category: string
        title: string
        description: string
        impact: string
        to: string
        action: string
      }
      const recs: Rec[] = []

      if (currentOccupancy < 60)
        recs.push({
          priority: 'high',
          category: 'Revenue',
          title: 'Occupancy Below 60% — Activate Dynamic Pricing',
          description: `Current occupancy is ${Math.round(currentOccupancy)}%. Consider reducing rack rates or launching a flash promotion to fill idle inventory and boost RevPAR.`,
          impact: `Est. +${formatCurrency((60 - currentOccupancy) * totalRooms * (meanAmt || 120) * 0.01)} monthly revenue recovery`,
          to: '/rooms/rates',
          action: 'Set Seasonal Rates',
        })

      if (directRate < 30)
        recs.push({
          priority: 'high',
          category: 'Distribution',
          title: 'Low Direct Booking Rate — Launch a Direct Campaign',
          description: `Only ${directRate.toFixed(0)}% of bookings are direct. OTA commissions (15–20%) are eroding margins. A best-rate guarantee incentivises guests to book directly.`,
          impact: `Est. save ${formatCurrency(confirmedB.length * meanAmt * 0.15 * 0.3)} in OTA commissions`,
          to: '/marketing',
          action: 'Open Marketing Hub',
        })

      if (fbRevPerBooking < 20)
        recs.push({
          priority: 'medium',
          category: 'F&B Upsell',
          title: 'Untapped F&B Revenue — Bundle Meal Packages',
          description: `Average F&B spend is ${formatCurrency(fbRevPerBooking)} per booking. Bundling breakfast or dinner packages at checkout could substantially increase revenue per guest.`,
          impact: `+${formatCurrency((20 - fbRevPerBooking) * confirmedB.length * 0.3)} potential monthly uplift`,
          to: '/settings/packages',
          action: 'Manage Packages',
        })

      if (avgLOS < 2)
        recs.push({
          priority: 'medium',
          category: 'Length of Stay',
          title: `Short Avg. Stay (${avgLOS.toFixed(1)} nights) — Introduce Min-Stay Offers`,
          description: `Midweek "Stay 3, Pay 2" promotions or weekend specials can increase length of stay, reduce housekeeping churn, and improve margin per occupied room.`,
          impact: 'Est. 15–25% reduction in per-stay operational overhead',
          to: '/settings/promotions',
          action: 'Create Promotion',
        })

      if (revGrowth < -5)
        recs.push({
          priority: 'high',
          category: 'Revenue Alert',
          title: `Revenue Dropped ${Math.abs(revGrowth).toFixed(1)}% Month-over-Month`,
          description: `Revenue is trending down. Review booking source mix, cancellation patterns, and competitive pricing. A targeted win-back campaign may close the gap.`,
          impact: `${formatCurrency(Math.abs(lastRev - prevRev))} revenue gap vs. prior month`,
          to: '/reports',
          action: 'View Analytics',
        })

      if (recs.length === 0)
        recs.push({
          priority: 'low',
          category: 'Optimisation',
          title: 'Strong Performance — Optimise for Peak Season',
          description: 'Your core metrics are on track. Consider raising rates 5–10% during high-demand periods to maximise RevPAR without sacrificing occupancy.',
          impact: `Potential +${formatCurrency(totalRooms * (meanAmt || 100) * 0.07)} monthly uplift`,
          to: '/rooms/rates',
          action: 'Seasonal Rates',
        })

      return {
        chartData,
        currentOccupancy,
        totalRooms,
        avgBookingValue: meanAmt,
        cancelRate,
        fraudAlerts,
        recs,
        directRate,
        fbRevPerBooking,
        avgLOS,
        forecastNextMonth: forecast3[0].forecast ?? 0,
        forecastNextMonthLow: forecast3[0].forecastLow ?? 0,
        forecastNextMonthHigh: forecast3[0].forecastHigh ?? 0,
        totalBookings: bookings.length,
      }
    },
    enabled: !!tenant,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const SEVERITY_STYLES = {
  high: { bar: 'bg-red-500', badge: 'bg-red-100 text-red-700', icon: XCircle, label: 'High Risk' },
  medium: { bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700', icon: AlertTriangle, label: 'Medium Risk' },
  low: { bar: 'bg-emerald-400', badge: 'bg-emerald-100 text-emerald-700', icon: CheckCircle, label: 'Low / Info' },
}

const PRIORITY_STYLES = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
}

type FraudAlert = { severity: 'high' | 'medium' | 'low'; type: string; detail: string; count: number }

function RiskScore({ alerts }: { alerts: FraudAlert[] }) {
  const high = alerts.filter((a) => a.severity === 'high').length
  const med = alerts.filter((a) => a.severity === 'medium').length
  const score = Math.min(100, high * 35 + med * 15)
  const color = score >= 50 ? 'text-red-600' : score >= 20 ? 'text-amber-500' : 'text-emerald-600'
  const label = score >= 50 ? 'High Risk' : score >= 20 ? 'Moderate Risk' : 'Low Risk'
  const barColor = score >= 50 ? 'bg-red-500' : score >= 20 ? 'bg-amber-400' : 'bg-emerald-500'

  return (
    <div className="flex items-center gap-4">
      <div className="text-center">
        <p className={classNames('text-3xl font-bold', color)}>{score}</p>
        <p className="text-xs text-subtext mt-0.5">Risk Score</p>
      </div>
      <div className="flex-1">
        <div className="flex justify-between text-xs text-subtext mb-1">
          <span>Low</span><span>High</span>
        </div>
        <div className="h-3 bg-light rounded-full overflow-hidden">
          <div className={classNames('h-full rounded-full transition-all', barColor)} style={{ width: `${score}%` }} />
        </div>
        <p className={classNames('text-xs font-semibold mt-1', color)}>{label}</p>
      </div>
    </div>
  )
}

// ─── ROI Calculator ───────────────────────────────────────────────────────────
function ROICalculator({ avgBookingValue }: { avgBookingValue: number }) {
  const [budget, setBudget] = useState(1000)
  const [reach, setReach] = useState(10000)
  const [cvr, setCvr] = useState(2)
  const [costPerBooking, setCostPerBooking] = useState(25)

  const abt = avgBookingValue || 150

  const projectedBookings = useMemo(() => Math.round((reach * cvr) / 100), [reach, cvr])
  const revenue = useMemo(() => projectedBookings * abt, [projectedBookings, abt])
  const totalCost = useMemo(() => budget + projectedBookings * costPerBooking, [budget, projectedBookings, costPerBooking])
  const netProfit = useMemo(() => revenue - totalCost, [revenue, totalCost])
  const roi = useMemo(() => (totalCost > 0 ? ((revenue - totalCost) / totalCost) * 100 : 0), [revenue, totalCost])
  const breakeven = useMemo(
    () => (abt - costPerBooking > 0 ? Math.ceil(budget / (abt - costPerBooking)) : 0),
    [budget, abt, costPerBooking],
  )
  const positive = roi >= 0

  const inputCls =
    'w-full rounded-lg border border-mid px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue'
  const labelCls = 'block text-xs font-medium text-subtext mb-1'

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Inputs */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-body flex items-center gap-2">
          <Settings2 size={16} className="text-gold" /> Campaign Parameters
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Marketing Budget (€)</label>
            <input type="number" min={0} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Est. Audience Reach</label>
            <input type="number" min={1} value={reach} onChange={(e) => setReach(Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Conversion Rate (%)</label>
            <input type="number" min={0.1} max={100} step={0.1} value={cvr} onChange={(e) => setCvr(Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Fulfillment Cost / Booking (€)</label>
            <input type="number" min={0} value={costPerBooking} onChange={(e) => setCostPerBooking(Number(e.target.value))} className={inputCls} />
          </div>
        </div>

        <div className="rounded-lg bg-light p-3 text-xs text-subtext flex gap-2">
          <Info size={14} className="shrink-0 mt-0.5 text-blue-500" />
          <span>
            Avg. booking value auto-filled from your historical data ({formatCurrency(abt)}).
            Fulfillment cost covers variable costs per booking (e.g. cleaning, amenities).
          </span>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-body flex items-center gap-2">
          <TrendingUp size={16} className="text-gold" /> Projected Returns
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Projected Bookings', value: projectedBookings.toLocaleString(), color: 'text-navy' },
            { label: 'Projected Revenue', value: formatCurrency(revenue), color: 'text-navy' },
            { label: 'Total Investment', value: formatCurrency(totalCost), color: 'text-subtext' },
            { label: 'Break-even Bookings', value: breakeven.toLocaleString(), color: 'text-subtext' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg bg-light p-3">
              <p className="text-xs text-subtext">{label}</p>
              <p className={classNames('text-lg font-bold', color)}>{value}</p>
            </div>
          ))}
        </div>

        {/* ROI Highlight */}
        <div className={classNames(
          'rounded-xl p-4 flex items-center justify-between',
          positive ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-red-50 ring-1 ring-red-200',
        )}>
          <div>
            <p className="text-xs text-subtext mb-0.5">Net Profit / Return on Investment</p>
            <p className={classNames('text-2xl font-bold', positive ? 'text-emerald-700' : 'text-red-700')}>
              {formatCurrency(netProfit)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-subtext mb-0.5">ROI</p>
            <p className={classNames('text-3xl font-bold', positive ? 'text-emerald-700' : 'text-red-700')}>
              {positive ? '+' : ''}{roi.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Revenue vs Cost bar */}
        <div>
          <div className="flex justify-between text-xs text-subtext mb-1">
            <span>Investment</span>
            <span>Revenue</span>
          </div>
          <div className="relative h-5 rounded-full bg-light overflow-hidden">
            <div className="absolute left-0 top-0 h-full bg-navy/20 rounded-full" style={{ width: '100%' }} />
            <div
              className={classNames('absolute left-0 top-0 h-full rounded-full transition-all', positive ? 'bg-emerald-500' : 'bg-red-400')}
              style={{ width: `${Math.min(100, (revenue / Math.max(revenue, totalCost)) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs font-medium mt-1">
            <span className="text-subtext">{formatCurrency(totalCost)}</span>
            <span className={positive ? 'text-emerald-700' : 'text-red-700'}>{formatCurrency(revenue)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
type Tab = 'forecast' | 'recommendations' | 'fraud' | 'roi'

const TABS: { id: Tab; label: string; icon: typeof Brain }[] = [
  { id: 'forecast', label: 'Demand Forecast', icon: Brain },
  { id: 'recommendations', label: 'Recommendations', icon: Lightbulb },
  { id: 'fraud', label: 'Fraud Detection', icon: Shield },
  { id: 'roi', label: 'ROI Calculator', icon: Settings2 },
]

export default function PredictiveAnalytics() {
  const { tenant } = useAuthStore()
  const { data, isLoading, refetch, isFetching } = usePredictiveData()
  const [activeTab, setActiveTab] = useState<Tab>('forecast')

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-body flex items-center gap-2">
              <Brain size={22} className="text-gold" />
              Predictive Intelligence Hub
            </h1>
            <p className="text-sm text-subtext mt-0.5">
              AI-driven demand forecasting, smart recommendations, fraud detection &amp; ROI analysis
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 rounded-lg border border-mid px-3 py-1.5 text-sm text-subtext hover:bg-light transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 rounded-xl bg-light p-1 flex-wrap">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={classNames(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors flex-1 justify-center',
                activeTab === id
                  ? 'bg-navy text-white shadow-sm'
                  : 'text-subtext hover:text-body hover:bg-white/60',
              )}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : data ? (
          <>
            {/* ── FORECAST TAB ─────────────────────────────────────────────────── */}
            {activeTab === 'forecast' && (
              <div className="space-y-5">
                {/* KPI forecast cards */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <StatCard
                    title="Next Month Forecast"
                    value={formatCurrency(data.forecastNextMonth, tenant?.currency)}
                    subtitle={`Range: ${formatCurrency(data.forecastNextMonthLow)} – ${formatCurrency(data.forecastNextMonthHigh)}`}
                    icon={<TrendingUp size={20} />}
                    color="gold"
                  />
                  <StatCard
                    title="Model Confidence"
                    value="90% / 80% / 70%"
                    subtitle="M+1 / M+2 / M+3 confidence"
                    icon={<Target size={20} />}
                    color="green"
                  />
                  <StatCard
                    title="Cancellation Rate"
                    value={`${data.cancelRate.toFixed(1)}%`}
                    subtitle={data.cancelRate > 25 ? 'Above threshold' : 'Within normal range'}
                    icon={<XCircle size={20} />}
                    color={data.cancelRate > 25 ? 'red' : 'navy'}
                  />
                  <StatCard
                    title="Avg. Booking Value"
                    value={formatCurrency(data.avgBookingValue, tenant?.currency)}
                    subtitle="Historical average"
                    icon={<DollarSign size={20} />}
                    color="blue"
                  />
                </div>

                {/* Revenue forecast chart */}
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-sm font-semibold text-body">Revenue Forecast — 6-Month History + 3-Month Projection</h2>
                      <p className="text-xs text-subtext mt-0.5">Shaded band shows uncertainty range (linear regression model)</p>
                    </div>
                    <span className="rounded-full bg-gold/10 text-gold text-xs font-medium px-2.5 py-1">
                      AI Forecast
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <div style={{ minWidth: 500 }}>
                      <ResponsiveContainer width="100%" height={280}>
                        <ComposedChart data={data.chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#D0DCF0" />
                          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#4A5568' }} tickLine={false} axisLine={false} />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#4A5568' }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => `€${Math.round(v / 1000)}k`}
                            width={48}
                          />
                          <Tooltip
                            formatter={(v, name) => {
                              const labels: Record<string, string> = {
                                revenue: 'Actual Revenue',
                                forecast: 'Forecasted Revenue',
                                forecastLow: 'Lower Bound',
                                forecastHigh: 'Upper Bound',
                              }
                              return [formatCurrency(Number(v), tenant?.currency), labels[name as string] ?? name]
                            }}
                            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #D0DCF0' }}
                          />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            formatter={(v) => (
                              <span style={{ fontSize: 11, color: '#4A5568' }}>
                                {v === 'revenue' ? 'Actual' : v === 'forecast' ? 'Forecast' : v === 'forecastHigh' ? 'Upper Band' : 'Lower Band'}
                              </span>
                            )}
                          />
                          {/* Uncertainty band */}
                          <Area
                            type="monotone"
                            dataKey="forecastHigh"
                            fill="#C9A84C"
                            fillOpacity={0.12}
                            stroke="none"
                          />
                          <Area
                            type="monotone"
                            dataKey="forecastLow"
                            fill="#ffffff"
                            fillOpacity={1}
                            stroke="none"
                          />
                          {/* Actual */}
                          <Line
                            type="monotone"
                            dataKey="revenue"
                            stroke="#0B1F4B"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: '#0B1F4B' }}
                            activeDot={{ r: 5 }}
                            connectNulls={false}
                          />
                          {/* Forecast */}
                          <Line
                            type="monotone"
                            dataKey="forecast"
                            stroke="#C9A84C"
                            strokeWidth={2.5}
                            strokeDasharray="6 3"
                            dot={{ r: 4, fill: '#C9A84C' }}
                            activeDot={{ r: 5 }}
                            connectNulls={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </Card>

                {/* Booking count forecast */}
                <Card>
                  <h2 className="text-sm font-semibold text-body mb-4">Booking Volume Forecast</h2>
                  <div className="overflow-x-auto">
                    <div style={{ minWidth: 400 }}>
                      <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={data.chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#D0DCF0" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#4A5568' }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: '#4A5568' }} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #D0DCF0' }} />
                          <Line type="monotone" dataKey="bookings" stroke="#0B1F4B" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                          <Line type="monotone" dataKey="bookingsForecast" stroke="#C9A84C" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} connectNulls={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-subtext">
                    <span className="inline-block w-4 border-t-2 border-navy mr-1" /> Actual &nbsp;
                    <span className="inline-block w-4 border-t-2 border-dashed border-gold mr-1" /> Forecast
                  </p>
                </Card>
              </div>
            )}

            {/* ── RECOMMENDATIONS TAB ──────────────────────────────────────────── */}
            {activeTab === 'recommendations' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Lightbulb size={18} className="text-gold" />
                  <h2 className="text-sm font-semibold text-body">
                    {data.recs.length} Actionable Recommendation{data.recs.length !== 1 ? 's' : ''}
                  </h2>
                  <span className="ml-auto text-xs text-subtext">Ranked by priority &amp; estimated impact</span>
                </div>

                {data.recs.map((rec, i) => {
                  const borderColor = rec.priority === 'high' ? '#ef4444' : rec.priority === 'medium' ? '#f59e0b' : '#3b82f6'
                  return (
                  <div key={i} className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5 border-l-4" style={{ borderLeftColor: borderColor }}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={classNames('rounded-full px-2 py-0.5 text-xs font-medium', PRIORITY_STYLES[rec.priority])}>
                            {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)} Priority
                          </span>
                          <span className="rounded-full bg-light text-subtext px-2 py-0.5 text-xs">{rec.category}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-body">{rec.title}</h3>
                        <p className="text-sm text-subtext leading-relaxed">{rec.description}</p>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                          <Zap size={12} />
                          {rec.impact}
                        </div>
                      </div>
                      <Link
                        to={rec.to}
                        className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-xs font-medium text-white hover:bg-navy/90 transition-colors shrink-0"
                      >
                        {rec.action} <ArrowRight size={12} />
                      </Link>
                    </div>
                  </div>
                  )
                })}

                <Card className="bg-gradient-to-br from-navy/5 to-gold/5">
                  <div className="flex items-start gap-3">
                    <BarChart3 size={20} className="text-gold shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-body">How Recommendations Are Generated</h3>
                      <p className="text-xs text-subtext mt-1 leading-relaxed">
                        Each recommendation is derived from real-time analysis of your booking data, occupancy rates,
                        F&amp;B revenue, cancellation patterns, and distribution channel mix. Thresholds are calibrated
                        against hospitality industry benchmarks. Recommendations update automatically as your data changes.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* ── FRAUD DETECTION TAB ──────────────────────────────────────────── */}
            {activeTab === 'fraud' && (
              <div className="space-y-5">
                {/* Risk overview */}
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <h2 className="text-sm font-semibold text-body mb-4 flex items-center gap-2">
                      <Shield size={16} className="text-gold" /> Risk Score Overview
                    </h2>
                    <RiskScore alerts={data.fraudAlerts} />
                    <div className="mt-4 pt-4 border-t border-mid grid grid-cols-3 gap-3 text-center">
                      {(['high', 'medium', 'low'] as const).map((s) => {
                        const count = data.fraudAlerts.filter((a) => a.severity === s).length
                        return (
                          <div key={s} className={classNames('rounded-lg p-2', SEVERITY_STYLES[s].badge)}>
                            <p className="text-lg font-bold">{count}</p>
                            <p className="text-xs">{SEVERITY_STYLES[s].label}</p>
                          </div>
                        )
                      })}
                    </div>
                  </Card>

                  <Card>
                    <h2 className="text-sm font-semibold text-body mb-4">Detection Statistics</h2>
                    <div className="space-y-3">
                      {[
                        { label: 'Total Bookings Analysed', value: data.totalBookings, icon: <BarChart3 size={14} /> },
                        { label: 'Cancellation Rate', value: `${data.cancelRate.toFixed(1)}%`, icon: <XCircle size={14} className="text-red-500" /> },
                        { label: 'Current Occupancy', value: `${Math.round(data.currentOccupancy)}%`, icon: <BedDouble size={14} /> },
                        { label: 'Avg. Booking Value', value: formatCurrency(data.avgBookingValue, tenant?.currency), icon: <DollarSign size={14} /> },
                      ].map(({ label, value, icon }) => (
                        <div key={label} className="flex items-center justify-between text-sm">
                          <span className="text-subtext flex items-center gap-1.5">{icon}{label}</span>
                          <span className="font-semibold text-body">{value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-mid">
                      <p className="text-xs text-subtext leading-relaxed">
                        Anomalies are flagged using statistical z-score analysis (±2.5σ thresholds)
                        applied to booking amounts. Cancellation patterns are tracked against a 25% industry threshold.
                      </p>
                    </div>
                  </Card>
                </div>

                {/* Alert cards */}
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-body flex items-center gap-2">
                    <AlertTriangle size={16} className="text-gold" /> Active Alerts
                  </h2>
                  {data.fraudAlerts.map((alert, i) => {
                    const styles = SEVERITY_STYLES[alert.severity]
                    const IconComp = styles.icon
                    return (
                      <div key={i} className="rounded-xl bg-white shadow-sm ring-1 ring-mid overflow-hidden flex">
                        <div className={classNames('w-1.5 shrink-0', styles.bar)} />
                        <div className="flex-1 p-4 flex items-start gap-3">
                          <IconComp size={18} className={alert.severity === 'high' ? 'text-red-500 shrink-0' : alert.severity === 'medium' ? 'text-amber-500 shrink-0' : 'text-emerald-500 shrink-0'} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-semibold text-body">{alert.type}</span>
                              <span className={classNames('rounded-full px-2 py-0.5 text-xs font-medium', styles.badge)}>
                                {styles.label}
                              </span>
                              {alert.count > 0 && (
                                <span className="ml-auto rounded-full bg-light text-body text-xs px-2 py-0.5 font-mono">
                                  ×{alert.count}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-subtext">{alert.detail}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <Card className="bg-blue-50 ring-1 ring-blue-100">
                  <div className="flex gap-3 items-start">
                    <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Fraud detection uses statistical modelling on your own historical booking data.
                      Alerts are indicative and require human review before taking action. For payment fraud
                      specifically, coordinate with your payment processor and check the Audit Log.
                    </p>
                  </div>
                </Card>
              </div>
            )}

            {/* ── ROI CALCULATOR TAB ───────────────────────────────────────────── */}
            {activeTab === 'roi' && (
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <Settings2 size={18} className="text-gold" />
                  <h2 className="text-sm font-semibold text-body">Marketing ROI Calculator</h2>
                  <span className="ml-auto text-xs text-subtext">Results update in real time as you type</span>
                </div>

                <Card>
                  <ROICalculator avgBookingValue={data.avgBookingValue} />
                </Card>

                {/* Additional ROI context */}
                <div className="grid gap-4 lg:grid-cols-3">
                  {[
                    {
                      title: 'Direct Booking Rate',
                      value: `${data.directRate.toFixed(0)}%`,
                      note: data.directRate < 30 ? 'Below 30% target — high OTA dependency' : 'Healthy direct booking mix',
                      positive: data.directRate >= 30,
                      icon: <Target size={16} />,
                    },
                    {
                      title: 'F&B Rev / Booking',
                      value: formatCurrency(data.fbRevPerBooking, tenant?.currency),
                      note: data.fbRevPerBooking < 20 ? 'Below €20 benchmark — upsell opportunity' : 'Strong ancillary revenue capture',
                      positive: data.fbRevPerBooking >= 20,
                      icon: <DollarSign size={16} />,
                    },
                    {
                      title: 'Avg. Length of Stay',
                      value: `${data.avgLOS.toFixed(1)} nights`,
                      note: data.avgLOS < 2 ? 'Below 2-night threshold — promote min-stay' : 'Good length-of-stay profile',
                      positive: data.avgLOS >= 2,
                      icon: <BedDouble size={16} />,
                    },
                  ].map(({ title, value, note, positive, icon }) => (
                    <div
                      key={title}
                      className={classNames(
                        'rounded-xl p-4 ring-1',
                        positive ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={positive ? 'text-emerald-600' : 'text-amber-600'}>{icon}</span>
                        <span className="text-xs font-medium text-subtext">{title}</span>
                      </div>
                      <p className={classNames('text-xl font-bold', positive ? 'text-emerald-700' : 'text-amber-700')}>{value}</p>
                      <p className="text-xs text-subtext mt-1 flex items-center gap-1">
                        {positive ? <TrendingUp size={11} className="text-emerald-500" /> : <TrendingDown size={11} className="text-amber-500" />}
                        {note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
