import { useState, useEffect } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/store/authStore'
import { formatDate } from '@/lib/utils'
import { SUBSCRIPTION_TIER_LABELS, SUBSCRIPTION_PRICES } from '@/lib/constants'
import { createCheckoutSession, openBillingPortal } from '@/lib/integrations/stripe'
import { CreditCard, Shield, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { SubscriptionTier } from '@/types'
import toast from 'react-hot-toast'
import { differenceInDays, parseISO } from 'date-fns'

const TIER_FEATURES: Record<SubscriptionTier, string[]> = {
  essential: ['Up to 20 rooms', 'Bookings & Guests', 'Invoicing', 'Housekeeping', 'Basic Reports'],
  professional: [
    'Up to 75 rooms', 'All Essential features',
    'QR F&B Module', 'Guest Communications',
    'Advanced Analytics', 'Multi-currency',
  ],
  enterprise: [
    'Unlimited rooms', 'All Professional features',
    'OTA Channel Manager', 'API Access',
    'Priority Support', 'Custom Integrations',
  ],
}

const SETTINGS_NAV = [
  { to: '/settings', label: 'Hotel' },
  { to: '/settings/users', label: 'Users' },
  { to: '/settings/billing', label: 'Billing' },
  { to: '/settings/packages', label: 'Packages' },
  { to: '/settings/promotions', label: 'Promotions' },
  { to: '/settings/vouchers', label: 'Vouchers' },
  { to: '/settings/channels', label: 'Channels' },
]

const STATUS_STYLES: Record<string, string> = {
  active:    'bg-green-100 text-green-700',
  trialing:  'bg-amber-100 text-amber-700',
  past_due:  'bg-red-100 text-red-700',
  unpaid:    'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
}

export default function BillingSettings() {
  const { tenant } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const tier   = tenant?.subscription_tier
  const status = tenant?.subscription_status

  const [upgrading,    setUpgrading]    = useState<SubscriptionTier | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  const stripeConfigured = !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

  // Show success toast when returning from Stripe Checkout
  useEffect(() => {
    if (searchParams.get('success') === '1') {
      toast.success('Subscription updated — welcome aboard!')
      // Remove the query param without a re-render loop
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('success')
        return next
      }, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Trial countdown
  const trialDaysLeft = (() => {
    if (status !== 'trialing' || !tenant?.trial_ends_at) return null
    const days = differenceInDays(parseISO(tenant.trial_ends_at), new Date())
    return Math.max(0, days)
  })()

  async function handleUpgrade(newTier: SubscriptionTier) {
    if (!tenant) return
    setUpgrading(newTier)
    try {
      const session = await createCheckoutSession({ tenantId: tenant.id, tier: newTier })
      if (session?.url) {
        window.location.href = session.url
      } else {
        toast.error('Stripe not configured — add VITE_STRIPE_PUBLISHABLE_KEY to your environment')
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not start checkout session')
    } finally {
      setUpgrading(null)
    }
  }

  async function handlePortal() {
    if (!tenant) return
    setPortalLoading(true)
    try {
      const result = await openBillingPortal({ tenantId: tenant.id })
      if (result?.url) {
        window.location.href = result.url
      } else {
        toast.error('Stripe not configured — add VITE_STRIPE_PUBLISHABLE_KEY to your environment')
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not open billing portal')
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-body">Settings</h1>

        <div className="flex gap-1 border-b border-mid overflow-x-auto">
          {SETTINGS_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive ? 'border-gold text-gold' : 'border-transparent text-subtext hover:text-body'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="max-w-3xl space-y-5">

          {/* Stripe not configured notice */}
          {!stripeConfigured && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">Stripe integration pending</p>
                <p className="text-amber-700 mt-0.5">
                  Add <code className="bg-amber-100 px-1 rounded">VITE_STRIPE_PUBLISHABLE_KEY</code> to your environment to enable payments.
                  See <code className="bg-amber-100 px-1 rounded">src/lib/stripe-setup.md</code> for setup instructions.
                </p>
              </div>
            </div>
          )}

          {/* Trial countdown banner */}
          {status === 'trialing' && trialDaysLeft !== null && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">
                  {trialDaysLeft === 0
                    ? 'Your trial expires today'
                    : `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left in your trial`}
                </p>
                <p className="text-amber-700 mt-0.5">
                  Choose a plan below to keep access to all features after your trial ends.
                </p>
              </div>
            </div>
          )}

          {/* Past due / cancelled warning */}
          {(status === 'past_due' || status === 'cancelled') && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-red-800">
                  {status === 'past_due' ? 'Payment overdue' : 'Subscription cancelled'}
                </p>
                <p className="text-red-700 mt-0.5">
                  {status === 'past_due'
                    ? 'Please update your payment method via the billing portal to restore full access.'
                    : 'Your subscription has been cancelled. Select a plan below to resubscribe.'}
                </p>
              </div>
            </div>
          )}

          {/* Active subscription success state */}
          {status === 'active' && tenant?.stripe_subscription_id && (
            <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <CheckCircle2 size={16} className="text-green-600 shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">
                Your subscription is active. Manage payment details via the billing portal below.
              </p>
            </div>
          )}

          {/* Current plan */}
          <Card>
            <h2 className="text-sm font-semibold text-body mb-3">Current Plan</h2>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge
                label={tier ? SUBSCRIPTION_TIER_LABELS[tier] : 'No plan'}
                className="bg-navy text-white text-sm px-3 py-1"
              />
              {status && (
                <Badge
                  label={status}
                  className={STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'}
                />
              )}
              {status === 'trialing' && tenant?.trial_ends_at && (
                <span className="text-sm text-subtext">
                  Trial ends: {formatDate(tenant.trial_ends_at)}
                </span>
              )}
            </div>

            {/* Stripe IDs (readonly info) */}
            {tenant?.stripe_customer_id && (
              <div className="mt-3 grid gap-1">
                <p className="text-xs text-subtext">
                  Customer: <code className="font-mono">{tenant.stripe_customer_id}</code>
                </p>
                {tenant.stripe_subscription_id && (
                  <p className="text-xs text-subtext">
                    Subscription: <code className="font-mono">{tenant.stripe_subscription_id}</code>
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Plan comparison */}
          <div className="grid gap-4 md:grid-cols-3">
            {(['essential', 'professional', 'enterprise'] as SubscriptionTier[]).map((t) => (
              <div
                key={t}
                className={`rounded-xl p-5 ring-2 ${
                  tier === t ? 'ring-gold bg-gold/5' : 'ring-mid bg-white'
                }`}
              >
                <p className="text-sm font-semibold text-body capitalize">{SUBSCRIPTION_TIER_LABELS[t]}</p>
                <p className="text-2xl font-bold text-navy mt-1">
                  €{SUBSCRIPTION_PRICES[t]}
                  <span className="text-sm font-normal text-subtext">/mo</span>
                </p>
                <ul className="mt-3 space-y-1">
                  {TIER_FEATURES[t].map((f) => (
                    <li key={f} className="text-xs text-subtext flex gap-1.5">
                      <span className="text-green-600">✓</span> {f}
                    </li>
                  ))}
                </ul>
                {tier !== t && (
                  <Button
                    size="sm"
                    variant={SUBSCRIPTION_PRICES[t] > (tier ? SUBSCRIPTION_PRICES[tier] : 0) ? 'primary' : 'outline'}
                    fullWidth
                    className="mt-4"
                    loading={upgrading === t}
                    onClick={() => handleUpgrade(t)}
                    disabled={!stripeConfigured}
                  >
                    {tier && SUBSCRIPTION_PRICES[t] > SUBSCRIPTION_PRICES[tier] ? 'Upgrade' : 'Switch'}
                  </Button>
                )}
                {tier === t && (
                  <p className="mt-4 text-xs font-medium text-gold text-center">Current plan</p>
                )}
              </div>
            ))}
          </div>

          {/* Manage subscription */}
          <Card>
            <div className="flex items-start gap-3">
              <CreditCard size={18} className="text-subtext shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-body mb-1">Manage Subscription</h2>
                <p className="text-sm text-subtext mb-4">
                  Update your payment method, download past invoices, or cancel via the Stripe billing portal.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  loading={portalLoading}
                  onClick={handlePortal}
                  disabled={!stripeConfigured || !tenant?.stripe_customer_id}
                >
                  <ExternalLink size={14} /> Open Billing Portal
                </Button>
                {!tenant?.stripe_customer_id && stripeConfigured && (
                  <p className="text-xs text-subtext mt-2">
                    Complete a checkout first to access the billing portal.
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Security note */}
          <div className="flex items-start gap-2 text-xs text-subtext">
            <Shield size={14} className="shrink-0 mt-0.5 text-green-600" />
            <p>
              All payments are processed securely by Stripe. TownsHub never stores your card details.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
