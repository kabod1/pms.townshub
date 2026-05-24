import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  )
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).end()

  const slug = req.query.slug as string
  if (!slug) return res.status(400).json({ error: 'slug required' })

  const db = getServiceClient()

  const { data: tenant, error: tenantErr } = await db
    .from('tenants')
    .select('id, name, slug, currency, logo_url')
    .eq('slug', slug)
    .single()

  if (tenantErr || !tenant) return res.status(404).json({ error: 'Hotel not found' })

  const [catsRes, itemsRes] = await Promise.all([
    db.from('fb_menu_categories')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('sort_order'),
    db.from('fb_menu_items')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .eq('is_available', true)
      .order('sort_order'),
  ])

  return res.json({
    tenant,
    categories: catsRes.data ?? [],
    items: itemsRes.data ?? [],
  })
}
