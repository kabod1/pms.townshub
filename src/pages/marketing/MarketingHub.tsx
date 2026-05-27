import { useState, useEffect } from 'react'
import {
  Sparkles, Copy, Check, Instagram, Facebook, Twitter, Linkedin,
  MessageSquare, Mail, Star, TrendingUp, Gift, ChevronDown,
  Globe, Megaphone, RotateCcw, Download, Lightbulb, Clock,
  Image, Hash, Zap, Users, BarChart3, ArrowUpRight, ShieldCheck, AlertTriangle,
} from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Tab = 'social' | 'campaigns' | 'reviews' | 'pricing' | 'upsell'

const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
  { id: 'social', label: 'Social Studio', icon: <Instagram size={16} />, badge: 'New' },
  { id: 'campaigns', label: 'Guest Campaigns', icon: <Megaphone size={16} /> },
  { id: 'reviews', label: 'Review Responder', icon: <Star size={16} /> },
  { id: 'pricing', label: 'Pricing Intelligence', icon: <TrendingUp size={16} /> },
  { id: 'upsell', label: 'Upsell Engine', icon: <Gift size={16} /> },
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

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Copied!')
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

function ResultCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-gradient-to-br from-[#0F2138]/5 to-amber-50 border border-amber-100 p-4 space-y-3 ${className}`}>
      {children}
    </div>
  )
}

function Select({ label, value, onChange, options }: {
  label: string; value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 appearance-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    </div>
  )
}

function Textarea({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
      />
    </div>
  )
}

/* ═══════════════ SOCIAL STUDIO ═══════════════ */
const PLATFORMS = [
  { value: 'instagram', label: '📸 Instagram' },
  { value: 'facebook', label: '👥 Facebook' },
  { value: 'twitter', label: '🐦 Twitter / X' },
  { value: 'linkedin', label: '💼 LinkedIn' },
  { value: 'whatsapp', label: '💬 WhatsApp Broadcast' },
  { value: 'email', label: '📧 Email Newsletter' },
  { value: 'tiktok', label: '🎵 TikTok' },
  { value: 'google', label: '🔍 Google Business' },
  { value: 'tripadvisor', label: '🦉 TripAdvisor' },
]

const CONTENT_TYPES = [
  { value: 'promotional', label: 'Hotel Promotion' },
  { value: 'room_spotlight', label: 'Room Spotlight' },
  { value: 'fnb', label: 'Food & Beverage' },
  { value: 'seasonal', label: 'Seasonal Campaign' },
  { value: 'offer', label: 'Special Offer / Flash Sale' },
  { value: 'weekend', label: 'Weekend Getaway' },
  { value: 'romantic', label: 'Romantic Package' },
  { value: 'business', label: 'Business Travel / MICE' },
  { value: 'amenity', label: 'Amenity Highlight' },
  { value: 'hotel_story', label: 'Hotel Story / Behind-the-Scenes' },
  { value: 'review_highlight', label: 'Guest Review Showcase' },
  { value: 'event', label: 'Event Announcement' },
]

const TONES = [
  { value: 'luxury', label: '✨ Luxury & Sophisticated' },
  { value: 'warm', label: '🤗 Warm & Welcoming' },
  { value: 'fun', label: '🎉 Fun & Vibrant' },
  { value: 'professional', label: '💼 Professional & Corporate' },
  { value: 'romantic', label: '💕 Romantic & Intimate' },
  { value: 'adventure', label: '🏔 Adventure & Bold' },
]

const LANGUAGES = [
  { value: 'en', label: '🇬🇧 English' },
  { value: 'fr', label: '🇫🇷 French' },
  { value: 'es', label: '🇪🇸 Spanish' },
  { value: 'ar', label: '🇸🇦 Arabic' },
  { value: 'sw', label: '🇰🇪 Swahili' },
  { value: 'pt', label: '🇧🇷 Portuguese' },
  { value: 'de', label: '🇩🇪 German' },
]

