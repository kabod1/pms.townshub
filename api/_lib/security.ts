/**
 * Shared security utilities for all Vercel API routes.
 * Provides: rate limiting, input sanitization, CORS, token verification.
 */
import { createClient } from '@supabase/supabase-js'

// ── CORS ──────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://pms.townshub.com',
  'https://townshub.com',
  'http://localhost:5173',
  'http://localhost:4173',
]

export function setCorsHeaders(req: any, res: any) {
  const origin = req.headers.origin ?? ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  res.setHeader('Access-Control-Allow-Origin', allowed)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Secret')
  res.setHeader('Vary', 'Origin')
}

export function handlePreflight(req: any, res: any): boolean {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res)
    res.status(200).end()
    return true
  }
  return false
}

// ── Rate Limiting ─────────────────────────────────────────────────────────────
// In-memory per-serverless-instance. Caps burst abuse; add Redis for cross-instance limits.

interface RateEntry { count: number; reset: number }
const _store = new Map<string, RateEntry>()

export function rateLimit(
  key: string,
  maxRequests: number = 60,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  let entry = _store.get(key)

  if (!entry || now > entry.reset) {
    entry = { count: 0, reset: now + windowMs }
    _store.set(key, entry)
  }

  entry.count++
  const remaining = Math.max(0, maxRequests - entry.count)
  return { allowed: entry.count <= maxRequests, remaining }
}

export function getClientIp(req: any): string {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
    req.headers['x-real-ip'] ??
    req.socket?.remoteAddress ??
    'unknown'
  )
}

// ── Input Sanitization ────────────────────────────────────────────────────────

const DANGEROUS = /<script|javascript:|on\w+\s*=|<iframe|<object|<embed|<link|<meta/gi

export function sanitizeString(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(DANGEROUS, '').trim().slice(0, 10_000)
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') result[key] = sanitizeString(val)
    else if (typeof val === 'number' || typeof val === 'boolean' || val === null) result[key] = val
    else if (Array.isArray(val)) result[key] = val.map((v) => typeof v === 'string' ? sanitizeString(v) : v)
    else result[key] = val
  }
  return result as T
}

export function requireFields(obj: Record<string, unknown>, fields: string[]): string | null {
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null || obj[f] === '') {
      return `Missing required field: ${f}`
    }
  }
  return null
}

// ── Auth Verification ─────────────────────────────────────────────────────────

export function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  )
}

export async function verifyBearerToken(req: any, db: ReturnType<typeof getServiceClient>) {
  const token = (req.headers.authorization ?? '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) return null
  return user
}

export async function verifyTenantToken(req: any, db: ReturnType<typeof getServiceClient>) {
  const user = await verifyBearerToken(req, db)
  if (!user) return { user: null, tenantId: null }

  const { data: profile } = await db
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  return { user, tenantId: profile?.tenant_id ?? null }
}

// ── Security Response Headers ─────────────────────────────────────────────────

export function setSecurityHeaders(res: any) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
}
