/**
 * Stripe API handler
 *
 * ── Platform billing (TownsHub subscriptions) ────────────────────────────────
 * POST /api/stripe?action=checkout       — Create Checkout session for plan upgrade
 * POST /api/stripe?action=portal         — Create Stripe Customer Portal session
 * POST /api/stripe?action=webhook        — Handle Stripe webhook events (raw body)
 *
 * ── Guest / tenant payments (per-hotel Stripe keys) ──────────────────────────
 * POST /api/stripe?action=invoice-checkout  — Create Checkout for a hotel invoice
 * POST /api/stripe?action=rent-checkout     — Create Checkout for a rent schedule item
 * GET  /api/stripe?action=confirm-payment   — Verify session + record payment (success redirect)
 *
 * Required env vars for guest/tenant payments (set per-hotel in Settings → Payments):
 *   Stored on tenants.stripe_payment_sk  (hotel's own Stripe secret key)
 *   Stored on tenants.stripe_payment_pk  (hotel's own Stripe publishable key)
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

// ── Guest invoice checkout ────────────────────────────────────────────────────

async function handleInvoiceCheckout(req: any, res: any, db: ReturnType<typeof getServiceClient>, tenantId: string) {
  const { invoiceId } = req.body ?? {}
  if (!invoiceId) return res.status(400).json({ error: 'invoiceId is required' })

  // Load invoice + booking + guest
  const { data: inv, error: invErr } = await db
    .from('invoices')
    .select('id, invoice_number, total, status, stripe_session_id, stripe_payment_url, booking:bookings(guest:guests(first_name, last_name, email))')
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .single()
  if (invErr || !inv) return res.status(404).json({ error: 'Invoice not found' })
  if (inv.status === 'paid') return res.status(400).json({ error: 'Invoice is already paid' })

  // If a valid session URL already exists, return it
  if (inv.stripe_payment_url && inv.stripe_session_id) {
    return res.json({ url: inv.stripe_payment_url, cached: true })
  }

  // Load tenant's own Stripe secret key
  const { data: tenant, error: tErr } = await db
    .from('tenants')
    .select('name, stripe_payment_sk')
    .eq('id', tenantId)
    .single()
  if (tErr || !tenant) return res.status(404).json({ error: 'Tenant not found' })
  if (!tenant.stripe_payment_sk) {
    return res.status(400).json({
      error: 'Stripe payment keys not configured. Go to Settings → Payments to add your Stripe keys.',
    })
  }

  const stripe = new (await import('stripe')).default(tenant.stripe_payment_sk, {
    apiVersion: '2024-06-20',
    typescript: true,
  })

  const guest = (inv as any).booking?.guest
  const guestEmail = guest?.email ?? undefined
  const origin = req.headers.origin ?? 'https://pms.townshub.com'
  const successUrl = `${origin}/payment/success?type=invoice&ref=${invoiceId}&session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl  = `${origin}/payment/cancelled`

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: guestEmail,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: Math.round((inv as any).total * 100),
        product_data: {
          name: `Invoice ${(inv as any).invoice_number}`,
          description: `Payment for ${tenant.name}`,
        },
      },
    }],
    success_url: successUrl,
    cancel_url:  cancelUrl,
    metadata: { invoice_id: invoiceId, tenant_id: tenantId, type: 'invoice' },
  })

  // Cache the URL on the invoice row
  await db.from('invoices').update({
    stripe_session_id:  session.id,
    stripe_payment_url: session.url,
  }).eq('id', invoiceId)

  return res.json({ url: session.url })
}

// ── Rent schedule checkout ────────────────────────────────────────────────────

async function handleRentCheckout(req: any, res: any, db: ReturnType<typeof getServiceClient>, tenantId: string) {
  const { rentScheduleId } = req.body ?? {}
  if (!rentScheduleId) return res.status(400).json({ error: 'rentScheduleId is required' })

  const { data: row, error: rowErr } = await db
    .from('rent_schedule')
    .select('id, amount, balance, status, stripe_session_id, stripe_payment_url, lease:leases(property_tenant:property_tenants(first_name, last_name, email), unit:units(unit_number))')
    .eq('id', rentScheduleId)
    .eq('tenant_id', tenantId)
    .single()
  if (rowErr || !row) return res.status(404).json({ error: 'Rent schedule item not found' })
  if ((row as any).status === 'paid') return res.status(400).json({ error: 'This rent is already paid' })

  if ((row as any).stripe_payment_url && (row as any).stripe_session_id) {
    return res.json({ url: (row as any).stripe_payment_url, cached: true })
  }

  const { data: tenant, error: tErr } = await db
    .from('tenants')
    .select('name, stripe_payment_sk')
    .eq('id', tenantId)
    .single()
  if (tErr || !tenant) return res.status(404).json({ error: 'Tenant not found' })
  if (!tenant.stripe_payment_sk) {
    return res.status(400).json({
      error: 'Stripe payment keys not configured. Go to Settings → Payments to add your Stripe keys.',
    })
  }

  const stripe = new (await import('stripe')).default(tenant.stripe_payment_sk, {
    apiVersion: '2024-06-20',
    typescript: true,
  })

  const lease = (row as any).lease
  const renter = lease?.property_tenant
  const unitNumber = lease?.unit?.unit_number ?? 'Unit'
  const amountDue = (row as any).balance ?? (row as any).amount
  const origin = req.headers.origin ?? 'https://pms.townshub.com'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: renter?.email ?? undefined,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: Math.round(amountDue * 100),
        product_data: {
          name: `Rent — ${unitNumber}`,
          description: `Rent payment for ${tenant.name}`,
        },
      },
    }],
    success_url: `${origin}/payment/success?type=rent&ref=${rentScheduleId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${origin}/payment/cancelled`,
    metadata: { rent_schedule_id: rentScheduleId, tenant_id: tenantId, type: 'rent' },
  })

  await db.from('rent_schedule').update({
    stripe_session_id:  session.id,
    stripe_payment_url: session.url,
  }).eq('id', rentScheduleId)

  return res.json({ url: session.url })
}

// ── Confirm payment (called from success redirect) ────────────────────────────

async function handleConfirmPayment(req: any, res: any) {
  const { session_id, ref, type } = req.query as Record<string, string>
  if (!session_id || !ref || !type) {
    return res.status(400).json({ error: 'session_id, ref, and type are required' })
  }

  const db = getServiceClient()

  if (type === 'invoice') {
    const { data: inv, error: invErr } = await db
      .from('invoices')
      .select('id, total, status, tenant_id, stripe_session_id, booking_id')
      .eq('id', ref)
      .single()
    if (invErr || !inv) return res.status(404).json({ error: 'Invoice not found' })
    if ((inv as any).status === 'paid') {
      return res.json({ ok: true, alreadyPaid: true, type: 'invoice' })
    }
    if ((inv as any).stripe_session_id !== session_id) {
      return res.status(400).json({ error: 'Session ID mismatch' })
    }

    const { data: tenant } = await db
      .from('tenants')
      .select('stripe_payment_sk')
      .eq('id', (inv as any).tenant_id)
      .single()
    if (!tenant?.stripe_payment_sk) return res.status(400).json({ error: 'Stripe not configured' })

    const stripe = new (await import('stripe')).default(tenant.stripe_payment_sk, {
      apiVersion: '2024-06-20',
      typescript: true,
    })
    const session = await stripe.checkout.sessions.retrieve(session_id)
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' })
    }

    const amount = (inv as any).total
    await db.from('payments').insert({
      tenant_id:  (inv as any).tenant_id,
      booking_id: (inv as any).booking_id,
      amount,
      method:    'stripe',
      status:    'completed',
      reference: session.payment_intent as string ?? session_id,
      notes:     'Online payment via Stripe',
    })
    await db.from('invoices').update({ status: 'paid', stripe_payment_url: null }).eq('id', ref)

    return res.json({ ok: true, type: 'invoice', amount })
  }

  if (type === 'rent') {
    const { data: row, error: rowErr } = await db
      .from('rent_schedule')
      .select('id, amount, balance, paid_amount, status, tenant_id, lease_id, stripe_session_id')
      .eq('id', ref)
      .single()
    if (rowErr || !row) return res.status(404).json({ error: 'Rent schedule item not found' })
    if ((row as any).status === 'paid') {
      return res.json({ ok: true, alreadyPaid: true, type: 'rent' })
    }
    if ((row as any).stripe_session_id !== session_id) {
      return res.status(400).json({ error: 'Session ID mismatch' })
    }

    const { data: tenant } = await db
      .from('tenants')
      .select('stripe_payment_sk')
      .eq('id', (row as any).tenant_id)
      .single()
    if (!tenant?.stripe_payment_sk) return res.status(400).json({ error: 'Stripe not configured' })

    const stripe = new (await import('stripe')).default(tenant.stripe_payment_sk, {
      apiVersion: '2024-06-20',
      typescript: true,
    })
    const session = await stripe.checkout.sessions.retrieve(session_id)
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' })
    }

    const amountPaid = (row as any).balance ?? (row as any).amount
    const newPaid    = ((row as any).paid_amount ?? 0) + amountPaid
    const today      = new Date().toISOString().slice(0, 10)

    await db.from('property_payments').insert({
      tenant_id:          (row as any).tenant_id,
      lease_id:           (row as any).lease_id,
      rent_schedule_id:   ref,
      amount:             amountPaid,
      payment_type:       'rent',
      method:             'stripe',
      reference:          session.payment_intent as string ?? session_id,
      payment_date:       today,
      notes:              'Online payment via Stripe',
    })
    await db.from('rent_schedule').update({
      paid_amount:        newPaid,
      status:             'paid',
      paid_date:          today,
      stripe_payment_url: null,
    }).eq('id', ref)

    return res.json({ ok: true, type: 'rent', amount: amountPaid })
  }

  return res.status(400).json({ error: 'Unknown type. Use type=invoice or type=rent' })
}

// ── main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res)
  if (handlePreflight(req, res)) return

  const action = req.query.action as string | undefined

  // Webhook — uses Stripe signature, no auth
  if (action === 'webhook') return handleWebhook(req, res)

  // Payment confirm — GET, no auth (called from Stripe redirect)
  if (action === 'confirm-payment') return handleConfirmPayment(req, res)

  // All other actions require POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Rate limit
  const ip = getClientIp(req)
  const rl = rateLimit(`stripe:${ip}`, 20, 60_000)
  if (!rl.allowed) return res.status(429).json({ error: 'Too many requests' })

  const db = getServiceClient()

  // Guest/rent checkout — auth required (staff creates the link)
  if (action === 'invoice-checkout' || action === 'rent-checkout') {
    const { tenantId } = await verifyTenantToken(req, db)
    if (!tenantId) return res.status(401).json({ error: 'Unauthorised' })
    if (action === 'invoice-checkout') return handleInvoiceCheckout(req, res, db, tenantId)
    return handleRentCheckout(req, res, db, tenantId)
  }

  // Platform billing — auth required
  const { tenantId } = await verifyTenantToken(req, db)
  if (!tenantId) return res.status(401).json({ error: 'Unauthorised' })

  switch (action) {
    case 'checkout': return handleCheckout(req, res, db, tenantId)
    case 'portal':   return handlePortal(req, res, db, tenantId)
    default:
      return res.status(400).json({
        error: 'Unknown action. Use ?action=checkout|portal|webhook|invoice-checkout|rent-checkout|confirm-payment',
      })
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
