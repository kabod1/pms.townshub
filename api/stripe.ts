/**
 * Stripe API — unified handler
 *
 * ── Platform billing (TownsHub subscription) ─────────────────────────────────
 * POST ?action=checkout       Create Checkout session for plan upgrade
 * POST ?action=portal         Open Stripe Customer Portal
 * POST ?action=webhook        Stripe webhook dispatcher (raw body)
 *
 * ── Stripe Connect Express (hotel marketplace) ───────────────────────────────
 * POST ?action=connect-onboard   Create / resume Express onboarding link
 * POST ?action=connect-status    Sync account status from Stripe → DB
 * POST ?action=connect-dashboard Get Stripe Express Dashboard login URL
 * POST ?action=booking-checkout  Create Checkout session for a guest booking
 * POST ?action=release-payout    Transfer hotel earnings after checkout
 * GET  ?action=confirm-booking   Verify session + record payment (success redirect)
 *
 * ── Admin ─────────────────────────────────────────────────────────────────────
 * GET/POST ?action=admin-commission  Read / update platform commission %
 * GET      ?action=admin-stats       Overview of connected hotels + revenue
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY          Platform Stripe secret key (sk_live_...)
 *   STRIPE_WEBHOOK_SECRET      Platform webhook signing secret
 *   SUPABASE_URL / VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import Stripe from 'stripe'
import {
  setCorsHeaders,
  handlePreflight,
  getServiceClient,
  verifyTenantToken,
  rateLimit,
  getClientIp,
} from './_lib/security.js'

// ── helpers ───────────────────────────────────────────────────────────────────

function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(key, { apiVersion: '2024-06-20', typescript: true })
}

const PRICE_MAP: Record<string, string | undefined> = {
  essential:    process.env.STRIPE_PRICE_ESSENTIAL,
  professional: process.env.STRIPE_PRICE_PROFESSIONAL,
  enterprise:   process.env.STRIPE_PRICE_ENTERPRISE,
}

function mapStripeStatus(s: Stripe.Subscription.Status) {
  switch (s) {
    case 'trialing': return 'trialing'
    case 'active':   return 'active'
    case 'past_due': return 'past_due'
    case 'canceled': return 'cancelled'
    case 'unpaid':   return 'unpaid'
    default:         return 'cancelled'
  }
}

function tierFromSubscription(sub: Stripe.Subscription): string | null {
  const priceId = sub.items.data[0]?.price.id
  if (!priceId) return null
  for (const [tier, pid] of Object.entries(PRICE_MAP)) {
    if (pid && pid === priceId) return tier
  }
  return null
}

async function getCommissionPct(db: ReturnType<typeof getServiceClient>): Promise<number> {
  const { data } = await db
    .from('platform_settings')
    .select('value')
    .eq('key', 'commission_pct')
    .single()
  return parseFloat(data?.value ?? '10')
}

// ── Platform billing: Checkout ────────────────────────────────────────────────

async function handleCheckout(req: any, res: any, db: ReturnType<typeof getServiceClient>, tenantId: string) {
  const { tier } = req.body ?? {}
  if (!tier || !['essential', 'professional', 'enterprise'].includes(tier)) {
    return res.status(400).json({ error: 'tier must be essential | professional | enterprise' })
  }
  const priceId = PRICE_MAP[tier]
  if (!priceId) {
    return res.status(500).json({ error: `STRIPE_PRICE_${tier.toUpperCase()} not configured` })
  }

  const { data: tenant } = await db.from('tenants').select('id,name,email,stripe_customer_id').eq('id', tenantId).single()
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' })

  const s = stripe()
  let customerId = tenant.stripe_customer_id as string | null
  if (!customerId) {
    const customer = await s.customers.create({ name: tenant.name, email: tenant.email ?? undefined, metadata: { tenant_id: tenantId } })
    customerId = customer.id
    await db.from('tenants').update({ stripe_customer_id: customerId }).eq('id', tenantId)
  }

  const origin = req.headers.origin ?? 'https://pms.townshub.com'
  const session = await s.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/settings/billing?success=1`,
    cancel_url:  `${origin}/settings/billing`,
    metadata: { tenant_id: tenantId, tier },
    subscription_data: { metadata: { tenant_id: tenantId, tier } },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
  })
  return res.json({ url: session.url })
}

// ── Platform billing: Portal ──────────────────────────────────────────────────

async function handlePortal(req: any, res: any, db: ReturnType<typeof getServiceClient>, tenantId: string) {
  const { data: tenant } = await db.from('tenants').select('id,stripe_customer_id').eq('id', tenantId).single()
  if (!tenant?.stripe_customer_id) return res.status(400).json({ error: 'No Stripe customer linked. Complete a checkout first.' })

  const origin = req.headers.origin ?? 'https://pms.townshub.com'
  const session = await stripe().billingPortal.sessions.create({
    customer: tenant.stripe_customer_id,
    return_url: `${origin}/settings/billing`,
  })
  return res.json({ url: session.url })
}

// ── Connect: Onboard ──────────────────────────────────────────────────────────

async function handleConnectOnboard(req: any, res: any, db: ReturnType<typeof getServiceClient>, tenantId: string) {
  const { data: tenant } = await db
    .from('tenants')
    .select('id,name,email,stripe_account_id')
    .eq('id', tenantId)
    .single()
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' })

  const s = stripe()
  const origin = req.headers.origin ?? 'https://pms.townshub.com'

  let accountId = tenant.stripe_account_id as string | null

  // Create Express account if not already linked
  if (!accountId) {
    const account = await s.accounts.create({
      type: 'express',
      email: tenant.email ?? undefined,
      business_profile: { name: tenant.name },
      metadata: { tenant_id: tenantId },
      capabilities: {
        card_payments:   { requested: true },
        transfers:       { requested: true },
      },
    })
    accountId = account.id
    await db.from('tenants').update({
      stripe_account_id: accountId,
      stripe_connected:  false,
      stripe_verification_status: 'pending',
    }).eq('id', tenantId)
  }

  // Generate (or refresh) the onboarding link
  const link = await s.accountLinks.create({
    account:     accountId,
    refresh_url: `${origin}/payments?onboard=refresh`,
    return_url:  `${origin}/payments?onboard=success`,
    type:        'account_onboarding',
  })

  return res.json({ url: link.url })
}

// ── Connect: Status ───────────────────────────────────────────────────────────

async function handleConnectStatus(req: any, res: any, db: ReturnType<typeof getServiceClient>, tenantId: string) {
  const { data: tenant } = await db
    .from('tenants')
    .select('id,stripe_account_id')
    .eq('id', tenantId)
    .single()

  if (!tenant?.stripe_account_id) {
    return res.json({ connected: false, chargesEnabled: false, payoutsEnabled: false, verificationStatus: 'unverified' })
  }

  let account: Stripe.Account
  try {
    account = await stripe().accounts.retrieve(tenant.stripe_account_id)
  } catch {
    return res.json({ connected: false, chargesEnabled: false, payoutsEnabled: false, verificationStatus: 'unverified' })
  }

  const verificationStatus =
    account.details_submitted && account.charges_enabled ? 'verified' :
    account.details_submitted ? 'pending' : 'unverified'

  await db.from('tenants').update({
    stripe_connected:            account.details_submitted ?? false,
    stripe_onboarding_completed: account.details_submitted ?? false,
    stripe_charges_enabled:      account.charges_enabled   ?? false,
    stripe_payouts_enabled:      account.payouts_enabled   ?? false,
    stripe_verification_status:  verificationStatus,
  }).eq('id', tenantId)

  return res.json({
    connected:          account.details_submitted ?? false,
    chargesEnabled:     account.charges_enabled   ?? false,
    payoutsEnabled:     account.payouts_enabled   ?? false,
    verificationStatus,
    email:              account.email,
    payoutSchedule:     (account as any).settings?.payouts?.schedule,
  })
}

// ── Connect: Dashboard ────────────────────────────────────────────────────────

async function handleConnectDashboard(req: any, res: any, db: ReturnType<typeof getServiceClient>, tenantId: string) {
  const { data: tenant } = await db.from('tenants').select('stripe_account_id').eq('id', tenantId).single()
  if (!tenant?.stripe_account_id) return res.status(400).json({ error: 'Stripe account not connected. Complete onboarding first.' })

  const link = await stripe().accounts.createLoginLink(tenant.stripe_account_id)
  return res.json({ url: link.url })
}

// ── Booking checkout (guest pays through platform → Connect) ──────────────────

async function handleBookingCheckout(req: any, res: any, db: ReturnType<typeof getServiceClient>, tenantId: string) {
  const { bookingId } = req.body ?? {}
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' })

  const { data: booking } = await db
    .from('bookings')
    .select(`
      id, booking_reference, total_amount, payment_status,
      stripe_checkout_session,
      guest:guests(first_name, last_name, email),
      room:rooms(number, room_type:room_types(name))
    `)
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .single()

  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  if (booking.payment_status === 'paid') return res.status(400).json({ error: 'Booking already paid' })

  // Return cached URL if still valid
  if (booking.stripe_checkout_session) {
    try {
      const existing = await stripe().checkout.sessions.retrieve(booking.stripe_checkout_session)
      if (existing.status === 'open') return res.json({ url: existing.url, cached: true })
    } catch { /* session expired, create new */ }
  }

  const { data: tenant } = await db
    .from('tenants')
    .select('name,stripe_account_id,stripe_charges_enabled')
    .eq('id', tenantId)
    .single()

  if (!tenant?.stripe_account_id || !tenant.stripe_charges_enabled) {
    return res.status(400).json({
      error: 'Hotel Stripe account not connected or not verified. Go to Payments → Connect Stripe Account.',
    })
  }

  const commissionPct = await getCommissionPct(db)
  const totalAmount   = booking.total_amount ?? 0
  const commissionAmt = Math.round(totalAmount * commissionPct / 100 * 100) // in cents
  const amountCents   = Math.round(totalAmount * 100)

  const guest = (booking as any).guest
  const room  = (booking as any).room
  const origin = req.headers.origin ?? 'https://pms.townshub.com'

  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: guest?.email ?? undefined,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: amountCents,
        product_data: {
          name: `${tenant.name} — Room ${room?.number ?? ''}`,
          description: `Booking ${booking.booking_reference}${room?.room_type?.name ? ` · ${room.room_type.name}` : ''}`,
        },
      },
    }],
    payment_intent_data: {
      application_fee_amount: commissionAmt,
      transfer_data: { destination: tenant.stripe_account_id },
      metadata: {
        booking_id:   bookingId,
        tenant_id:    tenantId,
        commission_pct: String(commissionPct),
      },
    },
    success_url: `${origin}/payment/success?type=booking&ref=${bookingId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${origin}/payment/cancelled`,
    metadata: { booking_id: bookingId, tenant_id: tenantId, type: 'booking' },
  })

  await db.from('bookings').update({ stripe_checkout_session: session.id }).eq('id', bookingId)

  return res.json({ url: session.url })
}

