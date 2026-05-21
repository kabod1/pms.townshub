import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  )
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { tenantSlug, messages, sessionId, guestName, roomNumber } = req.body
    const supabase = getSupabase()

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name, city, country')
      .eq('slug', tenantSlug)
      .single()

    if (!tenant) return res.status(404).json({ error: 'Hotel not found' })

    const [roomTypesRes, menuRes, conciergeRes] = await Promise.all([
      supabase
        .from('room_types')
        .select('name, description, base_price, max_occupancy, amenities')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true),
      supabase
        .from('fb_menu_items')
        .select('name, description, price')
        .eq('tenant_id', tenant.id)
        .eq('is_available', true),
      supabase
        .from('concierge_items')
        .select('name, description, price_from')
        .eq('tenant_id', tenant.id)
        .eq('is_available', true),
    ])

    const roomTypes = roomTypesRes.data ?? []
    const menuItems = menuRes.data ?? []
    const conciergeItems = conciergeRes.data ?? []

    const guestIntro = guestName
      ? `The guest's name is ${guestName}${roomNumber ? `, staying in room ${roomNumber}` : ''}.`
      : ''

    const systemPrompt = `You are a warm, professional AI concierge for ${tenant.name}${tenant.city ? `, located in ${tenant.city}, ${tenant.country}` : ''}.
${guestIntro}

ROOM TYPES:
${roomTypes.length ? roomTypes.map((r) => `• ${r.name}: ${r.description ?? ''} | €${r.base_price}/night | Sleeps ${r.max_occupancy} | Amenities: ${(r.amenities ?? []).join(', ')}`).join('\n') : 'Contact reception for room information.'}

DINING & DRINKS:
${menuItems.length ? menuItems.map((m) => `• ${m.name}: ${m.description ?? ''} | €${m.price}`).join('\n') : 'Contact reception for dining information.'}

LOCAL ATTRACTIONS & SERVICES:
${conciergeItems.length ? conciergeItems.map((c) => `• ${c.name}: ${c.description ?? ''}${c.price_from ? ` | From €${c.price_from}` : ''}`).join('\n') : 'Contact reception for local recommendations.'}

Be helpful, concise (2-3 sentences), and friendly. If you cannot handle a request, offer to connect the guest with the front desk. Always reply in the language the guest uses.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: systemPrompt,
      messages,
    })

    const assistantText =
      response.content[0].type === 'text' ? response.content[0].text : ''

    // Save session & messages in the background — don't block the response
    let activeSessionId = sessionId
    try {
      if (!activeSessionId) {
        const { data: session } = await supabase
          .from('guest_chat_sessions')
          .insert({
            tenant_id: tenant.id,
            guest_name: guestName ?? null,
            room_number: roomNumber ?? null,
          })
          .select('id')
          .single()
        activeSessionId = session?.id ?? null
      }

      if (activeSessionId) {
        const lastUserMsg = messages[messages.length - 1]
        await supabase.from('guest_chat_messages').insert([
          { session_id: activeSessionId, role: 'user', content: lastUserMsg.content },
          { session_id: activeSessionId, role: 'assistant', content: assistantText },
        ])
        await supabase
          .from('guest_chat_sessions')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', activeSessionId)
      }
    } catch (saveErr) {
      // Tables may not exist yet — chat still works, just not persisted
      console.warn('Session save skipped:', saveErr)
    }

    return res.json({ message: assistantText, sessionId: activeSessionId })
  } catch (err: any) {
    console.error('Chat error:', err)
    return res.status(500).json({ error: err.message ?? 'Internal server error' })
  }
}
