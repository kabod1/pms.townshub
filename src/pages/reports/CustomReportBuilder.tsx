import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Download, Play, Filter } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { format, subDays, subMonths, startOfMonth } from 'date-fns'
import { formatCurrency } from '@/lib/utils'

type Metric = 'revenue' | 'bookings' | 'occupancy' | 'adr' | 'revpar' | 'goppar'
type Grouping = 'day' | 'week' | 'month'
type ChartType = 'bar' | 'line' | 'table'

const METRIC_OPTIONS = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'bookings', label: 'Booking Count' },
  { value: 'occupancy', label: 'Occupancy Rate (%)' },
  { value: 'adr', label: 'ADR (Avg Daily Rate)' },
  { value: 'revpar', label: 'RevPAR' },
  { value: 'goppar', label: 'GOPPAR' },
]

const GROUPING_OPTIONS = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
]

const CHART_OPTIONS = [
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'table', label: 'Table' },
]

const PERIOD_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'mtd', label: 'Month to date' },
  { value: '3m', label: 'Last 3 months' },
  { value: 'custom', label: 'Custom range' },
]

function periodDates(period: string, customFrom: string, customTo: string) {
  const today = new Date()
  if (period === '7d') return { from: format(subDays(today, 6), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') }
  if (period === '30d') return { from: format(subDays(today, 29), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') }
  if (period === '90d') return { from: format(subDays(today, 89), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') }
  if (period === 'mtd') return { from: format(startOfMonth(today), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') }
  if (period === '3m') return { from: format(subMonths(today, 3), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') }
  return { from: customFrom, to: customTo }
}

export default function CustomReportBuilder() {
  const { tenant } = useAuthStore()
  const [metric, setMetric] = useState<Metric>('revenue')
  const [grouping, setGrouping] = useState<Grouping>('day')
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [period, setPeriod] = useState('30d')
  const [customFrom, setCustomFrom] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [runQuery, setRunQuery] = useState(false)

  const { from, to } = periodDates(period, customFrom, customTo)

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['custom-report', tenant?.id, metric, grouping, from, to, runQuery],
    queryFn: async () => {
      const [bookingsRes, roomsRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('total_amount, room_rate, check_in_date, check_out_date, status')
          .eq('tenant_id', tenant!.id)
          .in('status', ['confirmed', 'checked_in', 'checked_out'])
          .gte('check_in_date', from)
          .lte('check_in_date', to),
        supabase
          .from('rooms')
          .select('id')
          .eq('tenant_id', tenant!.id)
          .eq('is_active', true),
      ])

      const bookings = bookingsRes.data ?? []
      const totalRooms = roomsRes.data?.length ?? 1

      const buckets: Record<string, { label: string; revenue: number; bookings: number; roomNights: number; totalRevenue: number }> = {}

      for (const b of bookings) {
        let key: string
        const d = new Date(b.check_in_date)
        if (grouping === 'day') key = b.check_in_date
        else if (grouping === 'week') {
          const weekStart = new Date(d)
          weekStart.setDate(d.getDate() - d.getDay())
          key = format(weekStart, 'yyyy-MM-dd')
        } else {
          key = format(startOfMonth(d), 'yyyy-MM')
        }

        if (!buckets[key]) buckets[key] = { label: key, revenue: 0, bookings: 0, roomNights: 0, totalRevenue: 0 }
        buckets[key].revenue += Number(b.total_amount)
        buckets[key].bookings += 1
        const nights = Math.max(1, Math.ceil((new Date(b.check_out_date).getTime() - new Date(b.check_in_date).getTime()) / 86400000))
        buckets[key].roomNights += nights
        buckets[key].totalRevenue += Number(b.total_amount)
      }

      return Object.entries(buckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => {
          const occupancyNights = grouping === 'day' ? totalRooms : grouping === 'week' ? totalRooms * 7 : totalRooms * 30
          const occupancy = Math.min(100, Math.round((v.roomNights / occupancyNights) * 100))
          const adr = v.bookings > 0 ? v.revenue / v.bookings : 0
          const revpar = adr * (occupancy / 100)
          const totalCosts = v.revenue * 0.35
          const goppar = (v.revenue - totalCosts) / (grouping === 'day' ? totalRooms : occupancyNights)

          const metricValue: Record<Metric, number> = {
            revenue: v.revenue,
            bookings: v.bookings,
            occupancy,
            adr,
            revpar,
            goppar,
          }

          return {
            label: key,
            value: metricValue[metric],
            raw: v,
          }
        })
    },
    enabled: !!tenant && runQuery,
  })

  function exportCSV() {
    if (!reportData) return
    const metricLabel = METRIC_OPTIONS.find((m) => m.value === metric)?.label ?? metric
    const csv = [
      ['Period', metricLabel].join(','),
      ...reportData.map((row) => [row.label, row.value.toFixed(2)].join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${metric}-${from}-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const metricLabel = METRIC_OPTIONS.find((m) => m.value === metric)?.label ?? metric
  const isCurrency = ['revenue', 'adr', 'revpar', 'goppar'].includes(metric)

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-body">Custom Report Builder</h1>
            <p className="text-sm text-subtext">Build and export custom analytics reports</p>
          </div>
          <div className="flex gap-2">
            {reportData && (
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download size={15} /> Export CSV
              </Button>
            )}
          </div>
        </div>

        {/* Config panel */}
        <Card>
          <h2 className="text-sm font-semibold text-body mb-4 flex items-center gap-2">
            <Filter size={15} /> Report Configuration
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Select label="Metric" options={METRIC_OPTIONS} value={metric} onChange={(e) => setMetric(e.target.value as Metric)} />
            <Select label="Group By" options={GROUPING_OPTIONS} value={grouping} onChange={(e) => setGrouping(e.target.value as Grouping)} />
            <Select label="Chart Type" options={CHART_OPTIONS} value={chartType} onChange={(e) => setChartType(e.target.value as ChartType)} />
            <Select label="Period" options={PERIOD_OPTIONS} value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          {period === 'custom' && (
            <div className="mt-3 grid grid-cols-2 gap-4">
              <Input label="From" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <Input label="To" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setRunQuery((v) => !v)}>
              <Play size={15} /> Run Report
            </Button>
          </div>
        </Card>

        {/* Results */}
        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : reportData ? (
          reportData.length === 0 ? (
            <div className="text-center py-12 text-sm text-subtext">No data for this period and metric.</div>
          ) : (
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-body">{metricLabel} by {grouping}</h2>
                <span className="text-xs text-subtext">{from} to {to}</span>
              </div>

              {chartType !== 'table' ? (
                <ResponsiveContainer width="100%" height={300}>
                  {chartType === 'bar' ? (
                    <BarChart data={reportData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#D0DCF0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#4A5568' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11, fill: '#4A5568' }} tickLine={false} axisLine={false} tickFormatter={(v) => isCurrency ? `€${Math.round(v)}` : String(Math.round(v))} width={60} />
                      <Tooltip formatter={(v) => isCurrency ? formatCurrency(Number(v), tenant?.currency) : `${Number(v).toFixed(1)}${metric === 'occupancy' ? '%' : ''}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="value" fill="#C9A84C" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  ) : (
                    <LineChart data={reportData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#D0DCF0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#4A5568' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11, fill: '#4A5568' }} tickLine={false} axisLine={false} tickFormatter={(v) => isCurrency ? `€${Math.round(v)}` : String(Math.round(v))} width={60} />
                      <Tooltip formatter={(v) => isCurrency ? formatCurrency(Number(v), tenant?.currency) : `${Number(v).toFixed(1)}${metric === 'occupancy' ? '%' : ''}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Line type="monotone" dataKey="value" stroke="#0B1F4B" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-mid">
                        <th className="text-left py-2 px-3 text-subtext font-medium">Period</th>
                        <th className="text-right py-2 px-3 text-subtext font-medium">{metricLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((row) => (
                        <tr key={row.label} className="border-b border-mid hover:bg-light">
                          <td className="py-2 px-3 text-body font-mono text-xs">{row.label}</td>
                          <td className="py-2 px-3 text-right font-semibold text-body">
                            {isCurrency
                              ? formatCurrency(row.value, tenant?.currency)
                              : metric === 'occupancy'
                              ? `${row.value.toFixed(1)}%`
                              : Math.round(row.value).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="text-center py-12 text-sm text-subtext">Configure your report and click "Run Report" to see results.</div>
        )}
      </div>
    </DashboardLayout>
  )
}
