/**
 * POST /api/staff  — invite a new staff member to the tenant
 * Requires service role key (admin API) to call supabase.auth.admin.inviteUserByEmail
 */
import { createClient } from '@supabase/supabase-js'

const SUPER_ADMIN_EMAILS = ['admin@townshub.cy']

function getDb() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  )
}

// Rate limiter
const _rl = new Map<string, { count: number; reset: number }>()
function rateLimit(key: string, max = 10, windowMs = 60_000) {
  const now = Date.now()
  let e = _rl.get(key)
  if (!e || now > e.reset) { e = { count: 0, reset: now + windowMs }; _rl.set(key, e) }
  e.count++
  return e.count <= max
}
function getIp(req: any) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? 'unknown'
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', 'https://pms.townshub.com')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  if (!rateLimit(`staff:${getIp(req)}`, 10, 60_000)) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  const token = (req.headers.authorization ?? '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const db = getDb()

  // Verify calling user's identity
  const { data: { user: caller }, error: authError } = await db.auth.getUser(token)
  if (authError || !caller) return res.status(401).json({ error: 'Unauthorized' })

  // Get caller's profile and tenant
  const { data: callerProfile } = await db
    .from('users')
    .select('tenant_id, role')
    .eq('id', caller.id)
    .single()

  if (!callerProfile) return res.status(403).json({ error: 'Profile not found' })

  // Only admins (or super admin) can invite staff
  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(caller.email ?? '')
  if (callerProfile.role !== 'admin' && !isSuperAdmin) {
    return res.status(403).json({ error: 'Only admins can invite staff' })
  }

  const { email, full_name, role } = req.body ?? {}

  if (!email || !full_name || !role) {
    return res.status(400).json({ error: 'email, full_name and role are required' })
  }
  if (!['admin', 'manager', 'front_desk', 'housekeeping'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' })
  }

  const redirectTo = `${process.env.VITE_APP_URL ?? 'https://pms.townshub.com'}/auth/reset-password`

  // Invite via Supabase admin API — sends the invite email automatically
  const { data: inviteData, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name, role, tenant_id: callerProfile.tenant_id },
  })

  if (inviteError) {
    // If user already exists in auth, surface a clean message
    const msg = inviteError.message.toLowerCase()
    if (msg.includes('already') || msg.includes('registered')) {
      return res.status(409).json({ error: 'A user with this email already exists.' })
    }
    return res.status(500).json({ error: inviteError.message })
  }

  if (!inviteData?.user?.id) {
    return res.status(500).json({ error: 'Invite created but could not retrieve user ID' })
  }

  // Pre-create the users table record using the ID Supabase assigned
  const { error: insertError } = await db.from('users').insert({
    id:        inviteData.user.id,
    tenant_id: callerProfile.tenant_id,
    email:     email.toLowerCase().trim(),
    full_name: full_name.trim(),
    role,
    is_active: true,
  })

  if (insertError) {
    // Don't fail the whole request — user can still accept invite and log in
    console.error('[staff invite] Failed to pre-create users row:', insertError.message)
  }

  return res.status(200).json({
    success: true,
    user_id: inviteData.user.id,
    message: `Invite sent to ${email}`,
  })
}