// ── Confirm booking payment (GET — called from success redirect) ───────────────

async function handleConfirmBooking(req: any, res: any) {
  const { session_id, ref } = req.query as Record<string, string>
  if (!session_id || !ref) return res.status(400).json({ error: 'session_id and ref are required' })

  const db = getServiceClient()
  const { data: booking } = await db
    .from('bookings')
    .select('id,tenant_id,total_amount,payment_status,stripe_checkout_session')
    .eq('id', ref)
    .single()

  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  if (booking.payment_status === 'paid') return res.json({ ok: true, alreadyPaid: true })
  if (booking.stripe_checkout_session !== session_id) return res.status(400).json({ error: 'Session mismatch' })

  const session = await stripe().checkout.sessions.retrieve(session_id, { expand: ['payment_intent'] })
  if (session.payment_status !== 'paid') return res.status(400).json({ error: 'Payment not completed' })

  const pi         = session.payment_intent as Stripe.PaymentIntent
  const commissionPct = await getCommissionPct(db)
  const totalAmount   = booking.total_amount ?? 0
  const commission    = Math.round(totalAmount * commissionPct) / 100
  const hotelEarning  = totalAmount - commission
  const today         = new Date().toISOString().slice(0, 10)

  await db.from('bookings').update({
    payment_status:            'paid',
    stripe_payment_intent_id:  pi.id,
    hotel_earning:             hotelEarning,
    platform_commission:       commission,
    payout_status:             'held',
    paid_amount:               totalAmount,
  }).eq('id', ref)

  await db.from('stripe_transactions').insert([
    {
      tenant_id:   booking.tenant_id,
      booking_id:  ref,
      type:        'payment',
      amount:      totalAmount,
      stripe_id:   pi.id,
      status:      'succeeded',
      description: `Booking payment — session ${session_id}`,
    },
    {
      tenant_id:   booking.tenant_id,
      booking_id:  ref,
      type:        'commission',
      amount:      commission,
      stripe_id:   pi.id,
      status:      'succeeded',
      description: `Platform commission ${commissionPct}%`,
    },
  ])

  return res.json({ ok: true, amount: totalAmount, hotelEarning, commission })
}

