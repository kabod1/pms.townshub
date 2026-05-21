import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, ChevronDown, Clock, UtensilsCrossed } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/lib/utils'
import {
  FB_ORDER_STATUS_LABELS, FB_ORDER_STATUS_COLORS,
  FB_ORDER_TYPE_LABELS,
} from '@/lib/constants'
import toast from 'react-hot-toast'
import type { FBOrder, FBOrderStatus, FBMenuItem } from '@/types'

const STATUS_FLOW: Record<FBOrderStatus, FBOrderStatus | null> = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
  delivered: null,
  cancelled: null,
}

const orderSchema = z.object({
  order_type: z.string().min(1),
  room_number: z.string().optional(),
  table_number: z.string().optional(),
  guest_name: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    menu_item_id: z.string().min(1, 'Select an item'),
    quantity: z.coerce.number().min(1),
    notes: z.string().optional(),
  })).min(1, 'Add at least one item'),
})
type OrderForm = z.infer<typeof orderSchema>

const ORDER_TYPE_OPTIONS = [
  { value: 'room_service', label: 'Room Service' },
  { value: 'table', label: 'Table' },
  { value: 'poolside', label: 'Poolside' },
  { value: 'takeaway', label: 'Takeaway' },
]

function useFBOrders(statusFilter: string) {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['fb-orders', tenant?.id, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from('fb_orders')
        .select('*, items:fb_order_items(*, menu_item:fb_menu_items(name,price))')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false })
      if (statusFilter !== 'all') {
        q = q.eq('status', statusFilter)
      }
      const { data, error } = await q
      if (error) throw error
      return data as FBOrder[]
    },
    enabled: !!tenant,
    refetchInterval: 20_000,
  })
}

function useMenuItems() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['fb-menu-items-available', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fb_menu_items')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .eq('is_active', true)
        .eq('is_available', true)
        .order('name')
      if (error) throw error
      return data as FBMenuItem[]
    },
    enabled: !!tenant,
  })
}

