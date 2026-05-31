import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Building2, Users, CalendarDays, CreditCard, BarChart3,
  Globe2, Shield, Zap, Star, ArrowRight, Check, ChevronDown,
  Wifi, Bell, MessageSquare, FileText, Settings,
  TrendingUp, Award, Lock, HeartHandshake, ChevronRight, Menu, X,
  MapPin, Mail,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

// ─── Types ────────────────────────────────────────────────────────────────────
type Tier = 'essential' | 'professional' | 'enterprise'
interface PricingPlan {
  tier: Tier
  name: string
  price: number
  period: string
  description: string
  features: string[]
  highlighted?: boolean
  cta: string
}

// ─── Brand colours ─────────────────────────────────────────────────────────────
const NAVY   = '#0F2138'
const NAVY2  = '#162d4a'
const GOLD   = '#D4A843'

// ─── Data ──────────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: CalendarDays,
    title: 'Reservations & Calendar',
    desc: 'Drag-and-drop booking calendar, OTA sync, pre-check-in links and automated confirmations — all in one place.',
    color: '#3B82F6',
  },
  {
    icon: Users,
    title: 'Guest Management',
    desc: 'Rich guest profiles, loyalty tiers, marketing consent, GDPR data portability and Right to be Forgotten built-in.',
    color: '#10B981',
  },
  {
    icon: CreditCard,
    title: 'Payments & Invoicing',
    desc: 'Stripe payment links, cash/card recording, auto-invoicing with PDF export and tax-ready ledger.',
    color: '#F59E0B',
  },
  {
    icon: Globe2,
    title: 'Channel Manager',
    desc: 'Two-way sync with SiteMinder, Booking.com, Airbnb, Expedia and 50+ OTAs. No double-bookings.',
    color: '#8B5CF6',
  },
  {
    icon: BarChart3,
    title: 'Reports & BI',
    desc: 'Executive dashboard, RevPAR, ADR, occupancy trends, custom report builder and predictive analytics.',
    color: '#EF4444',
  },
  {
    icon: Building2,
    title: 'Property Management',
    desc: 'Manage apartments, villas and short-term rentals. Leases, owners, rent collection and maintenance in one platform.',
    color: '#06B6D4',
  },
  {
    icon: MessageSquare,
    title: 'AI Concierge & Chat',
    desc: 'GPT-powered guest chat widget, staff AI assistant, automated upsell suggestions and guest satisfaction surveys.',
    color: '#F97316',
  },
  {
    icon: Shield,
    title: 'GDPR Compliant',
    desc: 'Cookie consent, privacy policy, data export (Art. 20), Right to be Forgotten (Art. 17) and audit logs — all included.',
    color: '#0F2138',
  },
]

const STATS = [
  { value: '4 hrs', label: 'saved per day on admin', icon: Zap },
  { value: '23 %', label: 'avg. revenue increase', icon: TrendingUp },
  { value: '100 %', label: 'GDPR & EU compliant', icon: Shield },
  { value: '50+', label: 'OTA channels supported', icon: Globe2 },
]

const INTEGRATIONS = [
  'SiteMinder', 'Booking.com', 'Airbnb', 'Expedia', 'Hotels.com',
  'Agoda', 'Stripe', 'Resend Email', 'WhatsApp', 'Google Analytics',
]

const PRICING: PricingPlan[] = [
  {
    tier: 'essential',
    name: 'Essential',
    price: 49,
    period: '/month',
    description: 'Perfect for small hotels and B&Bs.',
    cta: 'Start free trial',
    features: [
      'Up to 20 rooms',
      'Reservations & calendar',
      'Guest management',
      'Invoicing & payments',
      '2 user seats',
      'Email support',
      'GDPR tools',
    ],
  },
  {
    tier: 'professional',
    name: 'Professional',
    price: 99,
    period: '/month',
    description: 'For growing hotels that need more power.',
    cta: 'Start free trial',
    highlighted: true,
    features: [
      'Up to 100 rooms',
      'Everything in Essential',
      'Channel Manager (SiteMinder)',
      'Reports & BI dashboard',
      'AI concierge & chat',
      'Marketing Hub',
      'Loyalty programme',
      '10 user seats',
      'Priority support',
    ],
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    price: 249,
    period: '/month',
    description: 'Multi-property groups and resort chains.',
    cta: 'Contact sales',
    features: [
      'Unlimited rooms & properties',
      'Everything in Professional',
      'Property Management module',
      'Owner portal',
      'Custom integrations',
      'Dedicated account manager',
      'SLA & uptime guarantee',
      'Unlimited seats',
      'White-label option',
    ],
  },
]

