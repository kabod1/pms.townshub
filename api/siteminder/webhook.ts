/**
 * POST /api/siteminder/webhook
 * Receives inbound reservations from SiteMinder in real time.
 *
 * Configure this URL in your SiteMinder Connectivity Partner dashboard:
 *   https://your-domain.com/api/siteminder/webhook
 *
 * SiteMinder sends a POST with JSON body and header:
 *   X-SiteMinder-Signature: sha256=<hmac-hex>
 */
import { createClient } from '@supabase/supabase-js'
import { verifyWebhookSignature } from '../../src/lib/integrations/siteminder'
import type { SiteMinderReservation } from '../../src/lib/integrations/siteminder'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  )
}

const CHANNEL_SOURCE_MAP: Record<string, string> = {
  booking_com:  'booking_com',
  expedia:      'expedia',
  airbnb:       'airbnb',
  hotels_com:   'other',
  agoda:        'other',
  tripadvisor:  'other',
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const db = getDb()

  // The webhook URL must include ?tenant=<slug> so we know which property
  const tenantSlug = req.query?.tenant as string | undefined
  if (!tenantSlug) return res.status(400).json({ error: 'Missing ?tenant= query param' })

  // Load tenant + SiteMinder config
  const { data: tenant } = await db
    .from('tenants')
    .select('id')
    .eq('slug', tenantSlug)
    .single()
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' })

  const { data: config } = await db
    .from('channel_configs')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('channel', 'siteminder')
    .single()
  if (!config) return res.status(404).json({ error: 'SiteMinder not configured' })

  // Verify signature
  const rawBody = JSON.stringify(req.body)
  const signature = req.headers['x-siteminder-signature'] as string ?? ''
  if (config.webhook_secret) {
    const valid = await verifyWebhookSignature(rawBody, signature, config.webhook_secret)
    if (!valid) return res.status(401).json({ error: 'Invalid webhook signature' })
  }

  const reservations: SiteMinderReservation[] = Array.isArray(req.body?.reservations)
    ? req.body.reservations
    : req.body?.reservation
    ? [req.body.reservation]
    : []

  const results: string[] = []

  for (const r of reservations) {
    try {
      if (r.status === 'cancelled') {
        // Find booking by channel reservation ID and cancel it
        await db
          .from('bookings')
          .update({ status: 'cancelled' })
          .eq('tenant_id', tenant.id)
          .eq('booking_reference', `SM-${r.reservationId}`)
        results.push(`cancelled:${r.reservationId}`)
        continue
      }

      // Find or create guest
      let guestId: string | null = null
      if (r.guestEmail) {
        const { data: existingGuest } = await db
          .from('guests')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('email', r.guestEmail)
          .single()

        if (existingGuest) {
          guestId = existingGuest.id
        } else {
          const { data: newGuest } = await db
            .from('guests')
            .insert({
              tenant_id:  tenant.id,
              first_name: r.guestFirstName,
              last_name:  r.guestLastName,
              email:      r.guestEmail,
              phone:      r.guestPhone ?? null,
            })
            .select('id')
            .single()
          guestId = newGuest?.id ?? null
        }
      }

      // Find a matching room by room type code
      const { data: room } = await db
        .from('rooms')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('status', 'vacant_clean')
        .limit(1)
        .single()

      // Find room type by external code (stored in room_types.name or a future external_code column)
      const { data: roomType } = await db
        .from('room_types')
        .select('id, base_price')
        .eq('tenant_id', tenant.id)
        .limit(1)
        .single()

      const nights =
        (new Date(r.departure).getTime() - new Date(r.arrival).getTime()) / 86_400_000

      const source = CHANNEL_SOURCE_MAP[r.channel] ?? 'other'

      // Upsert booking (idempotent on reservationId)
      const { data: booking, error: bookingErr } = await db
        .from('bookings')
        .upsert(
          {
            tenant_id:         tenant.id,
            guest_id:          guestId,
            room_id:           room?.id ?? null,
            room_type_id:      roomType?.id ?? null,
            booking_reference: `SM-${r.reservationId}`,
            check_in_date:     r.arrival,
            check_out_date:    r.departure,
            adults:            r.adults,
            children:          r.children,
            status:            r.status === 'new' ? 'confirmed' : 'confirmed',
            source,
            room_rate:         roomType?.base_price ?? (r.totalAmount / Math.max(nights, 1)),
            total_amount:      r.totalAmount,
            special_requests:  r.specialRequests ?? null,
            channel_reservation_id: r.channelReservationId,
          },
          { onConflict: 'booking_reference' }
        )
        .select('id')
        .single()

      if (bookingErr) throw bookingErr
      results.push(`created:${booking?.id}`)
    } catch (err) {
      console.error(`[SiteMinder webhook] reservation ${r.reservationId}:`, err)
      results.push(`error:${r.reservationId}`)
    }
  }

  // Update last_sync_at
  await db
    .from('channel_configs')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', config.id)

  return res.status(200).json({ ok: true, processed: results.length, results })
}