// ── Rent checkout (property tenant pays rent via Connect) ─────────────────────

async function handleRentCheckout(req: any, res: any, db: ReturnType<typeof getServiceClient>, tenantId: string) {
  const { rentScheduleId } = req.body ?? {}
  if (!rentScheduleId) return res.status(400).json({ error: 'rentScheduleId is required' })

  const { data: row } = await db
    .from('rent_schedule')
    .select('id,amount,balance,status,lease:leases(property_tenant:property_tenants(first_name,last_name,email),unit:units(unit_number))')
    .eq('id', rentScheduleId)
    .eq('tenant_id', tenantId)
    .single()

  if (!row) return res.status(404).json({ error: 'Rent schedule item not found' })
  if ((row as any).status === 'paid') return res.status(400).json({ error: 'Already paid' })

  const { data: tenant } = await db
    .from('tenants')
    .select('name,stripe_account_id,stripe_charges_enabled')
    .eq('id', tenantId)
    .single()

  if (!tenant?.stripe_account_id || !tenant.stripe_charges_enabled) {
    return res.status(400).json({ error: 'Hotel Stripe account not connected. Go to Payments → Connect Stripe Account.' })
  }

  const commissionPct = await getCommissionPct(db)
  const amountDue     = (row as any).balance ?? (row as any).amount
  const commissionAmt = Math.round(amountDue * commissionPct / 100 * 100)
  const amountCents   = Math.round(amountDue * 100)
  const renter        = (row as any).lease?.property_tenant
  const unitNumber    = (row as any).lease?.unit?.unit_number ?? 'Unit'
  const origin        = req.headers.origin ?? 'https://pms.townshub.com'

  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: renter?.email ?? undefined,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: amountCents,
        product_data: { name: `Rent — ${unitNumber}`, description: `Rent payment for ${tenant.name}` },
      },
    }],
    payment_intent_data: {
      application_fee_amount: commissionAmt,
      transfer_data: { destination: tenant.stripe_account_id },
      metadata: { rent_schedule_id: rentScheduleId, tenant_id: tenantId, type: 'rent' },
    },
    success_url: `${origin}/payment/success?type=rent&ref=${rentScheduleId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${origin}/payment/cancelled`,
    metadata: { rent_schedule_id: rentScheduleId, tenant_id: tenantId, type: 'rent' },
  })

  return res.json({ url: session.url })
}

