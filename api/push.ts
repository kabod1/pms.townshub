/**
 * Unified push notification handler — routed by ?action=
 *
 * POST   /api/push?action=subscribe   — save push subscription
 * DELETE /api/push?action=subscribe   — remove push subscription
 * POST   /api/push?action=send        — send push notification
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { rateLimit, getClientIp, setCorsHeaders, handlePreflight, setSecurityHeaders } from './_lib/security'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

webpush.setVapidDetails(
  process.env.VAPID_CONTACT_EMAIL ?? 'mailto:admin@townshub.cy',
  process.env.VITE_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

// ─── Subscribe / Unsubscribe ──────────────────────────────────────────────────

async function handleSubscribe(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res)
  setSecurityHeaders(res)
  if (handlePreflight(req, res)) return

  const ip = getClientIp(req)
  const { allowed } = rateLimit(`push-sub:${ip}`, 20, 60_000)
  if (!allowed) return res.status(429).json({ error: 'Too many requests' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' })

  const { data: profile } = await supabase
    .from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile?.tenant_id) return res.status(400).json({ error: 'User has no tenant' })

  if (req.method === 'POST') {
    const { endpoint, keys } = req.body
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Missing endpoint or keys' })
    }
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id, tenant_id: profile.tenant_id, endpoint,
        p256dh: keys.p256dh, auth: keys.auth,
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
    await supabase.from('push_subscriptions').delete()
      .eq('user_id', user.id).eq('endpoint', endpoint)
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ─── Send notification ────────────────────────────────────────────────────────

async function handleSend(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const secret = req.headers['x-api-secret']
  const token  = req.headers.authorization?.replace('Bearer ', '')

  if (secret !== process.env.INTERNAL_API_SECRET) {
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const { error } = await supabase.auth.getUser(token)
    if (error) return res.status(401).json({ error: 'Invalid token' })
  }

  const { userIds, tenantId, payload } = req.body as {
    userIds?: string[]
    tenantId?: string
    payload: { title: string; body: string; icon?: string; data?: Record<string, unknown> }
  }
  if (!payload?.title || !payload?.body) {
    return res.status(400).json({ error: 'payload.title and payload.body are required' })
  }

  let query = supabase.from('push_subscriptions').select('endpoint, p256dh, auth, user_id')
  if (userIds && userIds.length > 0) {
    query = query.in('user_id', userIds)
  } else if (tenantId) {
    query = query.eq('tenant_id', tenantId)
  } else {
    return res.status(400).json({ error: 'Provide userIds or tenantId' })
  }

  const { data: subs, error: subErr } = await query
  if (subErr) return res.status(500).json({ error: subErr.message })
  if (!subs || subs.length === 0) return res.status(200).json({ ok: true, sent: 0 })

  const notification = JSON.stringify({
    title: payload.title, body: payload.body,
    icon:  payload.icon ?? '/logo192.png',
    badge: '/badge72.png', data: payload.data ?? {},
  })

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        notification
      ).catch(async (err) => {
        if (err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
        throw err
      })
    )
  )

  const sent   = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length
  return res.status(200).json({ ok: true, sent, failed, total: subs.length })
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query?.action as string

  if (action === 'subscribe') return handleSubscribe(req, res)
  if (action === 'send')      return handleSend(req, res)

  return res.status(400).json({ error: 'Unknown action. Use ?action=subscribe|send' })
}
