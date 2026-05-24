/**
 * Stripe Integration Stub
 * TODO: Fill in with real credentials before deploying.
 *
 * Required env vars:
 *   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
 *   STRIPE_SECRET_KEY=sk_live_...          (server-side only)
 *   STRIPE_WEBHOOK_SECRET=whsec_...        (server-side only)
 */

export const STRIPE_CONFIG = {
  publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '',
  // Pricing: map subscription tiers to Stripe Price IDs
  prices: {
    essential: import.meta.env.VITE_STRIPE_PRICE_ESSENTIAL ?? 'price_REPLACE_ESSENTIAL',
    professional: import.meta.env.VITE_STRIPE_PRICE_PROFESSIONAL ?? 'price_REPLACE_PROFESSIONAL',
    enterprise: import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE ?? 'price_REPLACE_ENTERPRISE',
  },
} as const

export type StripeTier = keyof typeof STRIPE_CONFIG.prices

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
 * Create a Stripe Checkout session via the server API.
 * Server endpoint: POST /api/stripe/create-checkout
 */
export async function createCheckoutSession(_params: {
  tenantId: string
  tier: StripeTier
  email: string
  successUrl?: string
  cancelUrl?: string
}): Promise<{ url: string } | null> {
  // TODO: Implement /api/stripe/create-checkout serverless function
  console.warn('[Stripe] createCheckoutSession stub called — wire up /api/stripe/create-checkout')
  return null
}

/**
 * Open the Stripe Customer Portal.
 * Server endpoint: POST /api/stripe/portal
 */
export async function openBillingPortal(_params: {
  tenantId: string
  returnUrl?: string
}): Promise<{ url: string } | null> {
  // TODO: Implement /api/stripe/portal serverless function
  console.warn('[Stripe] openBillingPortal stub called — wire up /api/stripe/portal')
  return null
}

/**
 * Server-side: verify Stripe webhook signature.
 * TODO: Implement in api/stripe/webhook.ts
 * Events to handle: checkout.session.completed, customer.subscription.updated,
 *                   customer.subscription.deleted, invoice.payment_failed
 */
export const STRIPE_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
] as const
