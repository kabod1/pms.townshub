/**
 * SiteMinder Connectivity Partner API client
 *
 * Docs: https://api-documentation.siteminder.com/
 * Auth: OAuth 2.0 client_credentials flow
 *
 * Required env vars (set in Vercel dashboard):
 *   SITEMINDER_AUTH_URL   (default: https://auth.sitemindergds.com/oauth/token)
 *   SITEMINDER_API_URL    (default: https://api.sitemindergds.com/v1)
 */

const AUTH_URL = process.env.SITEMINDER_AUTH_URL ?? 'https://auth.sitemindergds.com/oauth/token'
const API_URL  = process.env.SITEMINDER_API_URL  ?? 'https://api.sitemindergds.com/v1'

export interface SiteMinderCredentials {
  clientId: string
  clientSecret: string
  propertyId: string
  webhookSecret?: string
}

export interface ARIUpdate {
  roomTypeId: string   // your internal room type ID mapped to SiteMinder's room type code
  ratePlanId: string   // SiteMinder rate plan code
  date: string         // YYYY-MM-DD
  available: number    // 0 = closed, N = rooms available
  rate: number         // nightly rate in property currency
  minStay?: number     // minimum length of stay (nights)
  maxStay?: number
  closedToArrival?: boolean
  closedToDeparture?: boolean
}

export interface SiteMinderReservation {
  reservationId: string
  status: 'new' | 'modified' | 'cancelled'
  channel: string          // e.g. 'booking_com', 'expedia'
  channelReservationId: string
  arrival: string          // YYYY-MM-DD
  departure: string        // YYYY-MM-DD
  roomTypeCode: string
  ratePlanCode: string
  guestFirstName: string
  guestLastName: string
  guestEmail: string | null
  guestPhone: string | null
  adults: number
  children: number
  totalAmount: number
  currency: string
  bookedAt: string         // ISO timestamp
  specialRequests: string | null
}

// ─── OAuth token (cached per process) ────────────────────────────────────────

let _tokenCache: { token: string; expiresAt: number } | null = null

export async function getSiteMinderToken(creds: SiteMinderCredentials): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt - 30_000) {
    return _tokenCache.token
  }

  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     creds.clientId,
      client_secret: creds.clientSecret,
      scope:         'property:read property:write reservation:read reservation:write',
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`SiteMinder auth failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  _tokenCache = {
    token:     data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  }
  return _tokenCache.token
}

// ─── Test connection ──────────────────────────────────────────────────────────

export async function testConnection(creds: SiteMinderCredentials): Promise<{ ok: boolean; propertyName?: string; error?: string }> {
  try {
    const token = await getSiteMinderToken(creds)
    const res = await fetch(`${API_URL}/properties/${creds.propertyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return { ok: false, error: `Property not found (${res.status})` }
    const data = await res.json()
    return { ok: true, propertyName: data.name ?? data.propertyName }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' }
  }
}

// ─── Push ARI (Availability, Rates, Inventory) ───────────────────────────────

export async function pushARI(creds: SiteMinderCredentials, updates: ARIUpdate[]): Promise<void> {
  const token = await getSiteMinderToken(creds)

  const payload = {
    propertyId: creds.propertyId,
    ari: updates.map((u) => ({
      roomTypeCode:     u.roomTypeId,
      ratePlanCode:     u.ratePlanId,
      date:             u.date,
      availability:     u.available,
      rate:             { amount: u.rate, currencyCode: 'EUR' },
      minStay:          u.minStay ?? 1,
      maxStay:          u.maxStay ?? 30,
      closedToArrival:  u.closedToArrival ?? false,
      closedToDeparture: u.closedToDeparture ?? false,
    })),
  }

  const res = await fetch(`${API_URL}/properties/${creds.propertyId}/ari`, {
    method: 'PUT',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`SiteMinder ARI push failed (${res.status}): ${body}`)
  }
}

// ─── Pull new reservations ───────────────────────────────────────────────────

export async function pullReservations(creds: SiteMinderCredentials): Promise<SiteMinderReservation[]> {
  const token = await getSiteMinderToken(creds)

  const res = await fetch(
    `${API_URL}/properties/${creds.propertyId}/reservations?status=new&limit=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`SiteMinder reservation pull failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  return (data.reservations ?? []) as SiteMinderReservation[]
}

// ─── Acknowledge reservation (mark as received) ──────────────────────────────

export async function acknowledgeReservation(
  creds: SiteMinderCredentials,
  reservationId: string,
  pmsReservationId: string
): Promise<void> {
  const token = await getSiteMinderToken(creds)

  await fetch(
    `${API_URL}/properties/${creds.propertyId}/reservations/${reservationId}/acknowledge`,
    {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pmsReservationId }),
    }
  )
}

// ─── Webhook signature verification ──────────────────────────────────────────

export async function verifyWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string
): Promise<boolean> {
  try {
    // SiteMinder sends: X-SiteMinder-Signature: sha256=<hex>
    const [algo, receivedHex] = signatureHeader.split('=')
    if (algo !== 'sha256' || !receivedHex) return false

    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
    const computedHex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    return computedHex === receivedHex
  } catch {
    return false
  }
}
