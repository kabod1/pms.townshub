/**
 * POST /api/siteminder/push
 * Push availability + rates to SiteMinder for a date range.
 * Called after bookings are confirmed, cancelled, or room rates change.
 */
import { createClient } from '@supabase/supabase-js'
import { pushARI } from '../../src/lib/integrations/siteminder'
import type { SiteMinderCredentials, ARIUpdate } from '../../src/lib/integrations/siteminder'
import { format, eachDayOfInterval, parseISO } from 'date-fns'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  )
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const db = getDb()

  // Auth
  const token = (req.headers.authorization ?? '').replace('Bearer ', '').trim()
  const { data: { user }, error: authErr } = await db.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  // Get tenant
  const { data: profile } = await db.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) return res.status(403).json({ error: 'No tenant' })

  // Load SiteMinder config from DB
  const { data: config } = await db
    .from('channel_configs')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .eq('channel', 'siteminder')
    .eq('is_active', true)
    .single()

  if (!config) return res.status(404).json({ error: 'SiteMinder not configured or inactive' })

  const creds = config.credentials as SiteMinderCredentials & { propertyId: string }

  const { from, to, roomTypeId, ratePlanId } = req.body ?? {}
  if (!from || !to || !roomTypeId || !ratePlanId) {
    return res.status(400).json({ error: 'from, to, roomTypeId, ratePlanId required' })
  }

  try {
    // Fetch rooms + bookings for the date range to compute per-day availability
    const [roomsRes, bookingsRes, ratesRes] = await Promise.all([
      db.from('rooms')
        .select('id, room_type_id')
        .eq('tenant_id', profile.tenant_id)
        .eq('room_type_id', roomTypeId)
        .eq('is_active', true),
      db.from('bookings')
        .select('check_in_date, check_out_date')
        .eq('tenant_id', profile.tenant_id)
        .in('status', ['confirmed', 'checked_in'])
        .lte('check_in_date', to)
        .gte('check_out_date', from),
      db.from('room_types')
        .select('base_price')
        .eq('id', roomTypeId)
        .single(),
    ])

    const totalRooms = (roomsRes.data ?? []).length
    const bookings = bookingsRes.data ?? []
    const basePrice = ratesRes.data?.base_price ?? 0

    const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) })

    const updates: ARIUpdate[] = days.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd')
      const occupied = bookings.filter(
        (b) => b.check_in_date <= dayStr && b.check_out_date > dayStr
      ).length
      return {
        roomTypeId,
        ratePlanId,
        date: dayStr,
        available: Math.max(0, totalRooms - occupied),
        rate: basePrice,
      }
    })

    await pushARI(creds, updates)

    // Update last_sync_at
    await db
      .from('channel_configs')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', config.id)

    return res.status(200).json({ ok: true, daysUpdated: updates.length })
  } catch (err) {
    console.error('[SiteMinder push]', err)
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Push failed' })
  }
}