const TESTIMONIALS = [
  {
    name: 'Nikos Andreou',
    role: 'Owner, Limassol Bay Suites',
    avatar: 'NA',
    quote: 'TownsHub cut our check-in time in half and the channel manager eliminated double-bookings completely. Worth every cent.',
    rating: 5,
  },
  {
    name: 'Maria Papadopoulou',
    role: 'GM, Paphos Boutique Hotel',
    avatar: 'MP',
    quote: 'Finally a PMS that understands European hospitality. The GDPR tools alone saved us weeks of compliance work.',
    rating: 5,
  },
  {
    name: 'Stavros Kyriakides',
    role: 'Property Manager, Ayia Napa Villas',
    avatar: 'SK',
    quote: 'Managing 12 villas and 3 apartments used to be chaos. Now everything is in one dashboard and owners love the portal.',
    rating: 5,
  },
]

// ─── Sub-components ────────────────────────────────────────────────────────────

function NavBar({ onCtaClick }: { onCtaClick: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="#" className="flex items-center gap-3">
            <div className="bg-white rounded-xl p-1.5 shadow-sm flex-shrink-0">
              <img src="/logo-icon.jpg" alt="TownsHub" className="h-8 w-8 object-contain rounded-lg" />
            </div>
            <span className="font-extrabold text-xl tracking-tight" style={{ color: scrolled ? NAVY : 'white' }}>
              TownsHub PMS
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            {['Features', 'Pricing', 'Integrations', 'About'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className={`font-medium transition-colors hover:opacity-80 ${
                  scrolled ? 'text-gray-600' : 'text-white/80'
                }`}
              >
                {item}
              </a>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/auth/login"
              className={`text-sm font-medium transition-colors ${
                scrolled ? 'text-gray-700 hover:text-gray-900' : 'text-white/80 hover:text-white'
              }`}
            >
              Sign in
            </Link>
            <button
              onClick={onCtaClick}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: GOLD }}
            >
              Start free trial
            </button>
          </div>

          {/* Mobile toggle */}
          <button
            className={`md:hidden ${scrolled ? 'text-gray-700' : 'text-white'}`}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 pt-2 bg-white rounded-xl shadow-lg -mx-4 px-4 mt-2">
            <nav className="flex flex-col gap-3 text-sm">
              {['Features', 'Pricing', 'Integrations', 'About'].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="text-gray-700 font-medium py-1"
                  onClick={() => setMobileOpen(false)}
                >
                  {item}
                </a>
              ))}
              <hr className="border-gray-100" />
              <Link to="/auth/login" className="text-gray-700 font-medium py-1">Sign in</Link>
              <button
                onClick={() => { onCtaClick(); setMobileOpen(false) }}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: GOLD }}
              >
                Start free trial
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} size={14} fill={GOLD} color={GOLD} />
      ))}
    </div>
  )
}

