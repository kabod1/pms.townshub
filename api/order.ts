import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  )
}

interface OrderItem {
  menu_item_id: string
  name: string
  quantity: number
  unit_price: number
  notes?: string | null
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { slug, items, table_number, guest_name, notes, payment_method, table_token } = req.body ?? {}

  if (!slug) return res.status(400).json({ error: 'slug required' })
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items required' })

  // Basic input validation
  for (const item of items) {
    if (!item.menu_item_id || !item.name || item.quantity < 1 || item.unit_price < 0) {
      return res.status(400).json({ error: 'Invalid item data' })
    }
  }

  const db = getServiceClient()

  const { data: tenant, error: tenantErr } = await db
    .from('tenants')
    .select('id, currency')
    .eq('slug', slug)
    .single()

  if (tenantErr || !tenant) return res.status(404).json({ error: 'Venue not found' })

  const subtotal = (items as OrderItem[]).reduce(
    (sum, item) => sum + item.unit_price * item.quantity, 0
  )

  const { data: order, error: orderErr } = await db
    .from('fb_orders')
    .insert({
      tenant_id:      tenant.id,
      table_number:   table_number ?? null,
      guest_name:     guest_name ?? null,
      order_type:     table_number ? 'table' : 'takeaway',
      status:         'pending',
      subtotal,
      notes:          notes ?? null,
      payment_method: payment_method ?? 'cash',
      is_paid:        false,
      table_token:    table_token ?? null,
    })
    .select('id')
    .single()

  if (orderErr || !order) {
    console.error('Order insert error:', orderErr)
    return res.status(500).json({ error: 'Failed to create order' })
  }

  const orderItems = (items as OrderItem[]).map((item) => ({
    order_id:     order.id,
    menu_item_id: item.menu_item_id,
    name:         item.name,
    quantity:     item.quantity,
    unit_price:   item.unit_price,
    total_price:  item.unit_price * item.quantity,
    notes:        item.notes ?? null,
  }))

  const { error: itemsErr } = await db.from('fb_order_items').insert(orderItems)

  if (itemsErr) {
    console.error('Order items insert error:', itemsErr)
    await db.from('fb_orders').delete().eq('id', order.id)
    return res.status(500).json({ error: 'Failed to save order items' })
  }

  return res.json({ success: true, order_id: order.id })
}
