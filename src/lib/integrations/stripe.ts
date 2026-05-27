/**
 * Stripe client-side integration
 *
 * Required environment variables (Vite / frontend):
 *   VITE_STRIPE_PUBLISHABLE_KEY   — Stripe publishable key (pk_live_... or pk_test_...)
 *
 * Server-side price IDs are stored in env vars read by api/stripe.ts:
 *   STRIPE_PRICE_ESSENTIAL, STRIPE_PRICE_PROFESSIONAL, STRIPE_PRICE_ENTERPRISE
 *
 * See src/lib/stripe-setup.md for instructions on creating Stripe products/prices.
 */

export const STRIPE_CONFIG = {
  publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '',
} as const

export type StripeTier = 'essential' | 'professional' | 'enterprise'

/**
 * Load Stripe.js on demand (already installed: @stripe/stripe-js ^4.0.0)
 * Usage: const stripe = await loadStripeInstance()
 */
export async function loadStripeInstance() {
  const { loadStripe } = await import('@stripe/stripe-js')
  if (!STRIPE_CONFIG.publishableKey) {
    console.warn('[Stripe] Publishable key not set — running in stub mode')
    return null
  }
  return loadStripe(STRIPE_CONFIG.publishableKey)
}

/**
 * Create a Stripe Checkout session.
 * Calls POST /api/stripe?action=checkout with the Bearer token from localStorage.
 * Returns { url } to redirect to Stripe-hosted checkout.
 */
export async function createCheckoutSession(params: {
  tenantId: string
  tier: StripeTier
}): Promise<{ url: string } | null> {
  const token = getAuthToken()
  if (!token) {
    console.warn('[Stripe] No auth token available')
    return null
  }

  const res = await fetch('/api/stripe?action=checkout', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ tenantId: params.tenantId, tier: params.tier }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Checkout failed (${res.status})`)
  }

  return res.json()
}

/**
 * Open the Stripe Customer Portal.
 * Calls POST /api/stripe?action=portal with the Bearer token from localStorage.
 * Returns { url } to redirect to the Stripe-hosted portal.
 */
export async function openBillingPortal(params: {
  tenantId: string
}): Promise<{ url: string } | null> {
  const token = getAuthToken()
  if (!token) {
    console.warn('[Stripe] No auth token available')
    return null
  }

  const res = await fetch('/api/stripe?action=portal', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ tenantId: params.tenantId }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Portal failed (${res.status})`)
  }

  return res.json()
}

// ── internal ──────────────────────────────────────────────────────────────────

/** Read the Supabase session token from localStorage (set by @supabase/supabase-js) */
function getAuthToken(): string | null {
  try {
    // Supabase stores the session under keys like `sb-<project>-auth-token`
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const parsed = JSON.parse(raw)
        return parsed?.access_token ?? null
      }
    }
  } catch {
    // localStorage not available (SSR / incognito edge case)
  }
  return null
}

/**
 * Stripe webhook events handled by api/stripe.ts
 */
export const STRIPE_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
] as const