function PricingCard({ plan, onCtaClick }: { plan: PricingPlan; onCtaClick: () => void }) {
  return (
    <div
      className={`relative rounded-2xl p-8 flex flex-col transition-all duration-300 hover:-translate-y-1 ${
        plan.highlighted
          ? 'shadow-2xl text-white'
          : 'bg-white border border-gray-100 shadow-sm hover:shadow-md'
      }`}
      style={plan.highlighted ? { background: NAVY } : undefined}
    >
      {plan.highlighted && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white"
          style={{ background: GOLD }}
        >
          MOST POPULAR
        </div>
      )}

      <div>
        <h3 className={`text-lg font-bold mb-1 ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
          {plan.name}
        </h3>
        <p className={`text-sm mb-4 ${plan.highlighted ? 'text-white/70' : 'text-gray-500'}`}>
          {plan.description}
        </p>
        <div className="flex items-end gap-1 mb-6">
          <span className={`text-4xl font-black ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
            €{plan.price}
          </span>
          <span className={`text-sm mb-1 ${plan.highlighted ? 'text-white/60' : 'text-gray-400'}`}>
            {plan.period}
          </span>
        </div>
      </div>

      <ul className="flex-1 space-y-3 mb-8">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm">
            <Check
              size={16}
              className="shrink-0 mt-0.5"
              style={{ color: plan.highlighted ? GOLD : '#10B981' }}
            />
            <span className={plan.highlighted ? 'text-white/90' : 'text-gray-600'}>{f}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onCtaClick}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-95 ${
          plan.highlighted
            ? 'text-white'
            : 'text-white'
        }`}
        style={{
          background: plan.highlighted ? GOLD : NAVY,
        }}
      >
        {plan.cta}
        {plan.tier !== 'enterprise' && (
          <span className="text-xs font-normal ml-1.5 opacity-75">— 14 days free</span>
        )}
      </button>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function Landing() {
  const navigate = useNavigate()
  const { user, isInitialized } = useAuthStore()

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isInitialized && user) {
      navigate('/dashboard', { replace: true })
    }
  }, [isInitialized, user, navigate])

  function handleCta() {
    navigate('/auth/register')
  }

  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      <NavBar onCtaClick={handleCta} />

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex items-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY2} 60%, #1a3a58 100%)` }}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `radial-gradient(circle at 25px 25px, white 1px, transparent 0)`,
              backgroundSize: '50px 50px',
            }}
          />
        </div>

        {/* Gold accent blob */}
        <div
          className="absolute top-1/3 right-0 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: GOLD }}
        />
        <div
          className="absolute bottom-0 left-1/4 w-64 h-64 rounded-full opacity-10 blur-3xl"
          style={{ background: GOLD }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
                style={{ background: 'rgba(212,168,67,0.15)', color: GOLD, border: `1px solid rgba(212,168,67,0.3)` }}
              >
                <Zap size={12} />
                Now with AI concierge & 16 languages
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-6">
                The complete<br />
                <span style={{ color: GOLD }}>hotel management</span><br />
                platform for Europe
              </h1>

              <p className="text-lg text-white/70 mb-8 max-w-lg leading-relaxed">
                Reservations, guests, payments, channel manager, AI concierge, property
                management and GDPR compliance — all in one beautifully simple platform.
              </p>

              <div className="flex flex-wrap gap-3 mb-10">
                <button
                  onClick={handleCta}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 active:scale-95 shadow-lg"
                  style={{ background: GOLD }}
                >
                  Start free 14-day trial
                  <ArrowRight size={16} />
                </button>
                <a
                  href="#pricing"
                  className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white text-sm border border-white/20 hover:bg-white/10 transition-all"
                >
                  See pricing
                  <ChevronDown size={16} />
                </a>
              </div>

              {/* Trust signals */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/50">
                <span className="flex items-center gap-1.5"><Check size={14} style={{ color: GOLD }} /> No credit card required</span>
                <span className="flex items-center gap-1.5"><Check size={14} style={{ color: GOLD }} /> GDPR compliant</span>
                <span className="flex items-center gap-1.5"><Check size={14} style={{ color: GOLD }} /> Cancel anytime</span>
              </div>
            </div>

            {/* Right — Dashboard mockup */}
            <div className="hidden lg:block">
              <div
                className="rounded-2xl overflow-hidden shadow-2xl border"
                style={{ borderColor: 'rgba(255,255,255,0.1)', background: '#f8fafc' }}
              >
                {/* Browser chrome */}
                <div className="flex items-center gap-1.5 px-4 py-3 bg-gray-100 border-b border-gray-200">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <div className="flex-1 mx-3 px-3 py-1 rounded bg-white text-xs text-gray-400 font-mono">
                    app.townshub.cy/dashboard
                  </div>
                </div>

                {/* Mock dashboard */}
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 text-sm">Today's Overview</h3>
                    <span className="text-xs text-gray-400">Tue 27 May 2026</span>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Occupancy', value: '87%', color: '#10B981' },
                      { label: 'Check-ins today', value: '8', color: '#3B82F6' },
                      { label: 'Revenue MTD', value: '€24,180', color: GOLD },
                    ].map((s) => (
                      <div key={s.label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                        <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                        <p className="text-lg font-black" style={{ color: s.color }}>{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Mini room grid */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Room Status</p>
                    <div className="grid grid-cols-6 gap-1.5">
                      {[
                        ...Array(10).fill('occupied'),
                        ...Array(2).fill('checkout'),
                        ...Array(2).fill('available'),
                        ...Array(1).fill('maintenance'),
                      ].map((status, i) => (
                        <div
                          key={i}
                          className="aspect-square rounded text-center text-xs flex items-center justify-center font-semibold"
                          style={{
                            background:
                              status === 'occupied' ? '#DCFCE7' :
                              status === 'checkout' ? '#FEF3C7' :
                              status === 'available' ? '#DBEAFE' :
                              '#FEE2E2',
                            color:
                              status === 'occupied' ? '#166534' :
                              status === 'checkout' ? '#92400E' :
                              status === 'available' ? '#1E40AF' :
                              '#991B1B',
                          }}
                        >
                          {101 + i}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent bookings */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Recent Bookings</p>
                    <div className="space-y-2">
                      {[
                        { name: 'Dimitris P.', room: '201', in: 'Today', total: '€480', status: 'confirmed' },
                        { name: 'Sarah M.', room: '105', in: 'Tomorrow', total: '€720', status: 'pending' },
                      ].map((b) => (
                        <div key={b.name} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <div>
                            <p className="text-xs font-semibold text-gray-700">{b.name}</p>
                            <p className="text-xs text-gray-400">Room {b.room} · {b.in}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-gray-900">{b.total}</p>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{
                                background: b.status === 'confirmed' ? '#DCFCE7' : '#FEF9C3',
                                color: b.status === 'confirmed' ? '#166534' : '#854D0E',
                              }}
                            >
                              {b.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown size={24} className="text-white/40" />
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────────────────────────── */}
      <section className="py-16 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: `${NAVY}10` }}
                >
                  <s.icon size={20} style={{ color: NAVY }} />
                </div>
                <p className="text-3xl font-black" style={{ color: NAVY }}>{s.value}</p>
                <p className="text-sm text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────────────── */}
      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: GOLD }}
            >
              Everything you need
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mt-2 mb-4" style={{ color: NAVY }}>
              One platform. Zero chaos.
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              From the first booking to the last checkout, TownsHub handles every aspect of your hotel or property management business.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${f.color}15` }}
                >
                  <f.icon size={22} style={{ color: f.color }} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROPERTY MANAGEMENT FEATURE HIGHLIGHT ──────────────────────────── */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>
                For property managers
              </span>
              <h2 className="text-3xl sm:text-4xl font-black mt-2 mb-6" style={{ color: NAVY }}>
                Hotels & Villas.<br />One platform.
              </h2>
              <p className="text-gray-500 mb-8 leading-relaxed">
                TownsHub is the only PMS in Cyprus that handles both hotel reservations <em>and</em> long-term property management in a single login. Manage your apartments, villas, and rental units alongside your hotel — with separate owner portals, lease tracking and rent collection.
              </p>

              <ul className="space-y-4 mb-8">
                {[
                  { icon: Building2, text: 'Properties, units, owners and renters in one view' },
                  { icon: FileText, text: 'Digital leases with e-signature and automated renewals' },
                  { icon: CreditCard, text: 'Automated rent collection with Stripe' },
                  { icon: Award, text: 'Owner portal with financial statements and documents' },
                  { icon: Settings, text: 'Maintenance tracking and inspection reports' },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: `${NAVY}10` }}
                    >
                      <item.icon size={16} style={{ color: NAVY }} />
                    </div>
                    <span className="text-gray-600 text-sm leading-relaxed">{item.text}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={handleCta}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white text-sm transition-all hover:opacity-90"
                style={{ background: NAVY }}
              >
                Explore Property Module
                <ChevronRight size={16} />
              </button>
            </div>

            <div
              className="rounded-2xl p-8 text-white"
              style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1a3a58 100%)` }}
            >
              <h3 className="text-lg font-bold mb-6 text-white/80">Property at a glance</h3>

              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  { label: 'Properties', value: '12', icon: Building2 },
                  { label: 'Active leases', value: '38', icon: FileText },
                  { label: 'Rent collected MTD', value: '€18,400', icon: CreditCard },
                  { label: 'Maintenance open', value: '3', icon: Settings },
                ].map((item) => (
                  <div key={item.label} className="bg-white/10 rounded-xl p-4">
                    <item.icon size={16} className="text-white/50 mb-2" />
                    <p className="text-2xl font-black text-white">{item.value}</p>
                    <p className="text-xs text-white/50 mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">Upcoming renewals</p>
                {[
                  { unit: 'Apt 3B, Limassol Tower', tenant: 'George K.', date: '01 Jun' },
                  { unit: 'Villa 5, Ayia Napa Coast', tenant: 'Anna M.', date: '15 Jun' },
                ].map((r) => (
                  <div key={r.unit} className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-white">{r.unit}</p>
                      <p className="text-xs text-white/50">{r.tenant}</p>
                    </div>
                    <span
                      className="text-xs px-2 py-1 rounded-full font-semibold"
                      style={{ background: `${GOLD}30`, color: GOLD }}
                    >
                      {r.date}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── INTEGRATIONS ───────────────────────────────────────────────────── */}
      <section id="integrations" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>
            Integrations
          </span>
          <h2 className="text-3xl sm:text-4xl font-black mt-2 mb-4" style={{ color: NAVY }}>
            Connects with everything
          </h2>
          <p className="text-gray-500 mb-12 max-w-2xl mx-auto">
            SiteMinder channel manager keeps your availability synced across 50+ OTAs in real-time. No more manual extranet updates.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {INTEGRATIONS.map((name) => (
              <div
                key={name}
                className="px-5 py-2.5 rounded-full border border-gray-200 text-sm font-medium text-gray-700 bg-white shadow-sm hover:shadow transition-all"
              >
                {name}
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              {
                icon: Wifi,
                title: 'Real-time sync',
                desc: 'Availability and rates pushed to all channels the moment you make a change.',
              },
              {
                icon: Bell,
                title: 'Instant notifications',
                desc: 'Get push, email and WhatsApp alerts for new bookings from any channel.',
              },
              {
                icon: Globe2,
                title: '16 languages',
                desc: 'Staff interface available in English, Greek, Arabic, French, German and 11 more.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-gray-50 rounded-2xl p-6 text-left"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: `${NAVY}10` }}
                >
                  <item.icon size={18} style={{ color: NAVY }} />
                </div>
                <h4 className="font-bold text-gray-900 mb-1">{item.title}</h4>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ───────────────────────────────────────────────────── */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>
              Social proof
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mt-2" style={{ color: NAVY }}>
              Trusted by hospitality professionals
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <StarRating count={t.rating} />
                <p className="text-gray-600 text-sm leading-relaxed my-4 italic">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ background: NAVY }}
                  >
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>
              Simple pricing
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mt-2 mb-4" style={{ color: NAVY }}>
              Transparent. No surprises.
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              All plans include 14-day free trial. No credit card required to start.
              Annual billing saves 20%.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PRICING.map((plan) => (
              <PricingCard key={plan.tier} plan={plan} onCtaClick={handleCta} />
            ))}
          </div>

          <p className="text-center text-sm text-gray-400 mt-8">
            All prices exclude VAT. Cyprus VAT 19% applies where applicable.
          </p>
        </div>
      </section>

      {/* ── DEMO SECTION ───────────────────────────────────────────────────── */}
      <section id="demo" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="rounded-3xl overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1a3a58 100%)` }}
          >
            <div className="grid lg:grid-cols-2 gap-0">
              {/* Left — copy */}
              <div className="p-10 lg:p-14">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-6"
                  style={{ background: `${GOLD}25`, color: GOLD }}
                >
                  <Zap size={11} />
                  Try it now — free
                </span>

                <h2 className="text-3xl lg:text-4xl font-black text-white mb-4 leading-tight">
                  See TownsHub in<br />
                  <span style={{ color: GOLD }}>action instantly</span>
                </h2>

                <p className="text-white/70 mb-8 leading-relaxed">
                  Explore a fully pre-loaded demo hotel with real bookings, guests, invoices and reports. No sign-up required — just log in and explore.
                </p>

                <div
                  className="rounded-2xl p-5 mb-8"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">Demo credentials</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Email', value: 'demo@townshub.cy' },
                      { label: 'Password', value: 'Demo1234!' },
                    ].map((c) => (
                      <div key={c.label} className="flex items-center justify-between">
                        <span className="text-sm text-white/50">{c.label}</span>
                        <code
                          className="text-sm font-mono px-3 py-1 rounded-lg text-white"
                          style={{ background: 'rgba(255,255,255,0.1)' }}
                        >
                          {c.value}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/auth/login"
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90"
                    style={{ background: GOLD }}
                  >
                    Open demo
                    <ArrowRight size={15} />
                  </Link>
                  <button
                    onClick={handleCta}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white text-sm border border-white/20 hover:bg-white/10 transition-all"
                  >
                    Start my free trial
                  </button>
                </div>
              </div>

              {/* Right — feature list */}
              <div className="p-10 lg:p-14 lg:border-l border-white/10">
                <p className="text-white/60 text-sm uppercase tracking-wider font-semibold mb-6">
                  Demo hotel includes
                </p>
                <ul className="space-y-4">
                  {[
                    'Demo hotel "Limassol Grand" with 15 rooms',
                    '30+ pre-loaded bookings across all statuses',
                    '50 guest profiles with history',
                    'Invoices, payments and revenue data',
                    'Staff users: admin, manager, front desk, housekeeping',
                    'Reports & executive dashboard with real metrics',
                    'AI concierge and marketing hub',
                    'Channel manager demo mode',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm">
                      <Check size={16} className="shrink-0 mt-0.5" style={{ color: GOLD }} />
                      <span className="text-white/70">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── GDPR TRUST SECTION ─────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>
                GDPR & EU compliance
              </span>
              <h2 className="text-3xl sm:text-4xl font-black mt-2 mb-6" style={{ color: NAVY }}>
                Built for European privacy law
              </h2>
              <p className="text-gray-500 mb-8 leading-relaxed">
                TownsHub was designed from the ground up for the EU market. Every feature respects GDPR, NIS2 and Cyprus data protection law — so you can focus on hospitality, not compliance paperwork.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { icon: Shield, title: 'Cookie consent', desc: 'GDPR-compliant banner with granular controls' },
                  { icon: FileText, title: 'Data export (Art. 20)', desc: 'One-click guest data portability' },
                  { icon: Lock, title: 'Right to be Forgotten', desc: 'Art. 17 anonymisation with audit trail' },
                  { icon: HeartHandshake, title: 'Marketing consent', desc: 'Double opt-in with timestamped records' },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3 p-4 rounded-xl bg-gray-50">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${NAVY}10` }}
                    >
                      <item.icon size={16} style={{ color: NAVY }} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div
                className="rounded-2xl p-6 border"
                style={{ borderColor: '#10B981', background: '#F0FDF4' }}
              >
                <div className="flex items-start gap-3">
                  <Shield size={20} className="text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-green-800 mb-1">Data hosted in the EU</h4>
                    <p className="text-sm text-green-700">
                      All guest data is stored on Supabase EU-West infrastructure in Frankfurt, Germany — never leaves the European Economic Area.
                    </p>
                  </div>
                </div>
              </div>

              <div
                className="rounded-2xl p-6 border"
                style={{ borderColor: '#3B82F6', background: '#EFF6FF' }}
              >
                <div className="flex items-start gap-3">
                  <Lock size={20} className="text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-blue-800 mb-1">TLS 1.3 + Row-Level Security</h4>
                    <p className="text-sm text-blue-700">
                      All API calls use TLS 1.3. Supabase RLS ensures your data is isolated from other tenants at the database level.
                    </p>
                  </div>
                </div>
              </div>

              <div
                className="rounded-2xl p-6 border"
                style={{ borderColor: GOLD, background: `#FFFBEB` }}
              >
                <div className="flex items-start gap-3">
                  <FileText size={20} style={{ color: '#92400E' }} className="shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold" style={{ color: '#78350F' }}>7-year financial record retention</h4>
                    <p className="text-sm" style={{ color: '#92400E' }}>
                      Financial records (invoices, payments) are retained for 7 years per EU tax law. Personal data is anonymised upon GDPR deletion requests.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ─────────────────────────────────────────────────────── */}
      <section className="py-20" style={{ background: GOLD }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            Ready to transform your hotel?
          </h2>
          <p className="text-white/80 text-lg mb-8">
            Join hotels across Cyprus and Europe. Start your free 14-day trial today — no credit card required.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={handleCta}
              className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-base bg-white transition-all hover:opacity-90 active:scale-95 shadow-lg"
              style={{ color: NAVY }}
            >
              Start free trial
              <ArrowRight size={18} />
            </button>
            <Link
              to="/auth/login"
              className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-base border-2 border-white/40 text-white hover:bg-white/10 transition-all"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer style={{ background: NAVY }} className="pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
            {/* Brand */}
            <div className="lg:col-span-2">
              <div className="mb-4">
                <div className="bg-white rounded-xl px-2.5 py-1 inline-block shadow-sm">
                  <img
                    src="/logo.jpeg"
                    alt="TownsHub Limited"
                    className="h-10 object-contain"
                  />
                </div>
              </div>
              <p className="text-white/50 text-sm leading-relaxed mb-4 max-w-xs">
                The complete hotel and property management platform, built for European hospitality.
              </p>
              <div className="space-y-1.5 text-sm text-white/40">
                <div className="flex items-center gap-2">
                  <MapPin size={13} />
                  <span>TownsHub LLC, Limassol, Cyprus</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={13} />
                  <a href="mailto:hello@townshub.cy" className="hover:text-white/70 transition-colors">hello@townshub.cy</a>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={13} />
                  <a href="mailto:privacy@townshub.cy" className="hover:text-white/70 transition-colors">privacy@townshub.cy</a>
                </div>
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">Product</h4>
              <ul className="space-y-2.5">
                {['Features', 'Pricing', 'Integrations', 'Changelog'].map((link) => (
                  <li key={link}>
                    <a
                      href={`#${link.toLowerCase()}`}
                      className="text-sm text-white/50 hover:text-white/80 transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">Company</h4>
              <ul className="space-y-2.5">
                {[
                  { label: 'About', href: '#about' },
                  { label: 'Blog', href: '#blog' },
                  { label: 'Careers', href: '#careers' },
                  { label: 'Contact', href: 'mailto:hello@townshub.cy' },
                ].map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-white/50 hover:text-white/80 transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">Legal</h4>
              <ul className="space-y-2.5">
                {[
                  { label: 'Privacy Policy', to: '/privacy' as string | undefined, href: undefined as string | undefined },
                  { label: 'Terms of Service', to: undefined, href: '#terms' },
                  { label: 'Cookie Policy', to: undefined, href: '#cookies' },
                  { label: 'GDPR & DPA', to: undefined, href: '#gdpr' },
                ].map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link
                        to={link.to}
                        className="text-sm text-white/50 hover:text-white/80 transition-colors"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href ?? '#'}
                        className="text-sm text-white/50 hover:text-white/80 transition-colors"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-white/30">
              © {new Date().getFullYear()} TownsHub LLC. All rights reserved. Registered in Cyprus.
            </p>
            <div className="flex items-center gap-2">
              <span
                className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ background: `${GOLD}20`, color: GOLD }}
              >
                🇪🇺 GDPR Compliant
              </span>
              <span
                className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ background: 'rgba(59,130,246,0.15)', color: '#93C5FD' }}
              >
                🇨🇾 Made in Cyprus
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
