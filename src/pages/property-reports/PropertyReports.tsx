import { useQuery } from '@tanstack/react-query'
import {
  PieChart,
  DollarSign,
  TrendingUp,
  Home,
  AlertCircle,
  Percent,
} from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { UnitStatus } from '@/types/database'

// ─── Unit status colors ────────────────────────────────────────────────────────

const STATUS_COLORS: Record<UnitStatus, string> = {
  vacant: 'bg-gray-100 text-gray-700 border-gray-300',
  occupied: 'bg-green-100 text-green-800 border-green-300',
  reserved: 'bg-blue-100 text-blue-800 border-blue-300',
  maintenance: 'bg-amber-100 text-amber-800 border-amber-300',
  not_available: 'bg-red-100 text-red-800 border-red-300',
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="rounded-xl border border-mid bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-subtext uppercase tracking-wide">{label}</p>
          <p className="mt-1 text-2xl font-bold text-body">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-subtext">{sub}</p>}
        </div>
        <span className={`rounded-lg p-2 ${color}`}>
          <Icon size={20} className="text-white" />
        </span>
      </div>
    </div>
  )
}

// ─── Queries ─────────────────────────────────────────────────────────────────

interface ReportData {
  portfolioValue: number
  monthlyRentRoll: number
  occupancyRate: number
  totalArrears: number
  managementFeesEarned: number
  unitsByStatus: Record<UnitStatus, number>
  rentByMonth: { month: string; expected: number; collected: number }[]
  topOverdue: { id: string; amount: number; balance: number; due_date: string; property_tenant_id: string | null; unit_id: string | null }[]
}