// ── Release payout (after guest checkout) ─────────────────────────────────────

async function handleReleasePayout(req: any, res: any, db: ReturnType<typeof getServiceClient>, tenantId: string) {
  const { bookingId } = req.body ?? {}
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' })

  const { data: booking } = await db
    .from('bookings')
    .select('id,payment_status,payout_status,hotel_earning,stripe_payment_intent_id')
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .single()

  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  if (booking.payment_status !== 'paid') return res.status(400).json({ error: 'Booking not paid' })
  if (booking.payout_status === 'released' || booking.payout_status === 'paid_out') {
    return res.status(400).json({ error: 'Payout already released' })
  }
  if (!booking.hotel_earning || booking.hotel_earning <= 0) {
    return res.status(400).json({ error: 'No hotel earnings to release' })
  }

  const { data: tenant } = await db.from('tenants').select('stripe_account_id').eq('id', tenantId).single()
  if (!tenant?.stripe_account_id) return res.status(400).json({ error: 'Hotel Stripe account not connected' })

  const transfer = await stripe().transfers.create({
    amount:      Math.round(booking.hotel_earning * 100),
    currency:    'eur',
    destination: tenant.stripe_account_id,
    metadata:    { booking_id: bookingId, tenant_id: tenantId },
  })

  await db.from('bookings').update({ payout_status: 'released' }).eq('id', bookingId)
  await db.from('stripe_transactions').insert({
    tenant_id:   tenantId,
    booking_id:  bookingId,
    type:        'transfer',
    amount:      booking.hotel_earning,
    stripe_id:   transfer.id,
    status:      'succeeded',
    description: 'Hotel earnings transfer after checkout',
  })

  return res.json({ ok: true, transferId: transfer.id, amount: booking.hotel_earning })
}

