import { createClient } from '@supabase/supabase-js'

const SUPER_ADMIN_EMAILS = ['childrenfromlight@gmail.com']

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  )
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).end()

  // Verify the caller is a super admin via their JWT
  const authHeader = req.headers.authorization ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const db = getServiceClient()
  const { data: { user }, error: authError } = await db.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' })
  if (!SUPER_ADMIN_EMAILS.includes(user.email ?? '')) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const [tenantsRes, roomsRes, bookingsRes, guestsRes, hkRes, fbOrdersRes] = await Promise.all([
    db.from('tenants').select('id, name, slug, city, country, subscription_tier, subscription_status, created_at'),
    db.from('rooms').select('tenant_id, status'),
    db.from('bookings').select('tenant_id, status, total_amount, check_in_date, created_at'),
    db.from('guests').select('tenant_id, created_at'),
    db.from('housekeeping_tasks').select('tenant_id, status'),
    db.from('fb_orders').select('tenant_id, status, created_at'),
  ])

  const tenants = tenantsRes.data ?? []
  const rooms = roomsRes.data ?? []
  const bookings = bookingsRes.data ?? []
  const guests = guestsRes.data ?? []
  const hkTasks = hkRes.data ?? []
  const fbOrders = fbOrdersRes.data ?? []

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const hotelStats = tenants.map((t) => {
    const tRooms = rooms.filter((r) => r.tenant_id === t.id)
    const tBookings = bookings.filter((b) => b.tenant_id === t.id)
    const tGuests = guests.filter((g) => g.tenant_id === t.id)
    const tHk = hkTasks.filter((h) => h.tenant_id === t.id)
    const tFbOrders = fbOrders.filter((o) => o.tenant_id === t.id)

    const occupied = tRooms.filter((r) => r.status === 'occupied').length
    const totalRooms = tRooms.length
    const totalRevenue = tBookings.reduce((s, b) => s + Number(b.total_amount ?? 0), 0)
    const monthRevenue = tBookings
      .filter((b) => b.created_at >= thisMonthStart)
      .reduce((s, b) => s + Number(b.total_amount ?? 0), 0)
    const activeBookings = tBookings.filter((b) => ['confirmed', 'checked_in'].includes(b.status)).length

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      city: t.city,
      country: t.country,
      subscription_tier: t.subscription_tier,
      subscription_status: t.subscription_status,
      joined: t.created_at,
      totalRooms,
      occupiedRooms: occupied,
      occupancyRate: totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0,
      totalBookings: tBookings.length,
      activeBookings,
      totalRevenue,
      monthRevenue,
      totalGuests: tGuests.length,
      pendingHk: tHk.filter((h) => h.status === 'pending').length,
      activeFbOrders: tFbOrders.filter((o) => ['pending', 'in_progress'].includes(o.status)).length,
    }
  })

  const platform = {
    totalHotels: tenants.length,
    totalRooms: rooms.length,
    totalBookings: bookings.length,
    totalGuests: guests.length,
    totalRevenue: bookings.reduce((s, b) => s + Number(b.total_amount ?? 0), 0),
    monthRevenue: bookings
      .filter((b) => b.created_at >= thisMonthStart)
      .reduce((s, b) => s + Number(b.total_amount ?? 0), 0),
    activeBookings: bookings.filter((b) => ['confirmed', 'checked_in'].includes(b.status)).length,
    occupiedRooms: rooms.filter((r) => r.status === 'occupied').length,
  }

  // Recent signups (last 10 tenants)
  const recentSignups = [...tenants]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)

  return res.json({ platform, hotels: hotelStats, recentSignups })
}
