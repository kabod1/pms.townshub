/**
 * /api/staff — Multi-action staff & operations API
 *
 * POST /api/staff                        — invite a new staff member (default, no ?action)
 * POST /api/staff?action=loyalty-enrol   — enrol a guest in the loyalty programme
 * POST /api/staff?action=loyalty-redeem  — redeem points for a guest
 * POST /api/staff?action=survey-triggers — list pending survey triggers
 * POST /api/staff?action=survey-mark-sent— mark a survey trigger as sent
 * POST /api/staff?action=concierge-request — create a concierge request (staff-side)
 * POST /api/staff?action=concierge-update  — update status/notes on a concierge request
 */
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getClientIp, setCorsHeaders, handlePreflight, setSecurityHeaders } from './_lib/security'

const SUPER_ADMIN_EMAILS = ['admin@townshub.cy']

function getDb() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  )
}

async function getAuthedUser(req: any, db: ReturnType<typeof getDb>) {
  const token = (req.headers.authorization ?? '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) return null
  return user
}

async function getCallerProfile(userId: string, db: ReturnType<typeof getDb>) {
  const { data } = await db.from('users').select('tenant_id, role').eq('id', userId).single()
  return data as { tenant_id: string; role: string } | null
}

// ── Staff invite (original behaviour) ─────────────────────────────────────────

async function handleInvite(req: any, res: any, db: ReturnType<typeof getDb>) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = await getAuthedUser(req, db)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const callerProfile = await getCallerProfile(user.id, db)
  if (!callerProfile) return res.status(403).json({ error: 'Profile not found' })

  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user.email ?? '')
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

  const { data: inviteData, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name, role, tenant_id: callerProfile.tenant_id },
  })

  if (inviteError) {
    const msg = inviteError.message.toLowerCase()
    if (msg.includes('already') || msg.includes('registered')) {
      return res.status(409).json({ error: 'A user with this email already exists.' })
    }
    return res.status(500).json({ error: inviteError.message })
  }

  if (!inviteData?.user?.id) {
    return res.status(500).json({ error: 'Invite created but could not retrieve user ID' })
  }

  const { error: insertError } = await db.from('users').insert({
    id:        inviteData.user.id,
    tenant_id: callerProfile.tenant_id,
    email:     email.toLowerCase().trim(),
    full_name: full_name.trim(),
    role,
    is_active: true,
  })

  if (insertError) {
    console.error('[staff invite] Failed to pre-create users row:', insertError.message)
  }

  return res.status(200).json({
    success: true,
    user_id: inviteData.user.id,
    message: `Invite sent to ${email}`,
  })
}

// ── Loyalty: enrol guest ───────────────────────────────────────────────────────
// POST /api/staff?action=loyalty-enrol
// Body: { guestId: string }

async function handleLoyaltyEnrol(req: any, res: any, db: ReturnType<typeof getDb>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getAuthedUser(req, db)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const profile = await getCallerProfile(user.id, db)
  if (!profile) return res.status(403).json({ error: 'No tenant' })

  const { guestId } = req.body ?? {}
  if (!guestId) return res.status(400).json({ error: 'guestId required' })

  // Verify guest belongs to this tenant
  const { data: guest } = await db
    .from('guests').select('id').eq('id', guestId).eq('tenant_id', profile.tenant_id).single()
  if (!guest) return res.status(404).json({ error: 'Guest not found' })

  // Upsert loyalty account
  const { data: existing } = await db
    .from('loyalty_accounts')
    .select('id, points_balance, lifetime_points, tier')
    .eq('tenant_id', profile.tenant_id)
    .eq('guest_id', guestId)
    .maybeSingle()

  if (existing) {
    return res.status(200).json({ alreadyEnrolled: true, account: existing })
  }

  const { data: account, error } = await db
    .from('loyalty_accounts')
    .insert({ tenant_id: profile.tenant_id, guest_id: guestId, points_balance: 0, lifetime_points: 0, tier: 'bronze' })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ success: true, account })
}

// ── Loyalty: redeem points ─────────────────────────────────────────────────────
// POST /api/staff?action=loyalty-redeem
// Body: { accountId: string, points: number, bookingId?: string, description?: string }

async function handleLoyaltyRedeem(req: any, res: any, db: ReturnType<typeof getDb>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getAuthedUser(req, db)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const profile = await getCallerProfile(user.id, db)
  if (!profile) return res.status(403).json({ error: 'No tenant' })

  const { accountId, points, bookingId, description } = req.body ?? {}
  if (!accountId || !points || points < 1) {
    return res.status(400).json({ error: 'accountId and points (>0) required' })
  }

  const { data: account } = await db
    .from('loyalty_accounts')
    .select('id, points_balance, lifetime_points, tier')
    .eq('id', accountId)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!account) return res.status(404).json({ error: 'Account not found' })

  if (account.points_balance < points) {
    return res.status(400).json({ error: `Insufficient balance: ${account.points_balance} pts available` })
  }

  const newBalance = account.points_balance - points
  const desc = description || `Redeemed ${points} pts (€${(points / 100).toFixed(2)} discount)`

  // Insert transaction
  await db.from('loyalty_transactions').insert({
    account_id:  accountId,
    tenant_id:   profile.tenant_id,
    booking_id:  bookingId ?? null,
    type:        'redeem',
    points:      -points,
    description: desc,
  })

  // Update balance
  const { error: updateError } = await db
    .from('loyalty_accounts')
    .update({ points_balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', accountId)

  if (updateError) return res.status(500).json({ error: updateError.message })

  return res.status(200).json({
    success:     true,
    new_balance: newBalance,
    redeemed:    points,
    discount_eur: (points / 100).toFixed(2),
  })
}

// ── Surveys: list pending triggers ────────────────────────────────────────────
// POST /api/staff?action=survey-triggers
// Body: { status?: 'pending'|'sent'|'completed' }

async function handleSurveyTriggers(req: any, res: any, db: ReturnType<typeof getDb>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getAuthedUser(req, db)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const profile = await getCallerProfile(user.id, db)
  if (!profile) return res.status(403).json({ error: 'No tenant' })

  const { status = 'pending' } = req.body ?? {}

  const { data, error } = await db
    .from('survey_triggers')
    .select('*, booking:bookings(booking_reference, check_in_date, check_out_date), guest:guests(first_name, last_name, email)')
    .eq('tenant_id', profile.tenant_id)
    .eq('status', status)
    .order('scheduled_at', { ascending: true })
    .limit(100)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ data })
}