// ── Admin: commission ─────────────────────────────────────────────────────────

async function handleAdminCommission(req: any, res: any) {
  const db = getServiceClient()
  // Verify it's an admin (any authenticated user with admin role)
  const token = (req.headers.authorization ?? '').replace('Bearer ', '').trim()
  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Unauthorised' })
  const { data: profile } = await db.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  if (req.method === 'GET') {
    const pct = await getCommissionPct(db)
    return res.json({ commission_pct: pct })
  }

  const { commission_pct } = req.body ?? {}
  const pct = parseFloat(commission_pct)
  if (isNaN(pct) || pct < 0 || pct > 100) return res.status(400).json({ error: 'commission_pct must be 0–100' })

  await db.from('platform_settings').upsert({ key: 'commission_pct', value: String(pct) }, { onConflict: 'key' })
  return res.json({ ok: true, commission_pct: pct })
}

// ── Admin: stats ──────────────────────────────────────────────────────────────

async function handleAdminStats(req: any, res: any) {
  const db = getServiceClient()
  const token = (req.headers.authorization ?? '').replace('Bearer ', '').trim()
  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Unauthorised' })
  const { data: profile } = await db.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  const [{ data: hotels }, { data: txns }] = await Promise.all([
    db.from('tenants').select('id,name,stripe_connected,stripe_verification_status,stripe_charges_enabled'),
    db.from('stripe_transactions').select('type,amount,status').eq('status', 'succeeded'),
  ])

  const totalRevenue    = (txns ?? []).filter((t) => t.type === 'payment').reduce((s, t) => s + t.amount, 0)
  const totalCommission = (txns ?? []).filter((t) => t.type === 'commission').reduce((s, t) => s + t.amount, 0)
  const connectedHotels = (hotels ?? []).filter((h) => h.stripe_connected).length
  const verifiedHotels  = (hotels ?? []).filter((h) => h.stripe_verification_status === 'verified').length

  return res.json({
    hotels:          hotels ?? [],
    totalRevenue,
    totalCommission,
    connectedHotels,
    verifiedHotels,
    commissionPct:   await getCommissionPct(db),
  })
}

// ── Webhook ───────────────────────────────────────────────────────────────────

