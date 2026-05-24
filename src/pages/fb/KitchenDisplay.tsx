import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, CheckCircle, ChefHat, Banknote, CreditCard } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { FB_ORDER_TYPE_LABELS } from '@/lib/constants'
import toast from 'react-hot-toast'
import type { FBOrder, FBOrderStatus } from '@/types'

const KDS_STATUSES: FBOrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready']

const COLUMN_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'New',      color: 'text-purple-700', bg: 'bg-purple-50' },
  confirmed: { label: 'Queue',    color: 'text-blue-700',   bg: 'bg-blue-50'   },
  preparing: { label: 'Preparing',color: 'text-orange-700', bg: 'bg-orange-50' },
  ready:     { label: 'Ready',    color: 'text-green-700',  bg: 'bg-green-50'  },
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1108, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7)
    osc.start()
    osc.stop(ctx.currentTime + 0.7)
  } catch {}
}

function minutesSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
}

function urgencyClass(mins: number, status: string): string {
  if (status === 'ready') return 'border-green-400'
  if (mins >= 12) return 'border-red-500'
  if (mins >= 5)  return 'border-amber-400'
  if (status === 'pending')   return 'border-purple-400'
  if (status === 'confirmed') return 'border-blue-400'
  return 'border-orange-400'
}

export default function KitchenDisplay() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()
  const prevCountRef = useRef(0)

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['fb-kds-orders', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fb_orders')
        .select('*, items:fb_order_items(*)')
        .eq('tenant_id', tenant!.id)
        .in('status', KDS_STATUSES)
        .order('created_at')
      if (error) throw error
      return data as FBOrder[]
    },
    enabled: !!tenant,
  })

  // Realtime subscription
  useEffect(() => {
    if (!tenant) return
    const channel = supabase
      .channel(`kds-${tenant.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fb_orders', filter: `tenant_id=eq.${tenant.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') playChime()
          qc.invalidateQueries({ queryKey: ['fb-kds-orders', tenant.id] })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tenant?.id, qc])

  // Chime on new orders (fallback for initial load)
  useEffect(() => {
    const newCount = orders.filter((o) => o.status === 'pending').length
    if (newCount > prevCountRef.current) playChime()
    prevCountRef.current = newCount
  }, [orders])

  const advance = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FBOrderStatus }) => {
      await supabase.from('fb_orders').update({ status }).eq('id', id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fb-kds-orders'] })
      toast.success('Order updated')
    },
  })

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('fb_orders').update({ is_paid: true }).eq('id', id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fb-kds-orders'] })
      toast.success('Marked as paid')
    },
  })

  const NEXT: Record<string, FBOrderStatus> = {
    pending:   'confirmed',
    confirmed: 'preparing',
    preparing: 'ready',
    ready:     'delivered',
  }

  if (isLoading) return <DashboardLayout><LoadingSpinner fullPage /></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <ChefHat size={22} className="text-gold" />
          <h1 className="text-xl font-bold text-body">Kitchen Display System</h1>
          <Badge label="Live" className="bg-green-100 text-green-700 animate-pulse" />
          <span className="text-xs text-subtext ml-auto">
            🔴 &gt;12 min · 🟡 &gt;5 min
          </span>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {KDS_STATUSES.map((status) => {
            const col = COLUMN_CONFIG[status]
            const colOrders = orders.filter((o) => o.status === status)
            return (
              <div key={status} className={`rounded-xl p-3 ${col.bg} min-h-[300px]`}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className={`font-bold text-sm ${col.color}`}>{col.label}</h2>
                  <span className={`text-xs font-semibold ${col.color} bg-white rounded-full px-2 py-0.5`}>
                    {colOrders.length}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {colOrders.length === 0 && (
                    <p className={`text-xs text-center py-8 ${col.color} opacity-50`}>No orders</p>
                  )}
                  {colOrders.map((order) => {
                    const mins = minutesSince(order.created_at)
                    return (
                      <div
                        key={order.id}
                        className={`bg-white rounded-lg p-3 shadow-sm border-l-4 ${urgencyClass(mins, status)}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-body truncate">
                              {order.room_number
                                ? `Room ${order.room_number}`
                                : order.table_number
                                ? `Table ${order.table_number}`
                                : order.guest_name ?? 'Guest'}
                            </p>
                            <p className="text-[11px] text-subtext">{FB_ORDER_TYPE_LABELS[order.order_type]}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`flex items-center gap-0.5 text-[11px] font-bold ${mins >= 12 ? 'text-red-600' : mins >= 5 ? 'text-amber-600' : 'text-subtext'}`}>
                              <Clock size={10} />{mins}m
                            </span>
                            {order.payment_method === 'cash' ? (
                              <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${order.is_paid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                <Banknote size={9} />{order.is_paid ? 'Paid' : 'Cash'}
                              </span>
                            ) : order.payment_method === 'card' ? (
                              <span className="flex items-center gap-0.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                                <CreditCard size={9} />Card
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <ul className="space-y-0.5 mb-2">
                          {order.items?.map((item) => (
                            <li key={item.id} className="text-sm text-body">
                              <span className="font-semibold">{item.quantity}×</span> {item.name}
                              {item.notes && <span className="text-[11px] text-orange-600 ml-1">({item.notes})</span>}
                            </li>
                          ))}
                        </ul>

                        {order.notes && (
                          <p className="text-[11px] italic text-subtext border-t border-gray-100 pt-1 mb-2">{order.notes}</p>
                        )}

                        <div className="flex gap-1.5 flex-wrap">
                          <Button
                            size="sm"
                            variant={status === 'ready' ? 'primary' : 'outline'}
                            onClick={() => advance.mutate({ id: order.id, status: NEXT[status] })}
                            loading={advance.isPending}
                            className="flex-1 text-xs"
                          >
                            {status === 'pending'   && 'Confirm'}
                            {status === 'confirmed' && 'Start'}
                            {status === 'preparing' && 'Mark Ready'}
                            {status === 'ready'     && <><CheckCircle size={12} />Delivered</>}
                          </Button>
                          {order.payment_method === 'cash' && !order.is_paid && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markPaid.mutate(order.id)}
                              loading={markPaid.isPending}
                              className="text-xs border-green-300 text-green-700 hover:bg-green-50"
                            >
                              <Banknote size={12} />Paid
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </DashboardLayout>
  )
}
