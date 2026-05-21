import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { StatCard } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/lib/utils'
import { UtensilsCrossed, TrendingUp, ShoppingCart, Star } from 'lucide-react'
import { format, startOfMonth, endOfMonth, subDays, eachDayOfInterval, parseISO } from 'date-fns'
import type { FBOrder } from '@/types'
import { FB_ORDER_TYPE_LABELS } from '@/lib/constants'

const COLORS = ['#0B1F4B', '#C9A84C', '#1A5CB5', '#1B5E20', '#E65100', '#B71C1C']

function useFBReportData() {
  const { tenant } = useAuthStore()
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')
  const thirtyDaysAgo = format(subDays(new Date(), 29), 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['fb-report-data', tenant?.id, monthStart],
    queryFn: async () => {
      const [thisMonthRes, recentRes, topItemsRes] = await Promise.all([
        supabase
          .from('fb_orders')
          .select('subtotal, status, order_type, created_at')
          .eq('tenant_id', tenant!.id)
          .neq('status', 'cancelled')
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd),
        supabase
          .from('fb_orders')
          .select('subtotal, status, order_type, created_at')
          .eq('tenant_id', tenant!.id)
          .neq('status', 'cancelled')
          .gte('created_at', thirtyDaysAgo),
        supabase
          .from('fb_order_items')
          .select('name, quantity, total_price')
          .gte('created_at', monthStart),
      ])

      const monthOrders = (thisMonthRes.data ?? []) as Pick<FBOrder, 'subtotal' | 'status' | 'order_type' | 'created_at'>[]
      const recentOrders = (recentRes.data ?? []) as Pick<FBOrder, 'subtotal' | 'status' | 'order_type' | 'created_at'>[]

      const totalRevenue = monthOrders.reduce((s, o) => s + Number(o.subtotal), 0)
      const totalOrders = monthOrders.length
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
      const deliveredOrders = monthOrders.filter((o) => o.status === 'delivered').length

      // Daily revenue
      const days = eachDayOfInterval({ start: parseISO(thirtyDaysAgo), end: new Date() })
      const dailyRevenue = days.map((day) => {
        const ds = format(day, 'yyyy-MM-dd')
        const dayOrders = recentOrders.filter((o) => o.created_at.startsWith(ds))
        return {
          date: format(day, 'dd MMM'),
          revenue: dayOrders.reduce((s, o) => s + Number(o.subtotal), 0),
          orders: dayOrders.length,
        }
      })

      // Order type breakdown
      const typeMap: Partial<Record<string, number>> = {}
      for (const o of monthOrders) {
        typeMap[o.order_type] = (typeMap[o.order_type] ?? 0) + Number(o.subtotal)
      }
      const typeData = Object.entries(typeMap).map(([type, revenue]) => ({
        name: FB_ORDER_TYPE_LABELS[type as keyof typeof FB_ORDER_TYPE_LABELS] ?? type,
        value: revenue ?? 0,
      }))

      // Top items
      const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {}
      for (const item of topItemsRes.data ?? []) {
        if (!itemMap[item.name]) itemMap[item.name] = { name: item.name, qty: 0, revenue: 0 }
        itemMap[item.name].qty += item.quantity
        itemMap[item.name].revenue += Number(item.total_price)
      }
      const topItems = Object.values(itemMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8)

      return { totalRevenue, totalOrders, avgOrderValue, deliveredOrders, dailyRevenue, typeData, topItems }
    },
    enabled: !!tenant,
  })
}

export default function FBReporting() {
  const { tenant } = useAuthStore()
  const { data, isLoading } = useFBReportData()

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-body">F&B Revenue Reporting</h1>
          <p className="text-sm text-subtext">Current month food & beverage performance</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                title="F&B Revenue (Month)"
                value={formatCurrency(data.totalRevenue, tenant?.currency)}
                icon={<TrendingUp size={20} />}
                color="green"
              />
              <StatCard
                title="Total Orders"
                value={data.totalOrders}
                icon={<ShoppingCart size={20} />}
                color="navy"
              />
              <StatCard
                title="Avg Order Value"
                value={formatCurrency(data.avgOrderValue, tenant?.currency)}
                icon={<UtensilsCrossed size={20} />}
                color="gold"
              />
              <StatCard
                title="Delivered Orders"
                value={data.deliveredOrders}
                icon={<Star size={20} />}
                color="blue"
              />
            </div>

            {/* Daily revenue chart */}
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5">
              <h2 className="text-sm font-semibold text-body mb-4">Daily F&B Revenue — Last 30 Days</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.dailyRevenue} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D0DCF0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#4A5568' }} interval={4} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#4A5568' }} tickLine={false} axisLine={false} tickFormatter={(v) => `€${v}`} width={50} />
                  <Tooltip formatter={(v) => `€${Number(v).toFixed(2)}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="revenue" fill="#C9A84C" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Order type breakdown */}
              <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5">
                <h2 className="text-sm font-semibold text-body mb-4">Revenue by Order Type</h2>
                {data.typeData.length === 0 ? (
                  <p className="text-sm text-subtext text-center py-10">No data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={data.typeData} cx="50%" cy="50%" outerRadius={80} dataKey="value" paddingAngle={2}>
                        {data.typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `€${Number(v).toFixed(2)}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#4A5568' }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Top items */}
              <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5">
                <h2 className="text-sm font-semibold text-body mb-4">Top Menu Items (This Month)</h2>
                {data.topItems.length === 0 ? (
                  <p className="text-sm text-subtext text-center py-10">No data</p>
                ) : (
                  <div className="space-y-2">
                    {data.topItems.map((item, i) => (
                      <div key={item.name} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-subtext w-5">#{i + 1}</span>
                        <span className="flex-1 text-sm text-body truncate">{item.name}</span>
                        <span className="text-xs text-subtext">{item.qty}×</span>
                        <span className="text-sm font-semibold text-gold">{formatCurrency(item.revenue, tenant?.currency)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