function usePropertyReports() {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['property-reports', tenant?.id],
    enabled: !!tenant,
    queryFn: async (): Promise<ReportData> => {
      const tenantId = useAuthStore.getState().tenant?.id
      if (!tenantId) throw new Error('Not authenticated')

      const [unitsResult, leasesResult, rentScheduleResult, statementsResult] = await Promise.all([
        supabase.from('units').select('id, market_rent, status').eq('tenant_id', tenantId).eq('is_active', true),
        supabase.from('leases').select('monthly_rent').eq('tenant_id', tenantId).eq('status', 'active'),
        supabase.from('rent_schedule').select('id, amount, paid_amount, balance, status, due_date, property_tenant_id, unit_id').eq('tenant_id', tenantId),
        supabase.from('owner_statements').select('management_fee').eq('tenant_id', tenantId),
      ])

      // Portfolio value
      const units = unitsResult.data ?? []
      const portfolioValue = units.reduce((s, u) => s + ((u.market_rent ?? 0) * 12), 0)

      // Monthly rent roll from active leases
      const leases = leasesResult.data ?? []
      const monthlyRentRoll = leases.reduce((s, l) => s + (l.monthly_rent ?? 0), 0)

      // Occupancy rate
      const totalActive = units.length
      const occupied = units.filter((u) => u.status === 'occupied').length
      const occupancyRate = totalActive > 0 ? (occupied / totalActive) * 100 : 0

      // Units by status
      const unitsByStatus: Record<UnitStatus, number> = {
        vacant: 0, occupied: 0, reserved: 0, maintenance: 0, not_available: 0,
      }
      units.forEach((u) => {
        if (u.status in unitsByStatus) unitsByStatus[u.status as UnitStatus]++
      })

      // Rent schedule
      const schedule = rentScheduleResult.data ?? []

      // Total arrears
      const overdueRows = schedule.filter((r) => r.status === 'overdue')
      const totalArrears = overdueRows.reduce((s, r) => s + (r.balance ?? 0), 0)

      // Management fees
      const stmts = statementsResult.data ?? []
      const managementFeesEarned = stmts.reduce((s, st) => s + (st.management_fee ?? 0), 0)

      // Rent by month (last 6 months)
      const now = new Date()
      const rentByMonth = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const nextD = new Date(d.getFullYear(), d.getMonth() + 1, 1)
        const nextKey = `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, '0')}-01`
        const monthStart = `${monthKey}-01`

        const monthRows = schedule.filter((r) => r.due_date >= monthStart && r.due_date < nextKey)
        const expected = monthRows.reduce((s, r) => s + (r.amount ?? 0), 0)
        const collected = monthRows.reduce((s, r) => s + (r.paid_amount ?? 0), 0)

        return {
          month: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          expected,
          collected,
        }
      })

      // Top 5 overdue accounts
      const topOverdue = [...overdueRows]
        .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0))
        .slice(0, 5)

      return {
        portfolioValue,
        monthlyRentRoll,
        occupancyRate,
        totalArrears,
        managementFeesEarned,
        unitsByStatus,
        rentByMonth,
        topOverdue,
      }
    },
  })
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PropertyReports() {
  const { data, isLoading } = usePropertyReports()

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-40 text-sm text-subtext">Loading reports...</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 p-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-body">Property Reports</h1>
          <p className="mt-0.5 text-sm text-subtext">Portfolio financial overview and analytics</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
          <SummaryCard
            label="Total Portfolio Value"
            value={fmt(data?.portfolioValue ?? 0)}
            sub="Annual market rent"
            icon={Home}
            color="bg-navy"
          />
          <SummaryCard
            label="Monthly Rent Roll"
            value={fmt(data?.monthlyRentRoll ?? 0)}
            sub="Active leases"
            icon={DollarSign}
            color="bg-green-500"
          />
          <SummaryCard
            label="Occupancy Rate"
            value={`${(data?.occupancyRate ?? 0).toFixed(1)}%`}
            sub="Active units"
            icon={Percent}
            color="bg-blue-500"
          />
          <SummaryCard
            label="Total Arrears"
            value={fmt(data?.totalArrears ?? 0)}
            sub="Overdue balances"
            icon={AlertCircle}
            color="bg-red-500"
          />
          <SummaryCard
            label="Management Fees"
            value={fmt(data?.managementFeesEarned ?? 0)}
            sub="All statements"
            icon={TrendingUp}
            color="bg-amber-500"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Rent Collection by Month */}
          <div className="xl:col-span-2 rounded-xl border border-mid bg-white shadow-sm">
            <div className="border-b border-mid px-5 py-4">
              <h2 className="text-sm font-semibold text-body">Rent Collection — Last 6 Months</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-mid bg-light text-left text-xs font-medium text-subtext uppercase tracking-wide">
                    <th className="px-4 py-3">Month</th>
                    <th className="px-4 py-3 text-right">Expected</th>
                    <th className="px-4 py-3 text-right">Collected</th>
                    <th className="px-4 py-3 text-right">Collection %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mid">
                  {(data?.rentByMonth ?? []).map((row) => {
                    const pct = row.expected > 0 ? (row.collected / row.expected) * 100 : 0
                    return (
                      <tr key={row.month} className="hover:bg-light/50">
                        <td className="px-4 py-3 font-medium text-body">{row.month}</td>
                        <td className="px-4 py-3 text-right text-body">{fmt(row.expected)}</td>
                        <td className="px-4 py-3 text-right text-green-700 font-medium">{fmt(row.collected)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs font-medium ${pct >= 90 ? 'text-green-600' : pct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                            {pct.toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Units by Status */}
          <div className="rounded-xl border border-mid bg-white shadow-sm">
            <div className="border-b border-mid px-5 py-4">
              <h2 className="text-sm font-semibold text-body">Units by Status</h2>
            </div>
            <div className="space-y-3 p-5">
              {(Object.entries(data?.unitsByStatus ?? {}) as [UnitStatus, number][]).map(([status, count]) => (
                <div key={status} className={`flex items-center justify-between rounded-lg border px-4 py-3 ${STATUS_COLORS[status]}`}>
                  <span className="text-sm font-medium capitalize">{status.replace('_', ' ')}</span>
                  <span className="text-xl font-bold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Overdue Accounts */}
        <div className="rounded-xl border border-mid bg-white shadow-sm">
          <div className="border-b border-mid px-5 py-4">
            <h2 className="text-sm font-semibold text-body">Top Overdue Accounts</h2>
          </div>
          {(data?.topOverdue ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-subtext">
              <PieChart size={36} className="mb-2 opacity-30" />
              <p className="text-sm">No overdue accounts</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-mid bg-light text-left text-xs font-medium text-subtext uppercase tracking-wide">
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3 text-right">Amount Due</th>
                    <th className="px-4 py-3 text-right">Balance Owed</th>
                    <th className="px-4 py-3">Tenant ID</th>
                    <th className="px-4 py-3">Unit ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mid">
                  {data?.topOverdue.map((row) => (
                    <tr key={row.id} className="hover:bg-light/50">
                      <td className="px-4 py-3 text-red-700 font-medium">
                        {new Date(row.due_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right text-body">{fmt(row.amount)}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-700">{fmt(row.balance ?? 0)}</td>
                      <td className="px-4 py-3 text-xs text-subtext font-mono">{row.property_tenant_id?.slice(0, 8) ?? '—'}...</td>
                      <td className="px-4 py-3 text-xs text-subtext font-mono">{row.unit_id?.slice(0, 8) ?? '—'}...</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
