import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  )
}

async function ai(prompt: string, maxTokens = 1200): Promise<string> {
  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  })
  return (msg.content[0] as { text: string }).text
}

function parseJSON(raw: string) {
  return JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim())
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' })
  const token = authHeader.replace('Bearer ', '')

  const db = getServiceClient()
  const { data: { user }, error: authErr } = await db.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { type, tenantId, ...p } = req.body
  if (!type || !tenantId) return res.status(400).json({ error: 'type and tenantId required' })

  const { data: tenant } = await db
    .from('tenants')
    .select('name, city, country, currency')
    .eq('id', tenantId)
    .single()
  if (!tenant) return res.status(404).json({ error: 'Hotel not found' })

  const hotel = `${tenant.name} in ${tenant.city}, ${tenant.country}`

  try {
    /* ─────────── SOCIAL MEDIA STUDIO ─────────── */
    if (type === 'social') {
      const platformGuides: Record<string, string> = {
        instagram: 'Instagram (visual-first, 2200 char max, heavy emojis, 15-30 hashtags)',
        facebook: 'Facebook (conversational, longer-form ok, moderate 3-5 hashtags)',
        twitter: 'Twitter/X (punchy, max 280 chars, 2-3 hashtags, no fluff)',
        linkedin: 'LinkedIn (professional, business-travel slant, 3-5 hashtags)',
        whatsapp: 'WhatsApp broadcast (personal, friendly, short, emoji, zero hashtags)',
        email: 'Marketing email (subject line + body, clear CTA, scannable)',
        tripadvisor: 'TripAdvisor business post (credibility-first, value-forward)',
        google: 'Google Business post (local SEO, 300-1500 chars, include offer if any)',
        tiktok: 'TikTok caption (hook in first line, trending energy, CTA, hashtags)',
      }
      const toneGuides: Record<string, string> = {
        luxury: 'Luxury & Sophisticated — refined, exclusive, prestigious language',
        warm: 'Warm & Welcoming — homely, friendly, approachable',
        fun: 'Fun & Vibrant — energetic, playful, exciting',
        professional: 'Professional & Corporate — efficient, trustworthy, ROI-minded',
        romantic: 'Romantic & Intimate — dreamy, emotional, couples-focused',
        adventure: 'Adventure & Bold — inspiring, experiential, exploratory',
      }
      const contentGuides: Record<string, string> = {
        room_spotlight: 'Spotlight a specific room type or suite',
        promotional: 'General promotional post showcasing the hotel',
        fnb: 'Food & Beverage highlight — restaurant, bar, or in-room dining',
        seasonal: 'Seasonal/holiday campaign tied to current or upcoming occasion',
        event: 'Event announcement or upcoming on-site event promotion',
        weekend: 'Weekend getaway package for leisure travellers',
        romantic: 'Romantic package targeting couples',
        business: 'Business travel / MICE / corporate accommodation',
        hotel_story: 'Behind-the-scenes, hotel heritage, or staff story',
        offer: 'Flash sale or special discount promotion',
        review_highlight: 'Share a glowing guest review with commentary',
        amenity: 'Highlight a specific amenity (pool, spa, gym, etc.)',
      }
      const langMap: Record<string, string> = {
        fr: 'French', es: 'Spanish', ar: 'Arabic', sw: 'Swahili', pt: 'Portuguese', de: 'German',
      }
      const langNote = p.language && p.language !== 'en'
        ? `Write the entire response in ${langMap[p.language] || 'English'}.` : ''

      const prompt = `You are an award-winning hotel marketing copywriter. Create a ${p.platform} post for this hotel.

Hotel: ${hotel}
Platform: ${platformGuides[p.platform] || p.platform}
Content type: ${contentGuides[p.contentType] || p.contentType}
Tone: ${toneGuides[p.tone] || p.tone}
${p.additionalContext ? `Extra context from hotel: ${p.additionalContext}` : ''}
${langNote}

Return ONLY valid JSON — no markdown, no explanation:
{
  "caption": "Full post copy ready to paste",
  "hashtags": ["array","of","relevant","hashtags"],
  "imagePrompt": "Detailed Midjourney/DALL-E prompt to generate the perfect photo for this post",
  "bestTimeToPost": "Best day + time window e.g. Tuesday–Thursday, 7–9 PM",
  "cta": "Strong call-to-action recommendation",
  "proTip": "One platform-specific tip to maximise reach for this post"
}`
      return res.json(parseJSON(await ai(prompt, 1400)))
    }

    /* ─────────── GUEST CAMPAIGNS ─────────── */
    if (type === 'campaign') {
      const segmentDescs: Record<string, string> = {
        new: 'first-time guests who just completed their first ever stay',
        returning: 'loyal guests who have stayed 2–5 times',
        lapsed: 'guests who haven\'t returned in 90+ days and need a reason to come back',
        birthday: 'guests whose birthday is this month — make them feel special',
        anniversary: 'guests celebrating an anniversary of their first stay or a personal milestone',
        vip: 'VIP/loyalty members with 5+ stays — treat them like royalty',
        corporate: 'corporate account managers booking for their teams',
        post_stay: 'guests within 48 hours of checkout — while the experience is fresh',
      }
      const channelDescs: Record<string, string> = {
        email: 'email (include a compelling subject line)',
        whatsapp: 'WhatsApp message (brief, personal, max 300 chars, 1–2 emojis)',
        sms: 'SMS (max 160 characters, ultra-concise, one clear link placeholder)',
      }

      const prompt = `You are a hotel CRM and retention specialist. Write a ${channelDescs[p.channel]} campaign for ${hotel}.

Target segment: ${segmentDescs[p.segment] || p.segment}
${p.offer ? `Offer to feature: ${p.offer}` : 'No specific offer — focus on emotional connection and brand value'}
Use {{guest_name}} as the personalisation placeholder.

Return ONLY valid JSON:
{
  "variations": [
    { "label": "Emotional angle", "subject": "email subject if applicable", "message": "full message text" },
    { "label": "Offer/Value angle", "subject": "...", "message": "..." },
    { "label": "Urgency/FOMO angle", "subject": "...", "message": "..." }
  ],
  "sendingTip": "Best day/time and frequency tip for this segment",
  "segmentInsight": "Why this segment behaves this way and what motivates them"
}`
      return res.json(parseJSON(await ai(prompt, 1600)))
    }

    /* ─────────── REVIEW RESPONDER ─────────── */
    if (type === 'review') {
      const prompt = `You are the reputation manager for ${hotel}. Write a ${p.tone || 'warm and professional'} response to this ${p.rating}-star ${p.platform} review.

Review text:
"${p.reviewText}"

Rules:
- Thank the guest personally if a name is mentioned
- Address each specific point raised (both positive and negative)
${Number(p.rating) <= 2 ? '- Sincerely acknowledge issues, apologise, explain corrective action taken' : '- Reinforce the positives warmly'}
${Number(p.rating) <= 2 ? '- Invite them to contact management directly to resolve' : '- Warmly invite them to return'}
- Sound genuinely human, NOT corporate template
- 100–150 words maximum

Return ONLY valid JSON:
{
  "response": "The full review response",
  "characterCount": 0,
  "reputationTip": "One actionable tip to manage this type of review going forward",
  "sentiment": "positive|neutral|negative"
}`
      const parsed = parseJSON(await ai(prompt))
      parsed.characterCount = parsed.response?.length ?? 0
      return res.json(parsed)
    }

    /* ─────────── PRICING INTELLIGENCE ─────────── */
    if (type === 'pricing') {
      const today = new Date().toISOString().split('T')[0]
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
      const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

      const [roomsRes, upcoming30, upcoming7, ratesRes] = await Promise.all([
        db.from('rooms').select('id, status').eq('tenant_id', tenantId),
        db.from('bookings').select('id').eq('tenant_id', tenantId)
          .gte('check_in', today).lte('check_in', in30).in('status', ['confirmed', 'checked_in']),
        db.from('bookings').select('id').eq('tenant_id', tenantId)
          .gte('check_in', today).lte('check_in', in7).in('status', ['confirmed', 'checked_in']),
        db.from('room_types').select('name, base_rate').eq('tenant_id', tenantId),
      ])

      const totalRooms = roomsRes.data?.length ?? 0
      const occ30 = totalRooms > 0 ? Math.round(((upcoming30.data?.length ?? 0) / (totalRooms * 30)) * 100) : 0
      const occ7 = totalRooms > 0 ? Math.round(((upcoming7.data?.length ?? 0) / (totalRooms * 7)) * 100) : 0
      const rates = ratesRes.data ?? []

      const prompt = `You are a hotel revenue management expert advising ${hotel}.

Live data:
- Total rooms: ${totalRooms}
- 7-day occupancy projection: ${occ7}%
- 30-day occupancy projection: ${occ30}%
- Room types & base rates: ${JSON.stringify(rates)}
- Today: ${today}

Provide actionable revenue management guidance. Return ONLY valid JSON:
{
  "summary": "2-sentence occupancy & revenue health summary",
  "recommendations": [
    { "action": "Specific action to take", "reason": "Data-backed reason", "urgency": "high|medium|low", "estimatedImpact": "e.g. +8% RevPAR" },
    { "action": "...", "reason": "...", "urgency": "...", "estimatedImpact": "..." },
    { "action": "...", "reason": "...", "urgency": "...", "estimatedImpact": "..." }
  ],
  "pricingStrategy": "Recommended overall strategy for the next 30 days",
  "channelAdvice": "Which booking channels to prioritise right now"
}`
      const parsed = parseJSON(await ai(prompt))
      return res.json({ ...parsed, occ7, occ30, totalRooms, upcoming7: upcoming7.data?.length, upcoming30: upcoming30.data?.length })
    }

    /* ─────────── UPSELL ENGINE ─────────── */
    if (type === 'upsell') {
      const prompt = `You are a hotel upsell specialist for ${hotel}.

Guest profile:
- Name: ${p.guestName || 'Valued Guest'}
- Room type booked: ${p.roomType || 'Standard'}
- Total stays with us: ${p.totalStays ?? 1}
- Nights this visit: ${p.nights ?? 1}
- Check-in date: ${p.checkInDate || 'today'}
- Past F&B orders: ${p.recentOrders?.join(', ') || 'None on record'}
${p.specialOccasion ? `- Special occasion: ${p.specialOccasion}` : ''}

Generate personalised upsell content for 3 channels. Return ONLY valid JSON:
{
  "whatsappMessage": "Friendly WhatsApp message with 2–3 personalised offers, emojis, warm tone",
  "emailSubject": "Personalised email subject line",
  "emailBody": "Full email body with personalised offers",
  "frontDeskScript": "Natural-sounding verbatim script for front desk staff",
  "topOffers": [
    { "offer": "Offer name", "pitch": "One-line pitch", "personalisation": "Why specifically for this guest" },
    { "offer": "...", "pitch": "...", "personalisation": "..." },
    { "offer": "...", "pitch": "...", "personalisation": "..." }
  ],
  "bestTimingAdvice": "When is the optimal moment to deliver each upsell"
}`
      return res.json(parseJSON(await ai(prompt, 1600)))
    }

    return res.status(400).json({ error: 'Unknown type' })
  } catch (err: any) {
    console.error('[ai-marketing]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
