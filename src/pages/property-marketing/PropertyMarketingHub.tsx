import { useState } from 'react'
import {
  Sparkles, Copy, Check, Instagram, Facebook, Linkedin,
  MessageSquare, Mail, Star, TrendingUp, Users, ChevronDown,
  Globe, Megaphone, Home, DollarSign, RotateCcw, Lightbulb,
} from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Tab = 'social' | 'listings' | 'pricing' | 'reviews' | 'retention'

const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
  { id: 'social',     label: 'Social Studio',        icon: <Instagram size={16} />,   badge: 'AI' },
  { id: 'listings',   label: 'Listing Copy',          icon: <Home size={16} /> },
  { id: 'pricing',    label: 'Pricing Intelligence',  icon: <TrendingUp size={16} /> },
  { id: 'reviews',    label: 'Review Responder',      icon: <Star size={16} /> },
  { id: 'retention',  label: 'Tenant Retention',      icon: <Users size={16} /> },
]

async function callAI(type: string, tenantId: string, params: object) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const res = await fetch('/api/ai-marketing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ type, tenantId, ...params }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'AI request failed')
  return json
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); toast.success('Copied!'); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function ResultCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-[#0B1F4B]/5 to-amber-50 border border-amber-100 p-4 space-y-3">
      {children}
    </div>
  )
}

function FieldSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 appearance-none focus:outline-none focus:ring-2 focus:ring-amber-400">
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    </div>
  )
}

function FieldTextarea({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400" />
    </div>
  )
}

// ─── Social Studio ────────────────────────────────────────────────────────────

const SOCIAL_PLATFORMS = [
  { value: 'instagram',  label: '📸 Instagram' },
  { value: 'facebook',   label: '👥 Facebook' },
  { value: 'linkedin',   label: '💼 LinkedIn' },
  { value: 'whatsapp',   label: '💬 WhatsApp Broadcast' },
  { value: 'email',      label: '📧 Email Newsletter' },
  { value: 'twitter',    label: '🐦 Twitter / X' },
  { value: 'google',     label: '🔍 Google Business' },
]

const PROPERTY_CONTENT_TYPES = [
  { value: 'new_listing',       label: 'New Property Listing' },
  { value: 'unit_available',    label: 'Unit Now Available' },
  { value: 'property_spotlight','label': 'Property Spotlight' },
  { value: 'amenity_highlight', label: 'Amenity Highlight' },
  { value: 'market_update',     label: 'Market Update / Rental Trends' },
  { value: 'tenant_testimonial','label': 'Tenant Testimonial' },
  { value: 'open_day',          label: 'Open Day / Viewing Event' },
  { value: 'seasonal',          label: 'Seasonal Campaign' },
  { value: 'commercial_offer',  label: 'Commercial Space Offer' },
  { value: 'company_update',    label: 'Agency / Company Update' },
]

const TONES = [
  { value: 'professional',  label: '💼 Professional & Corporate' },
  { value: 'luxury',        label: '✨ Premium & Sophisticated' },
  { value: 'warm',          label: '🤗 Friendly & Approachable' },
  { value: 'bold',          label: '🔥 Bold & Attention-Grabbing' },
  { value: 'minimal',       label: '🤍 Clean & Minimalist' },
]

const LANGUAGES = [
  { value: 'en', label: '🇬🇧 English' },
  { value: 'el', label: '🇬🇷 Greek' },
  { value: 'ru', label: '🇷🇺 Russian' },
  { value: 'ar', label: '🇸🇦 Arabic' },
  { value: 'fr', label: '🇫🇷 French' },
  { value: 'de', label: '🇩🇪 German' },
  { value: 'zh', label: '🇨🇳 Chinese' },
]

