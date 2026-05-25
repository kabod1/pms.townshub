/**
 * Unified SiteMinder API handler — single serverless function, routed by ?action=
 *
 * POST /api/siteminder?action=test      — test credentials
 * POST /api/siteminder?action=push      — push ARI to SiteMinder
 * POST /api/siteminder?action=webhook&tenant=<slug> — receive inbound reservations
 */
import { createClient } from '@supabase/supabase-js'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import {
  getSiteMinderToken,
  testConnection,
  pushARI,
  verifyWebhookSignature,
} from '../src/lib/integrations/siteminder'
import type { SiteMinderCredentials, SiteMinderReservation } from '../src/lib/integrations/siteminder'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  )
}

async function getAuthedUser(req: any, db: ReturnType<typeof getDb>) {
  const token = (req.headers.authorization ?? '').replace('Bearer ', '').trim()
  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) return null
  return user
}

async function getTenantId(userId: string, db: ReturnType<typeof getDb>) {
  const { data } = await db.from('users').select('tenant_id').eq('id', userId).single()
  return data?.tenant_id ?? null
}

async function getChannelConfig(tenantId: string, db: ReturnType<typeof getDb>) {
  const { data } = await db
    .from('channel_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('channel', 'siteminder')
    .single()
  return data
}

// ─── action=test ─────────────────────────────────────────────────────────────

async function handleTest(req: any, res: any, db: ReturnType<typeof getDb>) {
  const user = await getAuthedUser(req, db)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { clientId, clientSecret, propertyId } = req.body ?? {}
  if (!clientId || !clientSecret || !propertyId) {
    return res.status(400).json({ error: 'clientId, clientSecret, propertyId required' })
  }

  const result = await testConnection({ clientId, clientSecret, propertyId })
  return res.status(result.ok ? 200 : 400).json(result)
}

// ─── action=push ─────────────────────────────────────────────────────────────

async function handlePush(req: any, res: any, db: ReturnType<typeof getDb>) {
  const user = await getAuthedUser(req, db)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const tenantId = await getTenantId(user.id, db)
  if (!tenantId) return res.status(403).json({ error: 'No tenant' })

  const config = await getChannelConfig(tenantId, db)
  if (!config) return res.status(404).json({ error: 'SiteMinder not configured' })

  const creds = config.credentials as SiteMinderCredentials

  const { from, to, roomTypeId, ratePlanId } = req.body ?? {}
  if (!from || !to || !roomTypeId || !ratePlanId) {
    return res.status(400).json({ error: 'from, to, roomTypeId, ratePlanId required' })
  }

  try {
    const [roomsRes, bookingsRes, ratesRes] = await Promise.all([
      db.from('rooms').select('id').eq('tenant_id', tenantId).eq('room_type_id', roomTypeId).eq('is_active', true),
      db.from('bookings').select('check_in_date,check_out_date').eq('tenant_id', tenantId)
        .in('status', ['confirmed', 'checked_in']).lte('check_in_date', to).gte('check_out_date', from),
      db.from('room_types').select('base_price').eq('id', roomTypeId).single(),
    ])

    const totalRooms = (roomsRes.data ?? []).length
    const bookings   = bookingsRes.data ?? []
    const basePrice  = ratesRes.data?.base_price ?? 0
    const days       = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) })

    const updates = days.map((day) => {
      const dayStr   = format(day, 'yyyy-MM-dd')
      const occupied = bookings.filter((b) => b.check_in_date <= dayStr && b.check_out_date > dayStr).length
      return { roomTypeId, ratePlanId, date: dayStr, available: Math.max(0, totalRooms - occupied), rate: basePrice }
    })

    await pushARI(creds, updates)
    await db.from('channel_configs').update({ last_sync_at: new Date().toISOString() }).eq('id', config.id)

    return res.status(200).json({ ok: true, daysUpdated: updates.length })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Push failed' })
  }
}

