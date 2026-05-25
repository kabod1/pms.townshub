import { createClient } from '@supabase/supabase-js'
import { testConnection } from '../../src/lib/integrations/siteminder'
import type { SiteMinderCredentials } from '../../src/lib/integrations/siteminder'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  )
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const db = getDb()
  const token = (req.headers.authorization ?? '').replace('Bearer ', '').trim()
  const { data: { user }, error: authErr } = await db.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { clientId, clientSecret, propertyId } = req.body ?? {}
  if (!clientId || !clientSecret || !propertyId) {
    return res.status(400).json({ error: 'clientId, clientSecret, and propertyId are required' })
  }

  const creds: SiteMinderCredentials = { clientId, clientSecret, propertyId }
  const result = await testConnection(creds)

  return res.status(result.ok ? 200 : 400).json(result)
}
