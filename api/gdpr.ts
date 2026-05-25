/**
 * GDPR compliance API
 * POST /api/gdpr?action=export  — download all personal data for a guest
 * POST /api/gdpr?action=delete  — anonymise guest PII (Right to be Forgotten)
 * POST /api/gdpr?action=consent — update marketing consent for a guest
 */
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getClientIp, setCorsHeaders, handlePreflight, setSecurityHeaders } from './_lib/security'

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

async function getTenantId(userId: string, db: ReturnType<typeof getDb>) {
  const { data } = await db.from('users').select('tenant_id').eq('id', userId).single()
  return data?.tenant_id ?? null
}

// ── Export ────────────────────────────────────────────────────────────────────

async function handleExport(req: any, res: any, db: ReturnType<typeof getDb>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getAuthedUser(req, db)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const tenantId = await getTenantId(user.id, db)
  if (!tenantId) return res.status(403).json({ error: 'No tenant' })

  const { guestId } = req.body
  if (!guestId) return res.status(400).json({ error: 'guestId required' })

  const [guestRes, bookingsRes, invoicesRes] = await Promise.all([
    db.from('guests').select('*').eq('id', guestId).eq('tenant_id', tenantId).single(),
    db.from('bookings').select('id, booking_reference, check_in_date, check_out_date, status, room_rate, total_amount, source, adults, children, special_requests, created_at').eq('guest_id', guestId).eq('tenant_id', tenantId),
    db.from('invoices').select('id, invoice_number, issue_date, due_date, status, subtotal, tax_amount, total_amount, notes, created_at').eq('guest_id', guestId).eq('tenant_id', tenantId),
  ])

  if (!guestRes.data) return res.status(404).json({ error: 'Guest not found' })

  const exportData = {
    exported_at: new Date().toISOString(),
    data_controller: 'TownsHub LLC — admin@townshub.cy',
    gdpr_notice: 'This export contains all personal data held about you under GDPR Article 20 (Right to Data Portability).',
    guest_profile: guestRes.data,
    bookings: bookingsRes.data ?? [],
    invoices: invoicesRes.data ?? [],
  }

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="guest-data-${guestId}.json"`)
  return res.status(200).json(exportData)
}

// ── Delete (Right to be Forgotten) ───────────────────────────────────────────

async function handleDelete(req: any, res: any, db: ReturnType<typeof getDb>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getAuthedUser(req, db)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const tenantId = await getTenantId(user.id, db)
  if (!tenantId) return res.status(403).json({ error: 'No tenant' })

  const { data: profile } = await db.from('users').select('role').eq('id', user.id).single()
  if (!['admin', 'manager'].includes(profile?.role ?? '')) {
    return res.status(403).json({ error: 'Admin or Manager role required' })
  }

  const { guestId } = req.body
  if (!guestId) return res.status(400).json({ error: 'guestId required' })

  // Verify guest belongs to this tenant
  const { data: guest } = await db.from('guests').select('id').eq('id', guestId).eq('tenant_id', tenantId).single()
  if (!guest) return res.status(404).json({ error: 'Guest not found' })

  // Anonymise PII — keep record for FK integrity (bookings/invoices must remain for tax compliance)
  await db.from('guests').update({
    first_name: 'DELETED',
    last_name:  'USER',
    email:      null,
    phone:      null,
    nationality: null,
    id_type:    null,
    id_number:  null,
    date_of_birth: null,
    address:    null,
    city:       null,
    country:    null,
    postal_code: null,
    company_name: null,
    notes:      '[Data deleted per GDPR Article 17 request]',
    marketing_consent: false,
    marketing_consent_date: null,
    tags:       [],
  }).eq('id', guestId).eq('tenant_id', tenantId)

  // Hard-delete non-financial personal records
  await Promise.allSettled([
    db.from('push_subscriptions').delete().eq('user_id', guestId),
    db.from('guest_chat_sessions').delete().eq('tenant_id', tenantId),
  ])

  return res.status(200).json({ ok: true, message: 'Guest personal data anonymised and deleted' })
}

// ── Marketing consent ─────────────────────────────────────────────────────────

async function handleConsent(req: any, res: any, db: ReturnType<typeof getDb>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getAuthedUser(req, db)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const tenantId = await getTenantId(user.id, db)
  if (!tenantId) return res.status(403).json({ error: 'No tenant' })

  const { guestId, consent } = req.body
  if (!guestId || typeof consent !== 'boolean') {
    return res.status(400).json({ error: 'guestId and consent (boolean) required' })
  }

  const { error } = await db.from('guests').update({
    marketing_consent: consent,
    marketing_consent_date: consent ? new Date().toISOString() : null,
  }).eq('id', guestId).eq('tenant_id', tenantId)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}

// ── Router ────────────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res)
  setSecurityHeaders(res)
  if (handlePreflight(req, res)) return

  const ip = getClientIp(req)
  const { allowed } = rateLimit(`gdpr:${ip}`, 20, 60_000)
  if (!allowed) return res.status(429).json({ error: 'Too many requests' })

  const db     = getDb()
  const action = req.query?.action as string

  if (action === 'export')  return handleExport(req, res, db)
  if (action === 'delete')  return handleDelete(req, res, db)
  if (action === 'consent') return handleConsent(req, res, db)

  return res.status(400).json({ error: 'Unknown action. Use ?action=export|delete|consent' })
}