// ── Surveys: mark trigger as sent ────────────────────────────────────────────
// POST /api/staff?action=survey-mark-sent
// Body: { triggerId: string }

async function handleSurveyMarkSent(req: any, res: any, db: ReturnType<typeof getDb>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getAuthedUser(req, db)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const profile = await getCallerProfile(user.id, db)
  if (!profile) return res.status(403).json({ error: 'No tenant' })

  const { triggerId } = req.body ?? {}
  if (!triggerId) return res.status(400).json({ error: 'triggerId required' })

  const { error } = await db
    .from('survey_triggers')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', triggerId)
    .eq('tenant_id', profile.tenant_id)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ success: true })
}

// ── Concierge: create request (staff-side) ────────────────────────────────────
// POST /api/staff?action=concierge-request
// Body: { bookingId?, guestId?, title, details?, requestType?, preferredDate?,
//         preferredTime?, guestsCount?, serviceId? }

async function handleConciergeRequest(req: any, res: any, db: ReturnType<typeof getDb>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getAuthedUser(req, db)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const profile = await getCallerProfile(user.id, db)
  if (!profile) return res.status(403).json({ error: 'No tenant' })

  const {
    bookingId, guestId, title, details, requestType = 'general',
    preferredDate, preferredTime, guestsCount = 1, serviceId, priceQuoted,
  } = req.body ?? {}

  if (!title) return res.status(400).json({ error: 'title required' })

  const validTypes = ['general', 'tour', 'transfer', 'spa', 'restaurant', 'transport', 'other']
  if (!validTypes.includes(requestType)) {
    return res.status(400).json({ error: 'Invalid request_type' })
  }

  const { data, error } = await db
    .from('concierge_requests')
    .insert({
      tenant_id:      profile.tenant_id,
      booking_id:     bookingId ?? null,
      guest_id:       guestId ?? null,
      service_id:     serviceId ?? null,
      request_type:   requestType,
      title,
      details:        details ?? null,
      preferred_date: preferredDate ?? null,
      preferred_time: preferredTime ?? null,
      guests_count:   guestsCount,
      price_quoted:   priceQuoted ?? null,
      status:         'pending',
      assigned_to:    user.id,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ success: true, request: data })
}

// ── Concierge: update request status ─────────────────────────────────────────
// POST /api/staff?action=concierge-update
// Body: { requestId, status, staffNotes?, priceQuoted?, assignedTo? }

async function handleConciergeUpdate(req: any, res: any, db: ReturnType<typeof getDb>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getAuthedUser(req, db)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const profile = await getCallerProfile(user.id, db)
  if (!profile) return res.status(403).json({ error: 'No tenant' })

  const { requestId, status, staffNotes, priceQuoted, assignedTo } = req.body ?? {}
  if (!requestId) return res.status(400).json({ error: 'requestId required' })

  const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status)      updates.status       = status
  if (staffNotes !== undefined) updates.staff_notes  = staffNotes
  if (priceQuoted !== undefined) updates.price_quoted = priceQuoted
  if (assignedTo !== undefined) updates.assigned_to  = assignedTo

  const { error } = await db
    .from('concierge_requests')
    .update(updates)
    .eq('id', requestId)
    .eq('tenant_id', profile.tenant_id)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ success: true })
}

// ── Main router ────────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res)
  setSecurityHeaders(res)
  if (handlePreflight(req, res)) return

  if (req.method !== 'POST') return res.status(405).end()

  const ip = getClientIp(req)
  if (!rateLimit(`staff:${ip}`, 20, 60_000).allowed) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  const db     = getDb()
  const action = req.query?.action as string | undefined

  if (!action)                       return handleInvite(req, res, db)
  if (action === 'loyalty-enrol')    return handleLoyaltyEnrol(req, res, db)
  if (action === 'loyalty-redeem')   return handleLoyaltyRedeem(req, res, db)
  if (action === 'survey-triggers')  return handleSurveyTriggers(req, res, db)
  if (action === 'survey-mark-sent') return handleSurveyMarkSent(req, res, db)
  if (action === 'concierge-request') return handleConciergeRequest(req, res, db)
  if (action === 'concierge-update')  return handleConciergeUpdate(req, res, db)

  return res.status(400).json({ error: `Unknown action: ${action}` })
}
