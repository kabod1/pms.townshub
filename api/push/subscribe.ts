/**
 * POST /api/push/subscribe  — save a push subscription for the authenticated user
 * DELETE /api/push/subscribe — remove it (unsubscribe)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getClientIp, setCorsHeaders, handlePreflight, setSecurityHeaders } from '../_lib/security'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res)
  setSecurityHeaders(res)
  if (handlePreflight(req, res)) return

  const ip = getClientIp(req)
  const { allowed } = rateLimit(`push-sub:${ip}`, 20, 60_000)
  if (!allowed) return res.status(429).json({ error: 'Too many requests' })

  // Verify auth token
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' })

  // Look up tenant_id from users table
  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) return res.status(400).json({ error: 'User has no tenant' })

  if (req.method === 'POST') {
    const { endpoint, keys } = req.body
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Missing endpoint or keys' })
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        tenant_id: profile.tenant_id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: req.headers['user-agent'] ?? null,
      },
      { onConflict: 'user_id,endpoint' }
    )
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' })
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
