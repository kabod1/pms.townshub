import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a hotel property setup assistant. When given a description of a hotel property, output structured JSON with room type suggestions.

Output ONLY valid JSON (no markdown, no code blocks, no explanation) in this exact format:
{
  "roomTypes": [
    {
      "name": "Room type name",
      "description": "Brief, appealing description",
      "base_price": 150,
      "max_occupancy": 2,
      "max_children": 1,
      "bed_type": "double",
      "size_sqm": 25,
      "amenities": ["WiFi", "Air Conditioning", "TV"]
    }
  ]
}

Rules:
- Suggest 2–5 room types appropriate for the described property
- Choose amenities ONLY from: WiFi, Air Conditioning, TV, Minibar, Balcony, Sea View, Mountain View, Safe, Hair Dryer, Bathtub, Jacuzzi, Kitchen, Living Area, Private Pool
- bed_type must be one of: single, double, twin, king, queen, suite, other
- Pricing should be realistic for the location, star rating, and room type
- size_sqm can be null if unknown`

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { description } = req.body
    if (!description?.trim()) {
      return res.status(400).json({ error: 'description is required' })
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: description }],
    })

    const text =
      response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
    const suggestions = JSON.parse(text)
    return res.json(suggestions)
  } catch (err: any) {
    console.error('Onboarding AI error:', err)
    return res.status(500).json({ error: err.message ?? 'Failed to generate suggestions' })
  }
}