async function handleWebhook(req: any, res: any) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return res.status(500).json({ error: 'STRIPE_WEBHOOK_SECRET not set' })

  const sig = req.headers['stripe-signature'] as string
  let event: Stripe.Event
  try {
    const raw = req.rawBody ?? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
    event = stripe().webhooks.constructEvent(raw, sig, secret)
  } catch (err: any) {
    return res.status(400).json({ error: `Webhook signature error: ${err.message}` })
  }

  const db = getServiceClient()

  switch (event.type) {
    // ── Platform subscription events ──────────────────────────────────────────
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'subscription') {
        const tenantId = session.metadata?.tenant_id
        const tier     = session.metadata?.tier
        if (tenantId && tier) {
          await db.from('tenants').update({
            subscription_tier:         tier,
            subscription_status:       'active',
            stripe_customer_id:        session.customer as string,
            stripe_subscription_id:    session.subscription as string,
          }).eq('id', tenantId)
        }
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const tenantId = sub.metadata?.tenant_id
      let tid = tenantId
      if (!tid) {
        const { data } = await db.from('tenants').select('id').eq('stripe_customer_id', sub.customer as string).single()
        tid = data?.id
      }
      if (tid) {
        const newTier   = tierFromSubscription(sub)
        const updates: Record<string, unknown> = {
          subscription_status:    mapStripeStatus(sub.status),
          stripe_subscription_id: sub.id,
        }
        if (newTier) updates.subscription_tier = newTier
        await db.from('tenants').update(updates).eq('id', tid)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      let tid = sub.metadata?.tenant_id
      if (!tid) {
        const { data } = await db.from('tenants').select('id').eq('stripe_customer_id', sub.customer as string).single()
        tid = data?.id
      }
      if (tid) {
        await db.from('tenants').update({ subscription_status: 'cancelled', stripe_subscription_id: null }).eq('id', tid)
      }
      break
    }

    // ── Connect account events ────────────────────────────────────────────────
    case 'account.updated': {
      const account = event.data.object as Stripe.Account
      const { data: tenant } = await db.from('tenants').select('id').eq('stripe_account_id', account.id).single()
      if (tenant) {
        const vs =
          account.details_submitted && account.charges_enabled ? 'verified' :
          account.details_submitted ? 'pending' : 'unverified'
        await db.from('tenants').update({
          stripe_connected:            account.details_submitted ?? false,
          stripe_onboarding_completed: account.details_submitted ?? false,
          stripe_charges_enabled:      account.charges_enabled   ?? false,
          stripe_payouts_enabled:      account.payouts_enabled   ?? false,
          stripe_verification_status:  vs,
        }).eq('id', tenant.id)
      }
      break
    }

    // ── Booking payment confirmed via webhook (redundant safety net) ──────────
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent
      const bookingId = pi.metadata?.booking_id
      const tenantId  = pi.metadata?.tenant_id
      if (bookingId && tenantId) {
        const { data: booking } = await db.from('bookings').select('payment_status,total_amount').eq('id', bookingId).single()
        if (booking && booking.payment_status !== 'paid') {
          const commissionPct = await getCommissionPct(db)
          const total         = booking.total_amount ?? 0
          const commission    = Math.round(total * commissionPct) / 100
          await db.from('bookings').update({
            payment_status:           'paid',
            stripe_payment_intent_id: pi.id,
            hotel_earning:            total - commission,
            platform_commission:      commission,
            payout_status:            'held',
            paid_amount:              total,
          }).eq('id', bookingId)
        }
      }
      break
    }

    case 'charge.dispute.created': {
      const dispute = event.data.object as Stripe.Dispute
      console.warn('[stripe/webhook] Dispute created:', dispute.id, dispute.amount)
      // Future: notify admin, freeze payout
      break
    }
  }

  return res.json({ received: true })
}

// ── Router ────────────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res)
  if (handlePreflight(req, res)) return

  const action = req.query.action as string | undefined

  // ── No-auth endpoints ──────────────────────────────────────────────────────
  if (action === 'webhook')          return handleWebhook(req, res)
  if (action === 'confirm-booking')  return handleConfirmBooking(req, res)

  // ── Admin endpoints (own auth check inside) ────────────────────────────────
  if (action === 'admin-commission') return handleAdminCommission(req, res)
  if (action === 'admin-stats')      return handleAdminStats(req, res)

  // ── Require POST ───────────────────────────────────────────────────────────
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ip = getClientIp(req)
  const rl = rateLimit(`stripe:${ip}`, 30, 60_000)
  if (!rl.allowed) return res.status(429).json({ error: 'Too many requests' })

  const db = getServiceClient()
  const { tenantId } = await verifyTenantToken(req, db)
  if (!tenantId) return res.status(401).json({ error: 'Unauthorised' })

  switch (action) {
    // Platform billing
    case 'checkout':           return handleCheckout(req, res, db, tenantId)
    case 'portal':             return handlePortal(req, res, db, tenantId)
    // Connect
    case 'connect-onboard':    return handleConnectOnboard(req, res, db, tenantId)
    case 'connect-status':     return handleConnectStatus(req, res, db, tenantId)
    case 'connect-dashboard':  return handleConnectDashboard(req, res, db, tenantId)
    case 'booking-checkout':   return handleBookingCheckout(req, res, db, tenantId)
    case 'release-payout':     return handleReleasePayout(req, res, db, tenantId)
    case 'rent-checkout':      return handleRentCheckout(req, res, db, tenantId)
    default:
      return res.status(400).json({
        error: 'Unknown action',
        actions: ['checkout','portal','webhook','connect-onboard','connect-status','connect-dashboard','booking-checkout','release-payout','confirm-booking','admin-commission','admin-stats'],
      })
  }
}
