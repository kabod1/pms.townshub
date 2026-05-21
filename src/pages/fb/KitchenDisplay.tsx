import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, CheckCircle, ChefHat } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { FB_ORDER_TYPE_LABELS } from '@/lib/constants'
import toast from 'react-hot-toast'
import type { FBOrder, FBOrderStatus } from '@/types'

const KDS_STATUSES: FBOrderStatus[] = ['confirmed', 'preparing', 'ready']

const COLUMN_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: 'Queue', color: 'text-blue-700', bg: 'bg-blue-50' },
  preparing: { label: 'Preparing', color: 'text-orange-700', bg: 'bg-orange-50' },
  ready: { label: 'Ready', color: 'text-green-700', bg: 'bg-green-50' },
}

function useKDSOrders() {
  const { tenant } = useAuthStore()
  return useQuery({
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
    refetchInterval: 10_000,
  })
}

function minutesSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
}

export default function KitchenDisplay() {
  const qc = useQueryClient()
  const { data: orders = [], isLoading } = useKDSOrders()

  const advance = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FBOrderStatus }) => {
      await supabase.from('fb_orders').update({ status }).eq('id', id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fb-kds-orders'] })
      toast.success('Order updated')
    },
  })

  const NEXT: Record<string, FBOrderStatus> = {
    confirmed: 'preparing',
    preparing: 'ready',
    ready: 'delivered',
  }

  if (isLoading) return <DashboardLayout><LoadingSpinner fullPage /></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ChefHat size={22} className="text-gold" />
          <h1 className="text-xl font-bold text-body">Kitchen Display System</h1>
          <Badge label="Live" className="bg-green-100 text-green-700 animate-pulse" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          {KDS_STATUSES.map((status) => {
            const col = COLUMN_CONFIG[status]
            const colOrders = orders.filter((o) => o.status === status)
            return (
              <div key={status} className={`rounded-xl p-4 ${col.bg} min-h-[300px]`}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className={`font-bold text-base ${col.color}`}>{col.label}</h2>
                  <span className={`text-sm font-semibold ${col.color} bg-white rounded-full px-2 py-0.5`}>
                    {colOrders.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {colOrders.length === 0 && (
                    <p className={`text-sm text-center py-8 ${col.color} opacity-60`}>No orders</p>
                  )}
                  {colOrders.map((order) => {
                    const mins = minutesSince(order.created_at)
                    const isUrgent = mins > 20
                    return (
                      <div
                        key={order.id}
                        className={`bg-white rounded-lg p-3 shadow-sm border-l-4 ${
                          isUrgent ? 'border-red-500' : status === 'confirmed' ? 'border-blue-400' : status === 'preparing' ? 'border-orange-400' : 'border-green-400'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm text-body">
                              {order.room_number ? `Room ${order.room_number}` : order.table_number ? `Table ${order.table_number}` : order.guest_name ?? 'Guest'}
                            </p>
                            <p className="text-xs text-subtext">{FB_ORDER_TYPE_LABELS[order.order_type]}</p>
                          </div>
                          <div className={`flex items-center gap-1 text-xs ${isUrgent ? 'text-red-600 font-bold' : 'text-subtext'}`}>
                            <Clock size={11} />
                            {mins}m
                          </div>
                        </div>
                        <ul className="mt-2 space-y-0.5">
                          {order.items?.map((item) => (
                            <li key={item.id} className="text-sm text-body">
                              <span className="font-medium">{item.quantity}×</span> {item.name}
                              {item.notes && <span className="text-xs text-orange-600 ml-1">({item.notes})</span>}
                            </li>
                          ))}
                        </ul>
                        {order.notes && (
                          <p className="mt-1.5 text-xs italic text-subtext border-t border-gray-100 pt-1">{order.notes}</p>
                        )}
                        <div className="mt-2 flex justify-end">
                          <Button
                            size="sm"
                            variant={status === 'ready' ? 'primary' : 'outline'}
                            onClick={() => advance.mutate({ id: order.id, status: NEXT[status] })}
                            loading={advance.isPending}
                          >
                            {status === 'ready' ? (
                              <><CheckCircle size={13} /> Delivered</>
                            ) : (
                              <>{status === 'confirmed' ? 'Start' : 'Mark Ready'}</>
                            )}
                          </Button>
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
