import { NavLink } from 'react-router-dom'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/store/authStore'
import { formatDate } from '@/lib/utils'
import { SUBSCRIPTION_TIER_LABELS, SUBSCRIPTION_PRICES } from '@/lib/constants'
import type { SubscriptionTier } from '@/types'

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

export default function BillingSettings() {
  const { tenant } = useAuthStore()
  const tier = tenant?.subscription_tier
  const status = tenant?.subscription_status

const SETTINGS_NAV = [
  { to: '/settings', label: 'Hotel' },
  { to: '/settings/users', label: 'Users' },
  { to: '/settings/billing', label: 'Billing' },
  { to: '/settings/packages', label: 'Packages' },
  { to: '/settings/promotions', label: 'Promotions' },
  { to: '/settings/vouchers', label: 'Vouchers' },
]

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

        {/* Current plan */}
        <Card>
          <h2 className="text-sm font-semibold text-body mb-3">Current Plan</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge
              label={tier ? SUBSCRIPTION_TIER_LABELS[tier] : 'No plan'}
              className="bg-navy text-white text-sm px-3 py-1"
            />
            <Badge
              label={status ?? 'unknown'}
              className={
                status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : status === 'trialing'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
              }
            />
            {status === 'trialing' && tenant?.trial_ends_at && (
              <span className="text-sm text-subtext">
                Trial ends: {formatDate(tenant.trial_ends_at)}
              </span>
            )}
          </div>
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
              <p className="text-2xl font-bold text-navy mt-1">€{SUBSCRIPTION_PRICES[t]}<span className="text-sm font-normal text-subtext">/mo</span></p>
              <ul className="mt-3 space-y-1">
                {TIER_FEATURES[t].map((f) => (
                  <li key={f} className="text-xs text-subtext flex gap-1.5">
                    <span className="text-green-600">✓</span> {f}
                  </li>
                ))}
              </ul>
              {tier !== t && (
                <Button size="sm" variant="outline" fullWidth className="mt-4">
                  {tier && SUBSCRIPTION_PRICES[t] > SUBSCRIPTION_PRICES[tier] ? 'Upgrade' : 'Switch'}
                </Button>
              )}
              {tier === t && (
                <p className="mt-4 text-xs font-medium text-gold text-center">Current plan</p>
              )}
            </div>
          ))}
        </div>

        <Card>
          <h2 className="text-sm font-semibold text-body mb-2">Manage Subscription</h2>
          <p className="text-sm text-subtext mb-4">
            Manage your payment method, download invoices, or cancel via the billing portal.
          </p>
          <Button variant="outline" size="sm">Open Billing Portal</Button>
        </Card>
      </div>
      </div>
    </DashboardLayout>
  )
}