function SocialStudio({ tenantId }: { tenantId: string }) {
  const [platform, setPlatform] = useState('instagram')
  const [contentType, setContentType] = useState('promotional')
  const [tone, setTone] = useState('luxury')
  const [language, setLanguage] = useState('en')
  const [additionalContext, setAdditionalContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])

  async function generate() {
    setLoading(true)
    try {
      const data = await callAI('social', tenantId, { platform, contentType, tone, language, additionalContext })
      setResult(data)
      setHistory((h) => [{ platform, contentType, ...data }, ...h.slice(0, 4)])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const platformIcon: Record<string, React.ReactNode> = {
    instagram: <Instagram size={16} />, facebook: <Facebook size={16} />,
    twitter: <Twitter size={16} />, linkedin: <Linkedin size={16} />,
    whatsapp: <MessageSquare size={16} />, email: <Mail size={16} />,
    tiktok: <span className="text-sm">🎵</span>,
    google: <Globe size={16} />, tripadvisor: <span className="text-sm">🦉</span>,
  }

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {/* Controls */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <p className="font-semibold text-gray-800 text-sm">Content Settings</p>
          </div>
          <Select label="Platform" value={platform} onChange={setPlatform} options={PLATFORMS} />
          <Select label="Content Type" value={contentType} onChange={setContentType} options={CONTENT_TYPES} />
          <Select label="Brand Tone" value={tone} onChange={setTone} options={TONES} />
          <Select label="Language" value={language} onChange={setLanguage} options={LANGUAGES} />
          <Textarea
            label="Additional Context (optional)"
            value={additionalContext}
            onChange={setAdditionalContext}
            placeholder="e.g. 'We have a rooftop pool with city views' or 'Weekend special: 20% off'"
            rows={2}
          />
          <Button fullWidth onClick={generate} loading={loading} className="bg-gradient-to-r from-[#0F2138] to-amber-600 text-white">
            <Sparkles size={15} /> Generate Content
          </Button>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Recent Generations</p>
            <div className="space-y-2">
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => setResult(h)}
                  className="w-full text-left flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
                >
                  <span>{platformIcon[h.platform]}</span>
                  <span className="text-xs text-gray-600 truncate">{h.caption?.slice(0, 50)}…</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Output */}
      <div className="lg:col-span-3">
        {!result ? (
          <div className="h-full min-h-[400px] rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-8 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
              <Sparkles size={28} className="text-purple-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-700">AI Content Studio</p>
              <p className="text-sm text-gray-400 mt-1">Configure your settings and click Generate to create platform-optimised marketing content instantly.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Instagram', 'Facebook', 'Email', 'WhatsApp', 'LinkedIn'].map((p) => (
                <span key={p} className="text-xs bg-gray-100 text-gray-500 rounded-full px-3 py-1">{p}</span>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Caption */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {platformIcon[platform]}
                  <p className="text-sm font-semibold text-gray-800">Caption / Copy</p>
                </div>
                <div className="flex items-center gap-3">
                  <CopyButton text={result.caption} label="Copy Caption" />
                  <button onClick={generate} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    <RotateCcw size={12} /> Regenerate
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
                {result.caption}
              </p>
            </div>

            {/* Email subject if applicable */}
            {result.emailSubject && (
              <ResultCard>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-amber-600" />
                    <p className="text-xs font-semibold text-gray-700">Email Subject Line</p>
                  </div>
                  <CopyButton text={result.emailSubject} />
                </div>
                <p className="text-sm font-medium text-gray-800">{result.emailSubject}</p>
              </ResultCard>
            )}

            {/* Hashtags */}
            {result.hashtags?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Hash size={14} className="text-blue-500" />
                    <p className="text-sm font-semibold text-gray-800">Hashtags</p>
                  </div>
                  <CopyButton text={result.hashtags.map((h: string) => `#${h.replace(/^#/, '')}`).join(' ')} label="Copy All" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.hashtags.map((tag: string, i: number) => (
                    <span key={i} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 font-medium">
                      #{tag.replace(/^#/, '')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Image Prompt */}
              {result.imagePrompt && (
                <ResultCard>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Image size={13} className="text-purple-500" />
                      <p className="text-xs font-semibold text-gray-700">AI Image Prompt</p>
                    </div>
                    <CopyButton text={result.imagePrompt} />
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{result.imagePrompt}</p>
                </ResultCard>
              )}

              {/* Best time + CTA */}
              <div className="space-y-3">
                {result.bestTimeToPost && (
                  <ResultCard>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock size={13} className="text-green-600" />
                      <p className="text-xs font-semibold text-gray-700">Best Time to Post</p>
                    </div>
                    <p className="text-xs text-gray-700">{result.bestTimeToPost}</p>
                  </ResultCard>
                )}
                {result.cta && (
                  <ResultCard>
                    <div className="flex items-center gap-1.5 mb-1">
                      <ArrowUpRight size={13} className="text-amber-600" />
                      <p className="text-xs font-semibold text-gray-700">Call to Action</p>
                    </div>
                    <p className="text-xs text-gray-700">{result.cta}</p>
                  </ResultCard>
                )}
              </div>
            </div>

            {/* Pro tip */}
            {result.proTip && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
                <Lightbulb size={15} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800"><span className="font-semibold">Pro tip: </span>{result.proTip}</p>
              </div>
            )}

            {/* Copy all */}
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                const all = [
                  result.caption,
                  result.emailSubject ? `\nSubject: ${result.emailSubject}` : '',
                  result.hashtags?.length ? `\n${result.hashtags.map((h: string) => `#${h.replace(/^#/, '')}`).join(' ')}` : '',
                ].join('')
                navigator.clipboard.writeText(all)
                toast.success('Full content copied!')
              }}
            >
              <Download size={14} /> Copy Full Post to Clipboard
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════ GUEST CAMPAIGNS ═══════════════ */
const SEGMENTS = [
  { value: 'new', label: '🌟 New Guests (post first stay)' },
  { value: 'returning', label: '🔄 Returning Guests (2–5 stays)' },
  { value: 'lapsed', label: '😴 Lapsed Guests (90+ days gone)' },
  { value: 'birthday', label: '🎂 Birthday Month Guests' },
  { value: 'anniversary', label: '💍 Stay Anniversary' },
  { value: 'vip', label: '👑 VIP Loyalty Members' },
  { value: 'corporate', label: '💼 Corporate Accounts' },
  { value: 'post_stay', label: '⭐ Post-Stay (48hr follow-up)' },
]

const CHANNELS = [
  { value: 'email', label: '📧 Email' },
  { value: 'whatsapp', label: '💬 WhatsApp' },
  { value: 'sms', label: '📱 SMS' },
]

function GuestCampaigns({ tenantId }: { tenantId: string }) {
  const [segment, setSegment] = useState('lapsed')
  const [channel, setChannel] = useState('whatsapp')
  const [offer, setOffer] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [activeVar, setActiveVar] = useState(0)
  const [consentCount, setConsentCount] = useState<number | null>(null)
  const [totalCount, setTotalCount] = useState<number | null>(null)

  // Fetch consented guest count whenever segment changes
  useEffect(() => {
    async function fetchConsentCount() {
      setConsentCount(null)
      setTotalCount(null)
      try {
        const now = new Date()
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString().split('T')[0]

        let query = supabase.from('guests').select('id, marketing_consent', { count: 'exact' }).eq('tenant_id', tenantId)
        let totalQuery = supabase.from('guests').select('id', { count: 'exact' }).eq('tenant_id', tenantId)

        // Approximate segment filtering
        if (segment === 'new')        { query = query.eq('total_stays', 1);   totalQuery = totalQuery.eq('total_stays', 1) }
        if (segment === 'returning')  { query = query.gte('total_stays', 2).lte('total_stays', 5); totalQuery = totalQuery.gte('total_stays', 2).lte('total_stays', 5) }
        if (segment === 'vip')        { query = query.gte('total_stays', 5);  totalQuery = totalQuery.gte('total_stays', 5) }
        if (segment === 'lapsed')     { query = query.lt('updated_at', ninetyDaysAgo); totalQuery = totalQuery.lt('updated_at', ninetyDaysAgo) }
        if (segment === 'birthday')   { query = query.not('date_of_birth', 'is', null); totalQuery = totalQuery.not('date_of_birth', 'is', null) }
        if (segment === 'corporate')  { query = query.not('company_name', 'is', null); totalQuery = totalQuery.not('company_name', 'is', null) }

        const [all, consented] = await Promise.all([
          totalQuery,
          query.eq('marketing_consent', true),
        ])
        setTotalCount(all.count ?? 0)
        setConsentCount(consented.count ?? 0)
      } catch { /* non-critical */ }
    }
    fetchConsentCount()
  }, [segment, tenantId])

  async function generate() {
    setLoading(true)
    try {
      const data = await callAI('campaign', tenantId, { segment, channel, offer })
      setResult(data)
      setActiveVar(0)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Users size={14} className="text-white" />
            </div>
            <p className="font-semibold text-gray-800 text-sm">Campaign Setup</p>
          </div>
          <Select label="Guest Segment" value={segment} onChange={setSegment} options={SEGMENTS} />
          <Select label="Channel" value={channel} onChange={setChannel} options={CHANNELS} />
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Special Offer (optional)</label>
            <input
              type="text"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              placeholder="e.g. 20% off, free breakfast, room upgrade"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>
          {/* GDPR consent count */}
          {totalCount !== null && (
            <div className={`rounded-lg px-3 py-2.5 flex items-center gap-2 text-xs ${
              consentCount === 0 ? 'bg-red-50 border border-red-200 text-red-700'
              : consentCount! < totalCount! ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : 'bg-green-50 border border-green-200 text-green-800'
            }`}>
              <ShieldCheck size={13} className="shrink-0" />
              <span>
                <strong>{consentCount}</strong> of {totalCount} guests in this segment have marketing consent.{' '}
                {consentCount === 0 && <span className="font-semibold">Do not send — no consented recipients.</span>}
                {consentCount! > 0 && consentCount! < totalCount! && 'Only send to consented guests.'}
              </span>
            </div>
          )}

          <Button fullWidth onClick={generate} loading={loading} disabled={consentCount === 0}
            className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white disabled:opacity-40">
            <Sparkles size={15} /> Generate 3 Variations
          </Button>
        </div>

        {result?.segmentInsight && (
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb size={14} className="text-blue-600" />
              <p className="text-xs font-semibold text-blue-800">Segment Insight</p>
            </div>
            <p className="text-xs text-blue-700 leading-relaxed">{result.segmentInsight}</p>
          </div>
        )}
        {result?.sendingTip && (
          <div className="rounded-xl bg-green-50 border border-green-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={14} className="text-green-600" />
              <p className="text-xs font-semibold text-green-800">Best Sending Strategy</p>
            </div>
            <p className="text-xs text-green-700 leading-relaxed">{result.sendingTip}</p>
          </div>
        )}
      </div>

      <div className="lg:col-span-3">
        {!result ? (
          <div className="h-full min-h-[400px] rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-8 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Megaphone size={28} className="text-blue-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-700">Guest Campaign Generator</p>
              <p className="text-sm text-gray-400 mt-1">Generate 3 personalised message variations for any guest segment — email, WhatsApp, or SMS.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              {result.variations?.map((_: any, i: number) => (
                <button
                  key={i}
                  onClick={() => setActiveVar(i)}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${activeVar === i ? 'bg-[#0F2138] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Variation {i + 1}
                </button>
              ))}
            </div>

            {result.variations?.[activeVar] && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {result.variations[activeVar].label}
                  </p>
                  <CopyButton text={[
                    result.variations[activeVar].subject ? `Subject: ${result.variations[activeVar].subject}` : '',
                    result.variations[activeVar].message
                  ].filter(Boolean).join('\n\n')} label="Copy Message" />
                </div>

                {result.variations[activeVar].subject && (
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <span className="text-xs text-gray-500">Subject: </span>
                    <span className="text-sm font-medium text-gray-800">{result.variations[activeVar].subject}</span>
                  </div>
                )}

                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {result.variations[activeVar].message}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <Zap size={12} className="shrink-0" />
                  Replace <code className="bg-amber-100 px-1 rounded">{'{{guest_name}}'}</code> with actual guest name before sending
                </div>
                <div className="flex items-start gap-2 text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <ShieldCheck size={12} className="shrink-0 mt-0.5" />
                  <span><strong>GDPR:</strong> Only send to guests with <strong>marketing consent = Yes</strong>. Check each guest profile before sending. Guests who opted out must not receive this message.</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════ REVIEW RESPONDER ═══════════════ */
const REVIEW_PLATFORMS = [
  { value: 'google', label: '🔍 Google Reviews' },
  { value: 'tripadvisor', label: '🦉 TripAdvisor' },
  { value: 'bookingcom', label: '🏨 Booking.com' },
  { value: 'airbnb', label: '🏠 Airbnb' },
  { value: 'facebook', label: '👥 Facebook' },
]

const RESPONSE_TONES = [
  { value: 'warm', label: '🤗 Warm & Personal' },
  { value: 'professional', label: '💼 Professional' },
  { value: 'diplomatic', label: '🕊 Diplomatic (for complaints)' },
]

function ReviewResponder({ tenantId }: { tenantId: string }) {
  const [reviewText, setReviewText] = useState('')
  const [rating, setRating] = useState('5')
  const [platform, setPlatform] = useState('google')
  const [tone, setTone] = useState('warm')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function generate() {
    if (!reviewText.trim()) { toast.error('Paste the review text first'); return }
    setLoading(true)
    try {
      const data = await callAI('review', tenantId, { reviewText, rating, platform, tone })
      setResult(data)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const stars = Array.from({ length: 5 }, (_, i) => i < Number(rating))

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Star size={14} className="text-white" />
            </div>
            <p className="font-semibold text-gray-800 text-sm">Review Details</p>
          </div>
          <Select label="Platform" value={platform} onChange={setPlatform} options={REVIEW_PLATFORMS} />
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Star Rating</label>
            <div className="flex gap-2">
              {[1,2,3,4,5].map((n) => (
                <button
                  key={n}
                  onClick={() => { setRating(String(n)); setTone(n <= 2 ? 'diplomatic' : 'warm') }}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                    Number(rating) === n ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-500 hover:bg-amber-50'
                  }`}
                >{n}★</button>
              ))}
            </div>
          </div>
          <Select label="Response Tone" value={tone} onChange={setTone} options={RESPONSE_TONES} />
          <Textarea
            label="Paste Review Here"
            value={reviewText}
            onChange={setReviewText}
            placeholder="Paste the guest review text…"
            rows={5}
          />
          <Button fullWidth onClick={generate} loading={loading} className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
            <Sparkles size={15} /> Generate Response
          </Button>
        </div>
      </div>

      <div className="lg:col-span-3">
        {!result ? (
          <div className="h-full min-h-[400px] rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-8 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
              <Star size={28} className="text-amber-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-700">Review Response Generator</p>
              <p className="text-sm text-gray-400 mt-1">Paste any review and get a professional, personalised response in seconds. Works for all star ratings.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex">
                    {stars.map((filled, i) => (
                      <Star key={i} size={16} className={filled ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
                    ))}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    result.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                    result.sentiment === 'negative' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                  }`}>{result.sentiment}</span>
                  <span className="text-xs text-gray-400">{result.characterCount} chars</span>
                </div>
                <CopyButton text={result.response} label="Copy Response" />
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{result.response}</p>
              </div>

              {result.reputationTip && (
                <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 flex items-start gap-2">
                  <Lightbulb size={14} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800"><span className="font-semibold">Reputation tip: </span>{result.reputationTip}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════ PRICING INTELLIGENCE ═══════════════ */
function PricingIntelligence({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function analyse() {
    setLoading(true)
    try {
      const data = await callAI('pricing', tenantId, {})
      setResult(data)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const urgencyColor: Record<string, string> = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-green-100 text-green-700 border-green-200',
  }

  return (
    <div className="space-y-6">
      {!result ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-12 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
            <TrendingUp size={28} className="text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-700">Revenue Intelligence</p>
            <p className="text-sm text-gray-400 mt-1 max-w-sm">Analyses your live occupancy data and generates AI-powered pricing recommendations for the next 30 days.</p>
          </div>
          <Button onClick={analyse} loading={loading} className="bg-gradient-to-r from-green-600 to-teal-500 text-white mt-2">
            <BarChart3 size={15} /> Analyse My Revenue
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: '7-Day Occupancy', value: `${result.occ7}%`, color: result.occ7 > 70 ? 'text-green-600' : result.occ7 > 40 ? 'text-amber-600' : 'text-red-500' },
              { label: '30-Day Occupancy', value: `${result.occ30}%`, color: result.occ30 > 70 ? 'text-green-600' : result.occ30 > 40 ? 'text-amber-600' : 'text-red-500' },
              { label: 'Total Rooms', value: result.totalRooms, color: 'text-gray-800' },
            ].map((m) => (
              <div key={m.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                <p className="text-xs text-gray-500 mt-1">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm text-gray-700 leading-relaxed">{result.summary}</p>
          </div>

          {/* Recommendations */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-700">Recommendations</p>
            {result.recommendations?.map((r: any, i: number) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-4">
                <span className={`text-xs font-bold px-2 py-1 rounded-full border ${urgencyColor[r.urgency] || 'bg-gray-100 text-gray-600'} shrink-0`}>
                  {r.urgency}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{r.action}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.reason}</p>
                </div>
                {r.estimatedImpact && (
                  <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-lg shrink-0">{r.estimatedImpact}</span>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {result.pricingStrategy && (
              <ResultCard>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={13} className="text-green-600" />
                  <p className="text-xs font-semibold text-gray-700">30-Day Strategy</p>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{result.pricingStrategy}</p>
              </ResultCard>
            )}
            {result.channelAdvice && (
              <ResultCard>
                <div className="flex items-center gap-2 mb-1">
                  <Globe size={13} className="text-blue-600" />
                  <p className="text-xs font-semibold text-gray-700">Channel Priority</p>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{result.channelAdvice}</p>
              </ResultCard>
            )}
          </div>

          <Button variant="outline" onClick={analyse} loading={loading}>
            <RotateCcw size={14} /> Refresh Analysis
          </Button>
        </div>
      )}
    </div>
  )
}

/* ═══════════════ UPSELL ENGINE ═══════════════ */
function UpsellEngine({ tenantId }: { tenantId: string }) {
  const [guestName, setGuestName] = useState('')
  const [roomType, setRoomType] = useState('')
  const [totalStays, setTotalStays] = useState('1')
  const [nights, setNights] = useState('1')
  const [checkInDate, setCheckInDate] = useState('')
  const [recentOrders, setRecentOrders] = useState('')
  const [specialOccasion, setSpecialOccasion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [activeChannel, setActiveChannel] = useState<'whatsapp' | 'email' | 'frontDesk'>('whatsapp')

  async function generate() {
    if (!guestName.trim()) { toast.error('Enter guest name'); return }
    setLoading(true)
    try {
      const data = await callAI('upsell', tenantId, {
        guestName, roomType, totalStays: Number(totalStays), nights: Number(nights),
        checkInDate, recentOrders: recentOrders ? recentOrders.split(',').map((s) => s.trim()) : [],
        specialOccasion,
      })
      setResult(data)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
              <Gift size={14} className="text-white" />
            </div>
            <p className="font-semibold text-gray-800 text-sm">Guest Profile</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Guest Name *</label>
            <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="e.g. Sarah Johnson"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Room Type</label>
              <input value={roomType} onChange={(e) => setRoomType(e.target.value)} placeholder="e.g. Deluxe Suite"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Stays</label>
              <input type="number" min="1" value={totalStays} onChange={(e) => setTotalStays(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Nights</label>
              <input type="number" min="1" value={nights} onChange={(e) => setNights(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Check-in</label>
              <input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Past F&B Orders (comma separated)</label>
            <input value={recentOrders} onChange={(e) => setRecentOrders(e.target.value)} placeholder="e.g. Grilled salmon, Red wine, Breakfast"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Special Occasion</label>
            <input value={specialOccasion} onChange={(e) => setSpecialOccasion(e.target.value)} placeholder="e.g. Anniversary, Birthday, Honeymoon"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <Button fullWidth onClick={generate} loading={loading} className="bg-gradient-to-r from-purple-600 to-indigo-500 text-white">
            <Sparkles size={15} /> Generate Upsell Offers
          </Button>
        </div>
      </div>

      <div className="lg:col-span-3">
        {!result ? (
          <div className="h-full min-h-[400px] rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-8 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center">
              <Gift size={28} className="text-purple-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-700">AI Upsell Engine</p>
              <p className="text-sm text-gray-400 mt-1">Enter a guest profile and get personalised upsell scripts for WhatsApp, Email, and Front Desk — all tailored to that specific guest.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Top offers */}
            {result.topOffers?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Recommended Offers for {guestName}</p>
                <div className="space-y-2">
                  {result.topOffers.map((o: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg bg-purple-50 border border-purple-100 p-3">
                      <span className="w-5 h-5 rounded-full bg-purple-200 text-purple-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{o.offer}</p>
                        <p className="text-xs text-purple-700 mt-0.5">{o.pitch}</p>
                        <p className="text-xs text-gray-500 mt-0.5 italic">{o.personalisation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Channel tabs */}
            <div className="flex gap-2">
              {([['whatsapp', '💬 WhatsApp'], ['email', '📧 Email'], ['frontDesk', '🎙 Front Desk']] as const).map(([ch, label]) => (
                <button key={ch} onClick={() => setActiveChannel(ch)}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${activeChannel === ch ? 'bg-[#0F2138] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {activeChannel === 'whatsapp' ? 'WhatsApp Message' : activeChannel === 'email' ? 'Email Content' : 'Front Desk Script'}
                </p>
                <CopyButton text={
                  activeChannel === 'whatsapp' ? result.whatsappMessage :
                  activeChannel === 'email' ? `Subject: ${result.emailSubject}\n\n${result.emailBody}` :
                  result.frontDeskScript
                } />
              </div>
              {activeChannel === 'email' && result.emailSubject && (
                <div className="rounded-lg bg-gray-50 px-3 py-2 mb-3">
                  <span className="text-xs text-gray-500">Subject: </span>
                  <span className="text-sm font-medium text-gray-800">{result.emailSubject}</span>
                </div>
              )}
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {activeChannel === 'whatsapp' ? result.whatsappMessage :
                   activeChannel === 'email' ? result.emailBody :
                   result.frontDeskScript}
                </p>
              </div>
            </div>

            {result.bestTimingAdvice && (
              <div className="rounded-xl bg-purple-50 border border-purple-100 p-3 flex items-start gap-2">
                <Clock size={14} className="text-purple-600 mt-0.5 shrink-0" />
                <p className="text-xs text-purple-800"><span className="font-semibold">Timing: </span>{result.bestTimingAdvice}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════ MAIN PAGE ═══════════════ */
export default function MarketingHub() {
  const { tenant } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('social')

  if (!tenant) return null

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0F2138] to-amber-600 flex items-center justify-center shadow-md">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">AI Marketing Hub</h1>
                <p className="text-sm text-gray-500">Powered by Claude AI · {tenant.name}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0F2138] to-amber-600 px-4 py-2">
            <Zap size={14} className="text-amber-300" />
            <span className="text-xs font-semibold text-white">5 AI Marketing Tools</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide bg-white rounded-xl border border-gray-100 shadow-sm p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-[#0F2138] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-amber-400 text-white' : 'bg-amber-100 text-amber-700'
                }`}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'social' && <SocialStudio tenantId={tenant.id} />}
          {activeTab === 'campaigns' && <GuestCampaigns tenantId={tenant.id} />}
          {activeTab === 'reviews' && <ReviewResponder tenantId={tenant.id} />}
          {activeTab === 'pricing' && <PricingIntelligence tenantId={tenant.id} />}
          {activeTab === 'upsell' && <UpsellEngine tenantId={tenant.id} />}
        </div>
      </div>
    </DashboardLayout>
  )
}
