/**
 * POST /api/track — Record a page view with server-side geolocation.
 * Vercel automatically sets x-vercel-ip-country, x-vercel-ip-city, etc.
 * on every incoming request from real users.
 */
import { createClient } from '@supabase/supabase-js'

const ALLOWED_ORIGINS = [
  'https://pms.townshub.com',
  'https://www.pms.townshub.com',
  'http://localhost:5173',
  'http://localhost:4173',
]

function getDb() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  )
}

// Simple in-memory rate limiter (per Vercel instance)
const _rl = new Map<string, { count: number; reset: number }>()
function rateLimit(key: string, max = 60, windowMs = 60_000) {
  const now = Date.now()
  let e = _rl.get(key)
  if (!e || now > e.reset) { e = { count: 0, reset: now + windowMs }; _rl.set(key, e) }
  e.count++
  return e.count <= max
}

function getIp(req: any): string {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? 'unknown'
}

// Country code → flag emoji
function countryFlag(code: string): string {
  if (!code || code.length !== 2) return ''
  return code.toUpperCase().replace(/./g, (c) =>
    String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))
  )
}

export default async function handler(req: any, res: any) {
  const origin = req.headers.origin ?? ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const ip = getIp(req)
  if (!rateLimit(`track:${ip}`, 60, 60_000)) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  // ── Verify auth token (optional — allow unauthenticated for public pages) ──
  const token = (req.headers.authorization ?? '').replace('Bearer ', '').trim()
  let userId: string | null = null
  let tenantId: string | null = null

  if (token) {
    const db = getDb()
    const { data: { user } } = await db.auth.getUser(token)
    if (user) {
      userId = user.id
      const { data: profile } = await db
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single()
      tenantId = profile?.tenant_id ?? null
    }
  }

  const { path, referrer, browser, device_type, session_id } = req.body ?? {}

  if (!path) return res.status(400).json({ error: 'path is required' })

  // ── Read Vercel geolocation headers ──
  const country     = req.headers['x-vercel-ip-country']      ?? null
  const countryName = req.headers['x-vercel-ip-country-region']?? null
  const city        = req.headers['x-vercel-ip-city']          ? decodeURIComponent(req.headers['x-vercel-ip-city']) : null
  const latitude    = req.headers['x-vercel-ip-latitude']      ? parseFloat(req.headers['x-vercel-ip-latitude'])  : null
  const longitude   = req.headers['x-vercel-ip-longitude']     ? parseFloat(req.headers['x-vercel-ip-longitude']) : null
  const flag        = country ? countryFlag(country) : null

  const db = getDb()
  const { error } = await db.from('page_views').insert({
    tenant_id:    tenantId,
    user_id:      userId,
    path:         String(path).slice(0, 500),
    referrer:     referrer ? String(referrer).slice(0, 500) : null,
    browser:      browser  ? String(browser).slice(0, 100)  : null,
    device_type:  device_type ? String(device_type).slice(0, 50) : null,
    session_id:   session_id  ? String(session_id).slice(0, 100) : null,
    country,
    country_name: countryName,
    city,
    latitude,
    longitude,
    flag,
  })

  if (error) {
    console.error('[track] insert error:', error.message)
    return res.status(500).json({ error: 'Failed to record page view' })
  }

  return res.status(200).json({ ok: true })
}