// ─── action=webhook ───────────────────────────────────────────────────────────

const CHANNEL_SOURCE_MAP: Record<string, string> = {
  booking_com: 'booking_com', expedia: 'expedia', airbnb: 'airbnb',
}

async function handleWebhook(req: any, res: any, db: ReturnType<typeof getDb>) {
  const tenantSlug = req.query?.tenant as string
  if (!tenantSlug) return res.status(400).json({ error: 'Missing ?tenant=' })

  const { data: tenant } = await db.from('tenants').select('id').eq('slug', tenantSlug).single()
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' })

  const config = await getChannelConfig(tenant.id, db)
  if (!config) return res.status(404).json({ error: 'SiteMinder not configured' })

  if (config.webhook_secret) {
    const sig   = (req.headers['x-siteminder-signature'] as string) ?? ''
    const valid = await verifyWebhookSignature(JSON.stringify(req.body), sig, config.webhook_secret)
    if (!valid) return res.status(401).json({ error: 'Invalid webhook signature' })
  }

  const reservations: SiteMinderReservation[] = Array.isArray(req.body?.reservations)
    ? req.body.reservations
    : req.body?.reservation ? [req.body.reservation] : []

  const results: string[] = []

  for (const r of reservations) {
    try {
      if (r.status === 'cancelled') {
        await db.from('bookings').update({ status: 'cancelled' })
          .eq('tenant_id', tenant.id).eq('booking_reference', `SM-${r.reservationId}`)
        results.push(`cancelled:${r.reservationId}`)
        continue
      }

      let guestId: string | null = null
      if (r.guestEmail) {
        const { data: eg } = await db.from('guests').select('id').eq('tenant_id', tenant.id).eq('email', r.guestEmail).single()
        if (eg) {
          guestId = eg.id
        } else {
          const { data: ng } = await db.from('guests').insert({
            tenant_id: tenant.id, first_name: r.guestFirstName, last_name: r.guestLastName,
            email: r.guestEmail, phone: r.guestPhone ?? null,
          }).select('id').single()
          guestId = ng?.id ?? null
        }
      }

      const { data: room }     = await db.from('rooms').select('id').eq('tenant_id', tenant.id).eq('status', 'vacant_clean').limit(1).single()
      const { data: roomType } = await db.from('room_types').select('id,base_price').eq('tenant_id', tenant.id).limit(1).single()
      const nights = (new Date(r.departure).getTime() - new Date(r.arrival).getTime()) / 86_400_000

      const { data: booking, error: bErr } = await db.from('bookings').upsert({
        tenant_id: tenant.id, guest_id: guestId,
        room_id: room?.id ?? null, room_type_id: roomType?.id ?? null,
        booking_reference: `SM-${r.reservationId}`,
        check_in_date: r.arrival, check_out_date: r.departure,
        adults: r.adults, children: r.children,
        status: 'confirmed',
        source: CHANNEL_SOURCE_MAP[r.channel] ?? 'other',
        room_rate: roomType?.base_price ?? r.totalAmount / Math.max(nights, 1),
        total_amount: r.totalAmount,
        special_requests: r.specialRequests ?? null,
      }, { onConflict: 'booking_reference' }).select('id').single()

      if (bErr) throw bErr
      results.push(`upserted:${booking?.id}`)
    } catch (err) {
      results.push(`error:${r.reservationId}`)
    }
  }

  await db.from('channel_configs').update({ last_sync_at: new Date().toISOString() }).eq('id', config.id)
  return res.status(200).json({ ok: true, processed: results.length, results })
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const db     = getDb()
  const action = req.query?.action as string

  if (action === 'test')    return handleTest(req, res, db)
  if (action === 'push')    return handlePush(req, res, db)
  if (action === 'webhook') return handleWebhook(req, res, db)

  return res.status(400).json({ error: 'Unknown action. Use ?action=test|push|webhook' })
}
