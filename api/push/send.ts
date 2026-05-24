/**
 * POST /api/push/send — send a push notification to one or more users
 *
 * Body:
 *   userIds: string[]    — target user IDs (empty = broadcast to whole tenant)
 *   tenantId?: string    — required when broadcasting (userIds is empty)
 *   payload: {
 *     title: string
 *     body: string
 *     icon?: string
 *     data?: Record<string, unknown>
 *   }
 *
 * Auth: service-role or internal API secret
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

webpush.setVapidDetails(
  process.env.VAPID_CONTACT_EMAIL ?? 'mailto:admin@townshub.cy',
  process.env.VITE_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Verify via internal secret OR service-role token
  const secret = req.headers['x-api-secret']
  const token  = req.headers.authorization?.replace('Bearer ', '')

  if (secret !== process.env.INTERNAL_API_SECRET) {
    // Fall back to auth token check
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

  // Fetch target subscriptions
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
    title: payload.title,
    body:  payload.body,
    icon:  payload.icon ?? '/logo192.png',
    badge: '/badge72.png',
    data:  payload.data ?? {},
  })

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        notification
      ).catch(async (err) => {
        // 410 Gone = subscription expired, clean it up
        if (err.statusCode === 410) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint)
        }
        throw err
      })
    )
  )

  const sent   = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length
  return res.status(200).json({ ok: true, sent, failed, total: subs.length })
}
