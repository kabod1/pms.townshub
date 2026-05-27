/**
 * Stripe API handler
 *
 * POST /api/stripe?action=checkout  — Create Stripe Checkout session for subscription upgrade
 * POST /api/stripe?action=portal    — Create Stripe Customer Portal session
 * POST /api/stripe?action=webhook   — Handle Stripe webhook events (raw body required)
 *
 * Required environment variables:
 *   STRIPE_SECRET_KEY         — Stripe secret key (sk_live_... or sk_test_...)
 *   STRIPE_WEBHOOK_SECRET     — Webhook signing secret (whsec_...)
 *   STRIPE_PRICE_ESSENTIAL    — Stripe Price ID for the Essential plan
 *   STRIPE_PRICE_PROFESSIONAL — Stripe Price ID for the Professional plan
 *   STRIPE_PRICE_ENTERPRISE   — Stripe Price ID for the Enterprise plan
 *   SUPABASE_URL / VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import {
  setCorsHeaders,
  handlePreflight,
  getServiceClient,
  verifyTenantToken,
  rateLimit,
  getClientIp,
} from './_lib/security.js'

// ── helpers ──────────────────────────────────────────────────────────────────

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key, { apiVersion: '2024-06-20', typescript: true })
}

const PRICE_MAP: Record<string, string | undefined> = {
  essential:    process.env.STRIPE_PRICE_ESSENTIAL,
  professional: process.env.STRIPE_PRICE_PROFESSIONAL,
  enterprise:   process.env.STRIPE_PRICE_ENTERPRISE,
}

// Map Stripe subscription status → our internal status
function mapStripeStatus(
  status: Stripe.Subscription.Status
): 'trialing' | 'active' | 'past_due' | 'cancelled' | 'unpaid' {
  switch (status) {
    case 'trialing':  return 'trialing'
    case 'active':    return 'active'
    case 'past_due':  return 'past_due'
    case 'canceled':  return 'cancelled'
    case 'unpaid':    return 'unpaid'
    default:          return 'cancelled'
  }
}

// Infer tier from Stripe subscription items based on price IDs
function tierFromSubscription(subscription: Stripe.Subscription): string | null {
  const priceId = subscription.items.data[0]?.price.id
  if (!priceId) return null
  for (const [tier, pid] of Object.entries(PRICE_MAP)) {
    if (pid && pid === priceId) return tier
  }
  return null
}

// ── main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res)
  if (handlePreflight(req, res)) return

  const action = req.query.action as string | undefined

  // Webhook does NOT need auth — it uses signature verification instead
  if (action === 'webhook') {
    return handleWebhook(req, res)
  }

  // All other actions require POST + auth
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Rate limit: 20 billing requests per minute per IP
  const ip = getClientIp(req)
  const rl = rateLimit(`stripe:${ip}`, 20, 60_000)
  if (!rl.allowed) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  // Verify the caller is an authenticated tenant member
  const db = getServiceClient()
  const { tenantId } = await verifyTenantToken(req, db)
  if (!tenantId) {
    return res.status(401).json({ error: 'Unauthorised' })
  }

  switch (action) {
    case 'checkout': return handleCheckout(req, res, db, tenantId)
    case 'portal':   return handlePortal(req, res, db, tenantId)
    default:
      return res.status(400).json({ error: 'Unknown action. Use ?action=checkout|portal|webhook' })
  }
}

// ── checkout ─────────────────────────────────────────────────────────────────

async function handleCheckout(req: any, res: any, db: ReturnType<typeof getServiceClient>, tenantId: string) {
  const { tier } = req.body ?? {}

  if (!tier || !['essential', 'professional', 'enterprise'].includes(tier)) {
    return res.status(400).json({ error: 'tier must be essential | professional | enterprise' })
  }

  const priceId = PRICE_MAP[tier]
  if (!priceId) {
    return res.status(500).json({
      error: `STRIPE_PRICE_${tier.toUpperCase()} is not configured. Add it to your environment variables.`,
    })
  }

  // Load tenant to get/create Stripe customer
  const { data: tenant, error: tenantErr } = await db
    .from('tenants')
    .select('id, name, email, stripe_customer_id')
    .eq('id', tenantId)
    .single()

  if (tenantErr || !tenant) {
    return res.status(404).json({ error: 'Tenant not found' })
  }

  const stripe = getStripe()

  // Create Stripe customer if not already linked
  let customerId = tenant.stripe_customer_id as string | null

  if (!customerId) {
    const customer = await stripe.customers.create({
      name:     tenant.name,
      email:    tenant.email ?? undefined,
      metadata: { tenant_id: tenantId },
    })
    customerId = customer.id

    // Persist the new customer ID immediately
    await db
      .from('tenants')
      .update({ stripe_customer_id: customerId })
      .eq('id', tenantId)
  }

  const origin = req.headers.origin ?? 'https://pms.townshub.com'

  const session = await stripe.checkout.sessions.create({
    customer:   customerId,
    mode:       'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/settings/billing?success=1`,
    cancel_url:  `${origin}/settings/billing`,
    metadata: {
      tenant_id: tenantId,
      tier,
    },
    subscription_data: {
      metadata: { tenant_id: tenantId, tier },
    },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
  })

  return res.json({ url: session.url })
}

// ── portal ───────────────────────────────────────────────────────────────────

async function handlePortal(req: any, res: any, db: ReturnType<typeof getServiceClient>, tenantId: string) {
  const { data: tenant, error: tenantErr } = await db
    .from('tenants')
    .select('id, stripe_customer_id')
    .eq('id', tenantId)
    .single()

  if (tenantErr || !tenant) {
    return res.status(404).json({ error: 'Tenant not found' })
  }

  if (!tenant.stripe_customer_id) {
    return res.status(400).json({
      error: 'No Stripe customer linked to this account. Complete a checkout first.',
    })
  }

  const stripe = getStripe()
  const origin = req.headers.origin ?? 'https://pms.townshub.com'

  const portalSession = await stripe.billingPortal.sessions.create({
    customer:   tenant.stripe_customer_id,
    return_url: `${origin}/settings/billing`,
  })

  return res.json({ url: portalSession.url })
}

// ── webhook ───────────────────────────────────────────────────────────────────

async function handleWebhook(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET not set')
    return res.status(500).json({ error: 'Webhook secret not configured' })
  }

  const stripe = getStripe()

  // Vercel provides the raw body on req.rawBody for webhook verification
  // If not available, fall back to JSON body (works in test/dev)
  const sig = req.headers['stripe-signature'] as string

  let event: Stripe.Event

  try {
    const rawBody: string | Buffer =
      req.rawBody ?? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (err: any) {
    console.error('[stripe/webhook] Signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook signature error: ${err.message}` })
  }

  const db = getServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(db, session)
        break
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(db, subscription)
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(db, subscription)
        break
      }
      default:
        // Unhandled event — still return 200 so Stripe doesn't retry
        break
    }
  } catch (err: any) {
    console.error(`[stripe/webhook] Error processing ${event.type}:`, err)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }

  return res.json({ received: true })
}

async function handleCheckoutCompleted(
  db: ReturnType<typeof getServiceClient>,
  session: Stripe.Checkout.Session
) {
  const tenantId = session.metadata?.tenant_id
  const tier     = session.metadata?.tier as string | undefined

  if (!tenantId || !tier) {
    console.warn('[stripe/webhook] checkout.session.completed missing metadata', session.id)
    return
  }

  const updates: Record<string, unknown> = {
    subscription_tier:   tier,
    subscription_status: 'active',
  }

  if (session.customer) {
    updates.stripe_customer_id = session.customer as string
  }
  if (session.subscription) {
    updates.stripe_subscription_id = session.subscription as string
  }

  const { error } = await db
    .from('tenants')
    .update(updates)
    .eq('id', tenantId)

  if (error) {
    console.error('[stripe/webhook] Failed to update tenant on checkout.session.completed:', error)
    throw error
  }

  console.log(`[stripe/webhook] Tenant ${tenantId} upgraded to ${tier}`)
}

async function handleSubscriptionUpdated(
  db: ReturnType<typeof getServiceClient>,
  subscription: Stripe.Subscription
) {
  const tenantId = subscription.metadata?.tenant_id

  // If we don't have metadata, look up tenant by stripe_customer_id
  let tid = tenantId
  if (!tid) {
    const { data } = await db
      .from('tenants')
      .select('id')
      .eq('stripe_customer_id', subscription.customer as string)
      .single()
    tid = data?.id
  }

  if (!tid) {
    console.warn('[stripe/webhook] subscription.updated — cannot find tenant for customer', subscription.customer)
    return
  }

  const newTier   = tierFromSubscription(subscription)
  const newStatus = mapStripeStatus(subscription.status)

  const updates: Record<string, unknown> = {
    subscription_status:    newStatus,
    stripe_subscription_id: subscription.id,
  }
  if (newTier) updates.subscription_tier = newTier

  const { error } = await db.from('tenants').update(updates).eq('id', tid)
  if (error) {
    console.error('[stripe/webhook] Failed to update tenant on subscription.updated:', error)
    throw error
  }

  console.log(`[stripe/webhook] Tenant ${tid} subscription updated: ${newTier} / ${newStatus}`)
}

async function handleSubscriptionDeleted(
  db: ReturnType<typeof getServiceClient>,
  subscription: Stripe.Subscription
) {
  let tid = subscription.metadata?.tenant_id
  if (!tid) {
    const { data } = await db
      .from('tenants')
      .select('id')
      .eq('stripe_customer_id', subscription.customer as string)
      .single()
    tid = data?.id
  }

  if (!tid) {
    console.warn('[stripe/webhook] subscription.deleted — cannot find tenant for customer', subscription.customer)
    return
  }

  const { error } = await db
    .from('tenants')
    .update({ subscription_status: 'cancelled', stripe_subscription_id: null })
    .eq('id', tid)

  if (error) {
    console.error('[stripe/webhook] Failed to update tenant on subscription.deleted:', error)
    throw error
  }

  console.log(`[stripe/webhook] Tenant ${tid} subscription cancelled`)
}
