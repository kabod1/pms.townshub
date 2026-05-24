import { createClient } from '@supabase/supabase-js'

const SUPER_ADMIN_EMAILS = ['admin@townshub.cy']

function getDb() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  )
}

async function verifyAdmin(req: any, db: ReturnType<typeof getDb>) {
  const token = (req.headers.authorization ?? '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) return null
  if (!SUPER_ADMIN_EMAILS.includes(user.email ?? '')) return null
  return user
}

// Simple in-memory rate limiter
const _rl = new Map<string, { count: number; reset: number }>()
function rateLimit(key: string, max = 30, windowMs = 60_000) {
  const now = Date.now()
  let e = _rl.get(key)
  if (!e || now > e.reset) { e = { count: 0, reset: now + windowMs }; _rl.set(key, e) }
  e.count++
  return e.count <= max
}

function getIp(req: any) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? 'unknown'
}

function setCors(req: any, res: any) {
  const allowed = ['https://pms.townshub.com', 'http://localhost:5173', 'http://localhost:4173']
  const origin = req.headers.origin ?? ''
  res.setHeader('Access-Control-Allow-Origin', allowed.includes(origin) ? origin : allowed[0])
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Vary', 'Origin')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store')
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!rateLimit(`admin:${getIp(req)}`)) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  const db = getDb()
  const user = await verifyAdmin(req, db)
  if (!user) return res.status(403).json({ error: 'Forbidden' })

  // ── PATCH: update tenant mode ──────────────────────────────────────
  if (req.method === 'PATCH') {
    const { tenantId, mode } = req.body ?? {}
    if (!tenantId || !['hotel', 'property', 'both'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid tenantId or mode' })
    }
    const { error } = await db.from('tenants').update({ mode }).eq('id', tenantId)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  if (req.method !== 'GET') return res.status(405).end()

  // ── GET: platform stats + analytics ───────────────────────────────
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const thirtyDaysAgo  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const todayStart     = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const fifteenMinAgo  = new Date(now.getTime() - 15 * 60 * 1000).toISOString()

  // Core data (must succeed)
  const [
    tenantsRes, roomsRes, bookingsRes, guestsRes, hkRes, fbOrdersRes,
    propertiesRes, unitsRes, leasesRes, rentRes,
  ] = await Promise.all([
    db.from('tenants').select('id, name, slug, city, country, subscription_tier, subscription_status, created_at, mode'),
    db.from('rooms').select('tenant_id, status'),
    db.from('bookings').select('tenant_id, status, total_amount, check_in_date, created_at'),
    db.from('guests').select('tenant_id, created_at'),
    db.from('housekeeping_tasks').select('tenant_id, status'),
    db.from('fb_orders').select('tenant_id, status, created_at'),
    db.from('properties').select('tenant_id, is_active'),
    db.from('property_units').select('tenant_id, status'),
    db.from('leases').select('tenant_id, status'),
    db.from('rent_schedule').select('tenant_id, status, amount, due_date'),
  ])

  // Analytics data (optional — table may not exist yet)
  let pageViews: any[] = []
  try {
    const pvRes = await db
      .from('page_views')
      .select('path, browser, device_type, session_id, tenant_id, viewed_at, country, city, flag')
      .gte('viewed_at', thirtyDaysAgo)
    pageViews = pvRes.data ?? []
  } catch {
    pageViews = []
  }

  const tenants    = tenantsRes.data    ?? []
  const rooms      = roomsRes.data      ?? []
  const bookings   = bookingsRes.data   ?? []
  const guests     = guestsRes.data     ?? []
  const hkTasks    = hkRes.data         ?? []
  const fbOrders   = fbOrdersRes.data   ?? []
  const properties = propertiesRes.data ?? []
  const units      = unitsRes.data      ?? []
  const leases     = leasesRes.data     ?? []
  const rentRows   = rentRes.data       ?? []

  // ── Analytics ────────────────────────────────────────────────────────
  const viewsToday     = pageViews.filter((v) => v.viewed_at >= todayStart).length
  const viewsThisMonth = pageViews.length
  const sessionsToday  = new Set(pageViews.filter((v) => v.viewed_at >= todayStart).map((v) => v.session_id)).size
  const activeNow      = new Set(pageViews.filter((v) => v.viewed_at >= fifteenMinAgo).map((v) => v.session_id)).size

  const dailyViews = Array.from({ length: 7 }, (_, i) => {
    const d    = new Date(now)
    d.setDate(d.getDate() - (6 - i))
    const from = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
    const to   = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString()
    return {
      day:   d.toLocaleDateString('en', { weekday: 'short' }),
      date:  from.slice(0, 10),
      views: pageViews.filter((v) => v.viewed_at >= from && v.viewed_at < to).length,
    }
  })

  const pathCounts: Record<string, number> = {}
  pageViews.forEach((v) => { pathCounts[v.path] = (pathCounts[v.path] ?? 0) + 1 })
  const topPages = Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([path, count]) => ({ path, count }))

  const browserCounts: Record<string, number> = {}
  pageViews.forEach((v) => { const b = v.browser ?? 'Other'; browserCounts[b] = (browserCounts[b] ?? 0) + 1 })
  const browserBreakdown = Object.entries(browserCounts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))

  const dc = { desktop: 0, mobile: 0, tablet: 0 }
  pageViews.forEach((v) => { const d = (v.device_type ?? 'desktop') as keyof typeof dc; if (d in dc) dc[d]++ })
  const deviceBreakdown = [
    { name: 'Desktop', value: dc.desktop },
    { name: 'Mobile',  value: dc.mobile  },
    { name: 'Tablet',  value: dc.tablet  },
  ]

  // Country breakdown
  const countryCounts: Record<string, { count: number; flag: string; city_sample: string }> = {}
  pageViews.forEach((v) => {
    const key = v.country ?? 'Unknown'
    if (!countryCounts[key]) countryCounts[key] = { count: 0, flag: v.flag ?? '', city_sample: v.city ?? '' }
    countryCounts[key].count++
    if (v.city && !countryCounts[key].city_sample) countryCounts[key].city_sample = v.city
  })
  const countryBreakdown = Object.entries(countryCounts)
    .sort((a, b) => b[1].count - a[1].count).slice(0, 15)
    .map(([country, d]) => ({ country, count: d.count, flag: d.flag, city_sample: d.city_sample }))

  // City breakdown (top 15)
  const cityCounts: Record<string, { count: number; country: string; flag: string }> = {}
  pageViews.forEach((v) => {
    if (!v.city) return
    const key = v.city
    if (!cityCounts[key]) cityCounts[key] = { count: 0, country: v.country ?? '', flag: v.flag ?? '' }
    cityCounts[key].count++
  })
  const cityBreakdown = Object.entries(cityCounts)
    .sort((a, b) => b[1].count - a[1].count).slice(0, 15)
    .map(([city, d]) => ({ city, count: d.count, country: d.country, flag: d.flag }))

  const analytics = { viewsToday, viewsThisMonth, sessionsToday, activeNow, dailyViews, topPages, browserBreakdown, deviceBreakdown, countryBreakdown, cityBreakdown }

  // ── Per-tenant stats ─────────────────────────────────────────────────
  const tenantStats = tenants.map((t) => {
    const tRooms    = rooms.filter((r) => r.tenant_id === t.id)
    const tBookings = bookings.filter((b) => b.tenant_id === t.id)
    const tGuests   = guests.filter((g) => g.tenant_id === t.id)
    const tHk       = hkTasks.filter((h) => h.tenant_id === t.id)
    const tFb       = fbOrders.filter((o) => o.tenant_id === t.id)
    const tProps    = properties.filter((p) => p.tenant_id === t.id)
    const tUnits    = units.filter((u) => u.tenant_id === t.id)
    const tLeases   = leases.filter((l) => l.tenant_id === t.id)
    const tRent     = rentRows.filter((r) => r.tenant_id === t.id)

    const occupied       = tRooms.filter((r) => r.status === 'occupied').length
    const totalRooms     = tRooms.length
    const totalRevenue   = tBookings.reduce((s, b) => s + Number(b.total_amount ?? 0), 0)
    const monthRevenue   = tBookings.filter((b) => b.created_at >= thisMonthStart).reduce((s, b) => s + Number(b.total_amount ?? 0), 0)
    const activeBookings = tBookings.filter((b) => ['confirmed', 'checked_in'].includes(b.status)).length
    const occupiedUnits  = tUnits.filter((u) => u.status === 'occupied').length
    const activeLeases   = tLeases.filter((l) => l.status === 'active').length
    const monthlyRent    = tRent.filter((r) => r.due_date >= thisMonthStart && r.status === 'paid').reduce((s, r) => s + Number(r.amount ?? 0), 0)
    const overdueRent    = tRent.filter((r) => r.status === 'overdue').length
    const pageViewCount  = pageViews.filter((v) => v.tenant_id === t.id).length

    return {
      id: t.id, name: t.name, slug: t.slug, city: t.city, country: t.country,
      mode: t.mode ?? 'hotel', subscription_tier: t.subscription_tier,
      subscription_status: t.subscription_status, joined: t.created_at,
      totalRooms, occupiedRooms: occupied,
      occupancyRate: totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0,
      totalBookings: tBookings.length, activeBookings, totalRevenue, monthRevenue,
      totalGuests: tGuests.length,
      pendingHk: tHk.filter((h) => h.status === 'pending').length,
      activeFbOrders: tFb.filter((o) => ['pending', 'in_progress'].includes(o.status)).length,
      totalProperties: tProps.length, totalUnits: tUnits.length, occupiedUnits,
      activeLeases, monthlyRent, overdueRent, pageViewCount,
    }
  })

  const platform = {
    totalTenants:    tenants.length,
    totalRooms:      rooms.length,
    totalBookings:   bookings.length,
    totalGuests:     guests.length,
    totalRevenue:    bookings.reduce((s, b) => s + Number(b.total_amount ?? 0), 0),
    monthRevenue:    bookings.filter((b) => b.created_at >= thisMonthStart).reduce((s, b) => s + Number(b.total_amount ?? 0), 0),
    activeBookings:  bookings.filter((b) => ['confirmed', 'checked_in'].includes(b.status)).length,
    occupiedRooms:   rooms.filter((r) => r.status === 'occupied').length,
    totalProperties: properties.length,
    totalUnits:      units.length,
    occupiedUnits:   units.filter((u) => u.status === 'occupied').length,
    activeLeases:    leases.filter((l) => l.status === 'active').length,
    overdueRent:     rentRows.filter((r) => r.status === 'overdue').length,
    pmMonthRevenue:  rentRows.filter((r) => r.due_date >= thisMonthStart && r.status === 'paid').reduce((s, r) => s + Number(r.amount ?? 0), 0),
  }

  return res.json({ platform, tenants: tenantStats, analytics })
}