function SocialStudio({ tenantId }: { tenantId: string }) {
  const [platform, setPlatform] = useState('instagram')
  const [contentType, setContentType] = useState('new_listing')
  const [tone, setTone] = useState('professional')
  const [language, setLanguage] = useState('en')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function generate() {
    setLoading(true)
    try {
      const data = await callAI('social', tenantId, { platform, contentType, tone, language, additionalContext: context })
      setResult(data)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const platformIcon: Record<string, React.ReactNode> = {
    instagram: <Instagram size={16} className="text-pink-500" />,
    facebook: <Facebook size={16} className="text-blue-600" />,
    linkedin: <Linkedin size={16} className="text-blue-700" />,
    whatsapp: <MessageSquare size={16} className="text-green-500" />,
    email: <Mail size={16} className="text-amber-600" />,
    twitter: <span className="text-sm font-bold">𝕏</span>,
    google: <Globe size={16} className="text-red-500" />,
  }

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <p className="font-semibold text-gray-800 text-sm">Content Settings</p>
          </div>
          <FieldSelect label="Platform" value={platform} onChange={setPlatform} options={SOCIAL_PLATFORMS} />
          <FieldSelect label="Content Type" value={contentType} onChange={setContentType} options={PROPERTY_CONTENT_TYPES} />
          <FieldSelect label="Brand Tone" value={tone} onChange={setTone} options={TONES} />
          <FieldSelect label="Language" value={language} onChange={setLanguage} options={LANGUAGES} />
          <FieldTextarea label="Property Details / Context" value={context} onChange={setContext}
            placeholder="e.g. '2-bed apartment in Limassol, sea view, €850/mo, available June 1st'" rows={3} />
          <button onClick={generate} disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0B1F4B] to-amber-600 text-white py-2.5 text-sm font-semibold disabled:opacity-60 transition-opacity">
            {loading ? <RotateCcw size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? 'Generating…' : 'Generate Content'}
          </button>
        </div>
      </div>

      <div className="lg:col-span-3">
        {!result ? (
          <div className="h-full min-h-[380px] rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-8 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
              <Sparkles size={28} className="text-purple-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-700">Property Social Studio</p>
              <p className="text-sm text-gray-400 mt-1">Generate AI-optimised listing posts, property spotlights, and market updates for any platform.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {result.caption && (
              <ResultCard>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">{platformIcon[platform]}<p className="text-sm font-semibold text-gray-800">Caption</p></div>
                  <CopyButton text={result.caption} />
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{result.caption}</p>
              </ResultCard>
            )}
            {result.hashtags?.length > 0 && (
              <ResultCard>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-800"># Hashtags</p>
                  <CopyButton text={result.hashtags.join(' ')} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.hashtags.map((h: string) => (
                    <span key={h} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-1">{h}</span>
                  ))}
                </div>
              </ResultCard>
            )}
            {result.subject && (
              <ResultCard>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800">Email Subject</p>
                  <CopyButton text={result.subject} />
                </div>
                <p className="text-sm text-gray-700">{result.subject}</p>
              </ResultCard>
            )}
            {result.story_ideas?.length > 0 && (
              <ResultCard>
                <p className="text-sm font-semibold text-gray-800 mb-2">Story / Reel Ideas</p>
                <ul className="space-y-1">
                  {result.story_ideas.map((idea: string, i: number) => (
                    <li key={i} className="text-sm text-gray-600 flex gap-2"><span className="text-amber-500 shrink-0">→</span>{idea}</li>
                  ))}
                </ul>
              </ResultCard>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Listing Copy ──────────────────────────────────────────────────────────────

const UNIT_TYPES = [
  { value: 'apartment',   label: 'Apartment' },
  { value: 'studio',      label: 'Studio' },
  { value: 'villa',       label: 'Villa' },
  { value: 'penthouse',   label: 'Penthouse' },
  { value: 'office',      label: 'Office' },
  { value: 'retail',      label: 'Retail Space' },
  { value: 'warehouse',   label: 'Warehouse' },
  { value: 'maisonette',  label: 'Maisonette' },
]

const LISTING_PLATFORMS = [
  { value: 'airbnb',          label: 'Airbnb' },
  { value: 'booking_com',     label: 'Booking.com' },
  { value: 'rightmove',       label: 'Rightmove' },
  { value: 'zoopla',          label: 'Zoopla' },
  { value: 'bazaraki',        label: 'Bazaraki.com' },
  { value: 'generic',         label: 'Generic / Website' },
]

function ListingCopy({ tenantId }: { tenantId: string }) {
  const [unitType, setUnitType] = useState('apartment')
  const [listingPlatform, setListingPlatform] = useState('generic')
  const [tone, setTone] = useState('professional')
  const [language, setLanguage] = useState('en')
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function generate() {
    setLoading(true)
    try {
      const data = await callAI('social', tenantId, {
        platform: listingPlatform,
        contentType: 'new_listing',
        tone,
        language,
        additionalContext: `Unit type: ${unitType}. ${details}`,
      })
      setResult(data)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center">
              <Home size={14} className="text-white" />
            </div>
            <p className="font-semibold text-gray-800 text-sm">Listing Settings</p>
          </div>
          <FieldSelect label="Unit Type" value={unitType} onChange={setUnitType} options={UNIT_TYPES} />
          <FieldSelect label="Target Platform" value={listingPlatform} onChange={setListingPlatform} options={LISTING_PLATFORMS} />
          <FieldSelect label="Tone" value={tone} onChange={setTone} options={TONES} />
          <FieldSelect label="Language" value={language} onChange={setLanguage} options={LANGUAGES} />
          <FieldTextarea label="Property Details" value={details} onChange={setDetails} rows={5}
            placeholder={'e.g.\n3-bed apartment, floor 2\n110m², sea view, 2 bathrooms\n€1,200/mo, Limassol, furnished\nAmenities: gym, parking, rooftop'} />
          <button onClick={generate} disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-teal-600 text-white py-2.5 text-sm font-semibold disabled:opacity-60">
            {loading ? <RotateCcw size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? 'Generating…' : 'Generate Listing Copy'}
          </button>
        </div>
      </div>

      <div className="lg:col-span-3">
        {!result ? (
          <div className="h-full min-h-[380px] rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-8 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-100 to-teal-100 flex items-center justify-center">
              <Home size={28} className="text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-700">AI Listing Copy Generator</p>
              <p className="text-sm text-gray-400 mt-1">Generate compelling, platform-optimised listing descriptions for Airbnb, Booking.com, Bazaraki, and more.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {result.caption && (
              <ResultCard>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-800">Listing Description</p>
                  <CopyButton text={result.caption} />
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{result.caption}</p>
              </ResultCard>
            )}
            {result.hashtags?.length > 0 && (
              <ResultCard>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-800">SEO Keywords / Tags</p>
                  <CopyButton text={result.hashtags.join(', ')} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.hashtags.map((h: string) => (
                    <span key={h} className="text-xs bg-green-50 text-green-700 rounded-full px-2.5 py-1">{h}</span>
                  ))}
                </div>
              </ResultCard>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Pricing Intelligence ─────────────────────────────────────────────────────

function PricingIntelligence({ tenantId }: { tenantId: string }) {
  const [unitType, setUnitType] = useState('apartment')
  const [city, setCity] = useState('Limassol')
  const [area, setArea] = useState('')
  const [currentRent, setCurrentRent] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function generate() {
    setLoading(true)
    try {
      const data = await callAI('pricing', tenantId, {
        unitType, city, area,
        additionalContext: `Unit type: ${unitType}, Location: ${city}${area ? ', ' + area : ''}. ${currentRent ? `Current rent: €${currentRent}/mo.` : ''}`,
      })
      setResult(data)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <TrendingUp size={14} className="text-white" />
            </div>
            <p className="font-semibold text-gray-800 text-sm">Property Details</p>
          </div>
          <FieldSelect label="Unit Type" value={unitType} onChange={setUnitType} options={UNIT_TYPES} />
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Limassol"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Area / District</label>
            <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Marina, Germasogeia"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Current Rent (€/mo)</label>
            <div className="relative">
              <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="number" value={currentRent} onChange={(e) => setCurrentRent(e.target.value)} placeholder="850"
                className="w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
          <button onClick={generate} disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2.5 text-sm font-semibold disabled:opacity-60">
            {loading ? <RotateCcw size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? 'Analysing…' : 'Get Pricing Insights'}
          </button>
        </div>
      </div>

      <div className="lg:col-span-3">
        {!result ? (
          <div className="h-full min-h-[380px] rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-8 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
              <TrendingUp size={28} className="text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-700">AI Rental Pricing Intelligence</p>
              <p className="text-sm text-gray-400 mt-1">Get data-driven rent pricing guidance, market positioning insights, and yield optimisation tips.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Limassol', 'Nicosia', 'Paphos', 'Larnaca'].map((c) => (
                <button key={c} onClick={() => setCity(c)}
                  className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-3 py-1 hover:bg-amber-100">{c}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {result.analysis && (
              <ResultCard>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-800">Market Analysis</p>
                  <CopyButton text={result.analysis} />
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{result.analysis}</p>
              </ResultCard>
            )}
            {result.caption && !result.analysis && (
              <ResultCard>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-800">Pricing Insights</p>
                  <CopyButton text={result.caption} />
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{result.caption}</p>
              </ResultCard>
            )}
            {result.recommendations?.length > 0 && (
              <ResultCard>
                <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5"><Lightbulb size={14} className="text-amber-500" /> Recommendations</p>
                <ul className="space-y-2">
                  {result.recommendations.map((r: string, i: number) => (
                    <li key={i} className="text-sm text-gray-600 flex gap-2"><span className="text-amber-500 shrink-0 font-bold">{i + 1}.</span>{r}</li>
                  ))}
                </ul>
              </ResultCard>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Review Responder ─────────────────────────────────────────────────────────

const REVIEW_SENTIMENTS = [
  { value: 'positive',  label: '⭐ Positive Review' },
  { value: 'neutral',   label: '😐 Neutral / Mixed Review' },
  { value: 'negative',  label: '😞 Negative / Complaint' },
]

const REVIEW_PLATFORMS_LIST = [
  { value: 'google',      label: '🔍 Google' },
  { value: 'facebook',    label: '👥 Facebook' },
  { value: 'airbnb',      label: '🏠 Airbnb' },
  { value: 'booking_com', label: '📘 Booking.com' },
  { value: 'tripadvisor', label: '🦉 TripAdvisor' },
]

function ReviewResponder({ tenantId }: { tenantId: string }) {
  const [platform, setPlatform] = useState('google')
  const [sentiment, setSentiment] = useState('positive')
  const [tone, setTone] = useState('professional')
  const [reviewText, setReviewText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function generate() {
    setLoading(true)
    try {
      const data = await callAI('reviews', tenantId, { platform, sentiment, tone, reviewText, additionalContext: reviewText })
      setResult(data)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center">
              <Star size={14} className="text-white" />
            </div>
            <p className="font-semibold text-gray-800 text-sm">Review Details</p>
          </div>
          <FieldSelect label="Platform" value={platform} onChange={setPlatform} options={REVIEW_PLATFORMS_LIST} />
          <FieldSelect label="Review Sentiment" value={sentiment} onChange={setSentiment} options={REVIEW_SENTIMENTS} />
          <FieldSelect label="Response Tone" value={tone} onChange={setTone} options={TONES} />
          <FieldTextarea label="Review Text" value={reviewText} onChange={setReviewText} rows={5}
            placeholder="Paste the tenant or guest review here…" />
          <button onClick={generate} disabled={loading || !reviewText.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-2.5 text-sm font-semibold disabled:opacity-60">
            {loading ? <RotateCcw size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? 'Generating…' : 'Generate Response'}
          </button>
        </div>
      </div>

      <div className="lg:col-span-3">
        {!result ? (
          <div className="h-full min-h-[380px] rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-8 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-100 to-orange-100 flex items-center justify-center">
              <Star size={28} className="text-yellow-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-700">AI Review Responder</p>
              <p className="text-sm text-gray-400 mt-1">Paste any tenant or property review and generate a professional, on-brand response in seconds.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {result.response && (
              <ResultCard>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-800">Suggested Response</p>
                  <CopyButton text={result.response} />
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{result.response}</p>
              </ResultCard>
            )}
            {result.caption && !result.response && (
              <ResultCard>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-800">Suggested Response</p>
                  <CopyButton text={result.caption} />
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{result.caption}</p>
              </ResultCard>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tenant Retention ─────────────────────────────────────────────────────────

const RETENTION_TYPES = [
  { value: 'renewal_offer',     label: 'Renewal Offer Letter' },
  { value: 'early_renewal',     label: 'Early Renewal Incentive' },
  { value: 'rent_increase',     label: 'Rent Increase Notice' },
  { value: 'appreciation',      label: 'Tenant Appreciation Message' },
  { value: 'welcome',           label: 'New Tenant Welcome' },
  { value: 'maintenance_update','label': 'Maintenance Update' },
  { value: 'arrears_reminder',  label: 'Arrears / Payment Reminder' },
  { value: 'lease_expiry',      label: 'Lease Expiry Notice' },
]

function TenantRetention({ tenantId }: { tenantId: string }) {
  const [msgType, setMsgType] = useState('renewal_offer')
  const [tone, setTone] = useState('professional')
  const [language, setLanguage] = useState('en')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function generate() {
    setLoading(true)
    try {
      const data = await callAI('campaigns', tenantId, {
        campaignType: msgType, tone, language,
        additionalContext: context,
      })
      setResult(data)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Users size={14} className="text-white" />
            </div>
            <p className="font-semibold text-gray-800 text-sm">Message Settings</p>
          </div>
          <FieldSelect label="Message Type" value={msgType} onChange={setMsgType} options={RETENTION_TYPES} />
          <FieldSelect label="Tone" value={tone} onChange={setTone} options={TONES} />
          <FieldSelect label="Language" value={language} onChange={setLanguage} options={LANGUAGES} />
          <FieldTextarea label="Tenant / Lease Details" value={context} onChange={setContext} rows={4}
            placeholder={'e.g.\nTenant: Lucas Fernandez\nUnit: 101, Sunrise Apartments\nLease ends: Sep 2025\nNew rent: €880/mo (+3.5%)'} />
          <button onClick={generate} disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-2.5 text-sm font-semibold disabled:opacity-60">
            {loading ? <RotateCcw size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? 'Generating…' : 'Generate Message'}
          </button>
        </div>
      </div>

      <div className="lg:col-span-3">
        {!result ? (
          <div className="h-full min-h-[380px] rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-8 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
              <Users size={28} className="text-indigo-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-700">Tenant Communication Engine</p>
              <p className="text-sm text-gray-400 mt-1">Generate professional renewal offers, welcome letters, payment reminders, and retention messages — personalised for each tenant.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Renewal Offer', 'Welcome Letter', 'Payment Reminder', 'Rent Review'].map((t) => (
                <span key={t} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-3 py-1">{t}</span>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {(result.email || result.caption || result.message) && (
              <ResultCard>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-800">Message</p>
                  <CopyButton text={result.email || result.caption || result.message} />
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {result.email || result.caption || result.message}
                </p>
              </ResultCard>
            )}
            {result.subject && (
              <ResultCard>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800">Email Subject Line</p>
                  <CopyButton text={result.subject} />
                </div>
                <p className="text-sm text-gray-700">{result.subject}</p>
              </ResultCard>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PropertyMarketingHub() {
  const { tenant } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('social')
  const tenantId = tenant?.id ?? ''

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-body flex items-center gap-2">
              <Megaphone size={20} className="text-gold" /> Property AI Marketing
            </h1>
            <p className="text-sm text-subtext mt-0.5">AI-powered marketing tools for your property portfolio</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0B1F4B]/10 to-amber-100 px-3 py-1.5 text-xs font-semibold text-[#0B1F4B]">
            <Sparkles size={13} className="text-amber-500" /> Powered by AI
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-[#0B1F4B] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge && (
                <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div>
          {activeTab === 'social'     && <SocialStudio      tenantId={tenantId} />}
          {activeTab === 'listings'   && <ListingCopy       tenantId={tenantId} />}
          {activeTab === 'pricing'    && <PricingIntelligence tenantId={tenantId} />}
          {activeTab === 'reviews'    && <ReviewResponder   tenantId={tenantId} />}
          {activeTab === 'retention'  && <TenantRetention   tenantId={tenantId} />}
        </div>
      </div>
    </DashboardLayout>
  )
}