export default function FBOrders() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)

  const { data: orders = [], isLoading } = useFBOrders(statusFilter)
  const { data: menuItems = [] } = useMenuItems()

  const form = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: { order_type: 'room_service', items: [{ menu_item_id: '', quantity: 1 }] },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })

  const createOrder = useMutation({
    mutationFn: async (data: OrderForm) => {
      const orderItems = data.items.map((item) => {
        const mi = menuItems.find((m) => m.id === item.menu_item_id)
        return {
          menu_item_id: item.menu_item_id,
          name: mi?.name ?? '',
          quantity: item.quantity,
          unit_price: mi?.price ?? 0,
          total_price: (mi?.price ?? 0) * item.quantity,
          notes: item.notes || null,
        }
      })
      const subtotal = orderItems.reduce((s, i) => s + i.total_price, 0)
      const { data: order, error } = await supabase
        .from('fb_orders')
        .insert({
          tenant_id: tenant!.id,
          order_type: data.order_type,
          room_number: data.room_number || null,
          table_number: data.table_number || null,
          guest_name: data.guest_name || null,
          notes: data.notes || null,
          subtotal,
          status: 'pending',
        })
        .select()
        .single()
      if (error) throw error
      await supabase.from('fb_order_items').insert(orderItems.map((i) => ({ ...i, order_id: order.id })))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fb-orders'] })
      toast.success('Order created')
      setShowModal(false)
      form.reset({ order_type: 'room_service', items: [{ menu_item_id: '', quantity: 1 }] })
    },
    onError: () => toast.error('Failed to create order'),
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FBOrderStatus }) => {
      await supabase.from('fb_orders').update({ status }).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fb-orders'] }),
  })

  const menuOptions = menuItems.map((m) => ({
    value: m.id,
    label: `${m.name} — ${formatCurrency(m.price, tenant?.currency)}`,
  }))

  const STATUS_TABS = ['all', 'pending', 'confirmed', 'preparing', 'ready', 'delivered'] as const

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-body">F&B Orders</h1>
            <p className="text-sm text-subtext">Room service, table, and poolside orders</p>
          </div>
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus size={15} /> New Order
          </Button>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-mid">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize whitespace-nowrap border-b-2 -mb-px transition-colors ${
                statusFilter === tab ? 'border-gold text-gold' : 'border-transparent text-subtext hover:text-body'
              }`}
            >
              {tab === 'all' ? 'All' : FB_ORDER_STATUS_LABELS[tab as FBOrderStatus]}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed size={32} />}
            title="No orders"
            description="No orders match the selected filter."
          />
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const nextStatus = STATUS_FLOW[order.status]
              return (
                <div key={order.id} className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          label={FB_ORDER_STATUS_LABELS[order.status]}
                          className={FB_ORDER_STATUS_COLORS[order.status]}
                        />
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {FB_ORDER_TYPE_LABELS[order.order_type]}
                        </span>
                        {order.room_number && (
                          <span className="text-xs text-subtext">Room {order.room_number}</span>
                        )}
                        {order.table_number && (
                          <span className="text-xs text-subtext">Table {order.table_number}</span>
                        )}
                        {order.guest_name && (
                          <span className="text-xs text-subtext">· {order.guest_name}</span>
                        )}
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        {order.items?.map((item) => (
                          <p key={item.id} className="text-sm text-body">
                            {item.quantity}× {item.name}
                            {item.notes && <span className="text-subtext"> ({item.notes})</span>}
                          </p>
                        ))}
                      </div>
                      {order.notes && (
                        <p className="mt-1 text-xs text-subtext italic">{order.notes}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-body">{formatCurrency(order.subtotal, tenant?.currency)}</p>
                      <p className="text-xs text-subtext flex items-center gap-1 justify-end mt-0.5">
                        <Clock size={11} />
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <div className="flex gap-2 mt-2 justify-end">
                        {nextStatus && (
                          <Button
                            size="sm"
                            onClick={() => updateStatus.mutate({ id: order.id, status: nextStatus })}
                            loading={updateStatus.isPending}
                          >
                            {FB_ORDER_STATUS_LABELS[nextStatus]}
                            <ChevronDown size={13} />
                          </Button>
                        )}
                        {order.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => updateStatus.mutate({ id: order.id, status: 'cancelled' })}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* New Order Modal */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); form.reset({ order_type: 'room_service', items: [{ menu_item_id: '', quantity: 1 }] }) }}
        title="New Order"
      >
        <form onSubmit={form.handleSubmit((d) => createOrder.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Order Type" options={ORDER_TYPE_OPTIONS} {...form.register('order_type')} />
            <Input label="Room / Table No." placeholder="e.g. 102 or T4" {...form.register('room_number')} />
            <div className="col-span-2">
              <Input label="Guest Name" placeholder="Optional" {...form.register('guest_name')} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-body">Order Items</p>
              <button
                type="button"
                onClick={() => append({ menu_item_id: '', quantity: 1 })}
                className="text-xs text-gold hover:underline"
              >
                + Add item
              </button>
            </div>
            <div className="space-y-2">
              {fields.map((field, i) => (
                <div key={field.id} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Select
                      label={i === 0 ? 'Item' : undefined}
                      options={[{ value: '', label: 'Select item…' }, ...menuOptions]}
                      error={form.formState.errors.items?.[i]?.menu_item_id?.message}
                      {...form.register(`items.${i}.menu_item_id`)}
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      label={i === 0 ? 'Qty' : undefined}
                      type="number"
                      min={1}
                      {...form.register(`items.${i}.quantity`)}
                    />
                  </div>
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600 mb-1">×</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Input label="Order Notes" placeholder="Allergies, preferences…" {...form.register('notes')} />

          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createOrder.isPending}>Place Order</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
