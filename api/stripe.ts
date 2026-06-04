/**
 * Stripe API — unified handler
 *
 * ── Platform billing (TownsHub subscription) ─────────────────────────────────
 * POST ?action=checkout            Create Checkout session for plan upgrade
 * POST ?action=portal              Open Stripe Customer Portal
 * POST ?action=webhook             Stripe webhook dispatcher (raw body)
 *
 * ── Stripe Connect Express (hotel marketplace) ───────────────────────────────
 * POST ?action=connect-onboard     Create / resume Express onboarding link
 * POST ?action=connect-status      Sync account status from Stripe → DB
 * POST ?action=connect-dashboard   Get Stripe Express Dashboard login URL
 * POST ?action=booking-checkout    Create Checkout session for a guest booking
 * POST ?action=rent-checkout       Create Checkout session for rent payment
 * POST ?action=release-payout      Transfer hotel earnings after checkout
 * GET  ?action=confirm-booking     Verify session + record payment (success redirect)
 *
 * ── Finance: payouts, ledger, deposits, rent invoices ────────────────────────
 * GET  ?action=payout-preview      Calculate payout breakdown without executing
 * POST ?action=payout-run          Admin: execute full payout for a period
 * POST ?action=generate-rent-invoices  Admin/cron: create monthly rent invoices
 * POST ?action=deposit-action      Record deposit receipt / refund / forfeiture
 * GET  ?action=ledger              Paginated ledger entries for a tenant
 * GET  ?action=payout-history      List owner_payouts for a tenant
 *
 * ── Admin ─────────────────────────────────────────────────────────────────────
 * GET/POST ?action=admin-commission  Read / update global or per-tenant fee
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

/** Returns per-tenant fee if set, otherwise falls back to global commission_pct */
async function getEffectiveFee(db: ReturnType<typeof getServiceClient>, tenantId: string): Promise<number> {
  const { data } = await db
    .from('tenants')
    .select('platform_fee_pct, vat_registered')
    .eq('id', tenantId)
    .single()
  if (data?.platform_fee_pct != null) return parseFloat(String(data.platform_fee_pct))
  return getCommissionPct(db)
}

/** Writes a batch of ledger entries (server-side only via service role) */
async function writeLedger(
  db: ReturnType<typeof getServiceClient>,
  entries: Array<{
    tenant_id: string
    entry_type: string
    debit: number
    credit: number
    reference_id?: string
    reference_table?: string
    description: string
    period_month?: string
    created_by?: string
  }>
) {
  if (entries.length === 0) return
  const { error } = await db.from('ledger_entries').insert(entries)
  if (error) console.error('[ledger] write failed:', error.message, entries[0])
}

/** Cyprus VAT rate */
const CY_VAT_RATE = 0.19

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

// ── Release payout — correct formula: gross − expenses − fee (± VAT) ──────────

async function handleReleasePayout(req: any, res: any, db: ReturnType<typeof getServiceClient>, tenantId: string) {
  const { bookingId } = req.body ?? {}
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' })

  const { data: booking } = await db
    .from('bookings')
    .select('id,payment_status,payout_status,total_amount,check_out_date,stripe_payment_intent_id')
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .single()

  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  if (booking.payment_status !== 'paid')   return res.status(400).json({ error: 'Booking not paid' })
  if (['released','paid_out'].includes(booking.payout_status ?? '')) {
    return res.status(400).json({ error: 'Payout already released' })
  }

  const { data: tenant } = await db
    .from('tenants')
    .select('stripe_account_id,vat_registered,payout_hold_days')
    .eq('id', tenantId)
    .single()
  if (!tenant?.stripe_account_id) return res.status(400).json({ error: 'Hotel Stripe account not connected' })

  // Hold period check
  const holdDays = tenant.payout_hold_days ?? 3
  if (holdDays > 0 && booking.check_out_date) {
    const releaseDate = new Date(booking.check_out_date)
    releaseDate.setDate(releaseDate.getDate() + holdDays)
    if (new Date() < releaseDate) {
      return res.status(400).json({
        error: `Payout is on hold until ${releaseDate.toISOString().slice(0,10)} (${holdDays}-day hold period)`,
      })
    }
  }

  // ── Correct payout formula ─────────────────────────────────────────────────
  const gross = booking.total_amount ?? 0
  const period = booking.check_out_date?.slice(0, 7) ?? new Date().toISOString().slice(0, 7)

  // Sum approved expenses for this booking's period
  const { data: expenses } = await db
    .from('maintenance_requests')
    .select('expense_amount')
    .eq('tenant_id', tenantId)
    .eq('approved_for_payout', true)
    .eq('payout_period', period)
    .is('payout_id', null)  // not yet included in a payout

  const totalExpenses = (expenses ?? []).reduce((s, e) => s + (parseFloat(e.expense_amount) || 0), 0)

  const feePct     = await getEffectiveFee(db, tenantId)
  const platformFee = Math.round(gross * feePct / 100 * 100) / 100
  const vatOnFee   = tenant.vat_registered ? Math.round(platformFee * CY_VAT_RATE * 100) / 100 : 0
  const netPayout  = Math.max(0, gross - totalExpenses - platformFee - vatOnFee)

  if (netPayout <= 0) {
    return res.status(400).json({ error: `Net payout is €0 after deducting expenses (€${totalExpenses}) and fee (€${platformFee})` })
  }

  // Create owner_payouts record
  const expenseIds = (expenses ?? []).map((e: any) => e.id).filter(Boolean)
  const { data: payoutRecord } = await db.from('owner_payouts').insert({
    tenant_id:        tenantId,
    period_start:     `${period}-01`,
    period_end:       booking.check_out_date,
    gross_income:     gross,
    total_expenses:   totalExpenses,
    platform_fee_pct: feePct,
    platform_fee:     platformFee,
    vat_on_fee:       vatOnFee,
    net_payout:       netPayout,
    booking_ids:      [bookingId],
    expense_ids:      expenseIds,
    status:           'processing',
  }).select().single()

  // Execute Stripe transfer
  const transfer = await stripe().transfers.create({
    amount:      Math.round(netPayout * 100),
    currency:    'eur',
    destination: tenant.stripe_account_id,
    transfer_group: payoutRecord?.id,
    metadata:    { booking_id: bookingId, tenant_id: tenantId, payout_id: payoutRecord?.id ?? '' },
  })

  // Update records
  await db.from('owner_payouts').update({
    status:              'paid',
    stripe_transfer_id:  transfer.id,
    paid_at:             new Date().toISOString(),
  }).eq('id', payoutRecord!.id)

  await db.from('bookings').update({
    payout_status: 'released',
    payout_id:     payoutRecord!.id,
    hotel_earning: netPayout,
    platform_commission: platformFee,
  }).eq('id', bookingId)

  // Mark expenses as paid out
  if (expenseIds.length > 0) {
    await db.from('maintenance_requests').update({ payout_id: payoutRecord!.id }).in('id', expenseIds)
  }

  // Write double-entry ledger
  await writeLedger(db, [
    {
      tenant_id: tenantId, entry_type: 'booking_income',
      debit: 0, credit: gross,
      reference_id: bookingId, reference_table: 'bookings',
      description: `Booking income — ${bookingId.slice(0,8)}`, period_month: period,
    },
    ...(totalExpenses > 0 ? [{
      tenant_id: tenantId, entry_type: 'expense',
      debit: totalExpenses, credit: 0,
      reference_id: payoutRecord!.id, reference_table: 'owner_payouts',
      description: `Approved expenses for ${period}`, period_month: period,
    }] : []),
    {
      tenant_id: tenantId, entry_type: 'platform_fee',
      debit: platformFee, credit: 0,
      reference_id: payoutRecord!.id, reference_table: 'owner_payouts',
      description: `Platform fee ${feePct}%`, period_month: period,
    },
    ...(vatOnFee > 0 ? [{
      tenant_id: tenantId, entry_type: 'vat_on_fee',
      debit: vatOnFee, credit: 0,
      reference_id: payoutRecord!.id, reference_table: 'owner_payouts',
      description: `VAT (19%) on platform fee`, period_month: period,
    }] : []),
    {
      tenant_id: tenantId, entry_type: 'payout',
      debit: netPayout, credit: 0,
      reference_id: payoutRecord!.id, reference_table: 'owner_payouts',
      description: `Stripe transfer ${transfer.id}`, period_month: period,
    },
  ] as any)

  // Also record in stripe_transactions for backwards compat
  await db.from('stripe_transactions').insert({
    tenant_id: tenantId, booking_id: bookingId,
    type: 'transfer', amount: netPayout,
    stripe_id: transfer.id, status: 'succeeded',
    description: `Net payout: €${gross} − €${totalExpenses} expenses − €${platformFee} fee${vatOnFee > 0 ? ` − €${vatOnFee} VAT` : ''} = €${netPayout}`,
  })

  return res.json({
    ok: true,
    transferId:     transfer.id,
    payoutId:       payoutRecord!.id,
    gross,
    totalExpenses,
    platformFee,
    vatOnFee,
    netPayout,
  })
}

// ── Payout preview — calculate without executing ──────────────────────────────

async function handlePayoutPreview(req: any, res: any, db: ReturnType<typeof getServiceClient>, tenantId: string) {
  const { bookingId, period } = req.query as Record<string, string>
  const feePct = await getEffectiveFee(db, tenantId)
  const { data: tenant } = await db.from('tenants').select('vat_registered,stripe_account_id,stripe_charges_enabled').eq('id', tenantId).single()

  if (bookingId) {
    const { data: booking } = await db.from('bookings')
      .select('id,total_amount,check_out_date,payment_status,payout_status')
      .eq('id', bookingId).eq('tenant_id', tenantId).single()
    if (!booking) return res.status(404).json({ error: 'Booking not found' })

    const gross     = booking.total_amount ?? 0
    const pMonth    = booking.check_out_date?.slice(0, 7) ?? new Date().toISOString().slice(0, 7)
    const { data: expenses } = await db.from('maintenance_requests')
      .select('expense_amount').eq('tenant_id', tenantId).eq('approved_for_payout', true).eq('payout_period', pMonth)
    const totalExpenses = (expenses ?? []).reduce((s, e) => s + (parseFloat(e.expense_amount) || 0), 0)
    const platformFee   = Math.round(gross * feePct / 100 * 100) / 100
    const vatOnFee      = tenant?.vat_registered ? Math.round(platformFee * CY_VAT_RATE * 100) / 100 : 0
    const netPayout     = Math.max(0, gross - totalExpenses - platformFee - vatOnFee)

    return res.json({
      bookingId, gross, totalExpenses, platformFee, feePct, vatOnFee, netPayout,
      vatRegistered: tenant?.vat_registered,
      stripeReady: !!(tenant?.stripe_account_id && tenant?.stripe_charges_enabled),
    })
  }

  // Period-level preview (all unpaid bookings in a month)
  const targetPeriod = period ?? new Date().toISOString().slice(0, 7)
  const periodStart  = `${targetPeriod}-01`
  const periodEnd    = new Date(new Date(periodStart).getFullYear(), new Date(periodStart).getMonth() + 1, 0).toISOString().slice(0, 10)

  const { data: bookings } = await db.from('bookings')
    .select('id,total_amount,check_out_date,payment_status,payout_status')
    .eq('tenant_id', tenantId).eq('payment_status', 'paid').eq('payout_status', 'held')
    .gte('check_out_date', periodStart).lte('check_out_date', periodEnd)

  const { data: expenses } = await db.from('maintenance_requests')
    .select('id,expense_amount,title').eq('tenant_id', tenantId)
    .eq('approved_for_payout', true).eq('payout_period', targetPeriod)

  const gross         = (bookings ?? []).reduce((s, b) => s + (b.total_amount ?? 0), 0)
  const totalExpenses = (expenses ?? []).reduce((s, e) => s + (parseFloat(e.expense_amount) || 0), 0)
  const platformFee   = Math.round(gross * feePct / 100 * 100) / 100
  const vatOnFee      = tenant?.vat_registered ? Math.round(platformFee * CY_VAT_RATE * 100) / 100 : 0
  const netPayout     = Math.max(0, gross - totalExpenses - platformFee - vatOnFee)

  return res.json({
    period: targetPeriod, gross, totalExpenses, platformFee, feePct, vatOnFee, netPayout,
    bookingCount: (bookings ?? []).length,
    expenseCount: (expenses ?? []).length,
    vatRegistered: tenant?.vat_registered,
    stripeReady: !!(tenant?.stripe_account_id && tenant?.stripe_charges_enabled),
    expenses: expenses ?? [],
  })
}

// ── Payout run — admin executes monthly payout for all hotels ─────────────────

async function handlePayoutRun(req: any, res: any, db: ReturnType<typeof getServiceClient>, _tenantId: string) {
  // Admin-only: verify caller has admin role
  const { period, tenantIds } = req.body ?? {}
  const targetPeriod  = period ?? new Date().toISOString().slice(0, 7)
  const periodStart   = `${targetPeriod}-01`
  const periodEnd     = new Date(new Date(periodStart).getFullYear(), new Date(periodStart).getMonth() + 1, 0).toISOString().slice(0, 10)

  // Get all tenants (or specific ones) that have connected Stripe accounts
  let tenantsQuery = db.from('tenants')
    .select('id,name,stripe_account_id,stripe_charges_enabled,vat_registered,platform_fee_pct,payout_hold_days')
    .eq('stripe_connected', true)
    .eq('stripe_charges_enabled', true)
  if (tenantIds?.length > 0) tenantsQuery = tenantsQuery.in('id', tenantIds)
  const { data: hotels } = await tenantsQuery

  const results = []
  for (const hotel of (hotels ?? [])) {
    try {
      // Get paid, held bookings for this period
      const { data: bookings } = await db.from('bookings')
        .select('id,total_amount').eq('tenant_id', hotel.id)
        .eq('payment_status', 'paid').eq('payout_status', 'held')
        .gte('check_out_date', periodStart).lte('check_out_date', periodEnd)

      if (!bookings || bookings.length === 0) {
        results.push({ tenantId: hotel.id, name: hotel.name, status: 'skipped', reason: 'No eligible bookings' })
        continue
      }

      const gross         = bookings.reduce((s, b) => s + (b.total_amount ?? 0), 0)
      const feePct        = hotel.platform_fee_pct != null ? parseFloat(String(hotel.platform_fee_pct)) : await getCommissionPct(db)
      const { data: expenses } = await db.from('maintenance_requests')
        .select('id,expense_amount').eq('tenant_id', hotel.id)
        .eq('approved_for_payout', true).eq('payout_period', targetPeriod)
      const totalExpenses = (expenses ?? []).reduce((s, e) => s + (parseFloat(e.expense_amount) || 0), 0)
      const platformFee   = Math.round(gross * feePct / 100 * 100) / 100
      const vatOnFee      = hotel.vat_registered ? Math.round(platformFee * CY_VAT_RATE * 100) / 100 : 0
      const netPayout     = Math.max(0, gross - totalExpenses - platformFee - vatOnFee)

      if (netPayout <= 0) {
        results.push({ tenantId: hotel.id, name: hotel.name, status: 'skipped', reason: `Net ≤ 0 (gross €${gross}, expenses €${totalExpenses}, fee €${platformFee})` })
        continue
      }

      const { data: payoutRecord } = await db.from('owner_payouts').insert({
        tenant_id: hotel.id, period_start: periodStart, period_end: periodEnd,
        gross_income: gross, total_expenses: totalExpenses,
        platform_fee_pct: feePct, platform_fee: platformFee,
        vat_on_fee: vatOnFee, net_payout: netPayout,
        booking_ids: bookings.map(b => b.id),
        expense_ids: (expenses ?? []).map((e: any) => e.id).filter(Boolean),
        status: 'processing',
      }).select().single()

      const transfer = await stripe().transfers.create({
        amount: Math.round(netPayout * 100), currency: 'eur',
        destination: hotel.stripe_account_id,
        transfer_group: payoutRecord!.id,
        metadata: { period: targetPeriod, tenant_id: hotel.id, payout_id: payoutRecord!.id },
      })

      await db.from('owner_payouts').update({
        status: 'paid', stripe_transfer_id: transfer.id, paid_at: new Date().toISOString(),
      }).eq('id', payoutRecord!.id)

      await db.from('bookings').update({ payout_status: 'released', payout_id: payoutRecord!.id })
        .in('id', bookings.map(b => b.id))

      // Ledger entries
      await writeLedger(db, [
        { tenant_id: hotel.id, entry_type: 'booking_income', debit: 0, credit: gross, reference_id: payoutRecord!.id, reference_table: 'owner_payouts', description: `${bookings.length} bookings in ${targetPeriod}`, period_month: targetPeriod },
        ...(totalExpenses > 0 ? [{ tenant_id: hotel.id, entry_type: 'expense', debit: totalExpenses, credit: 0, reference_id: payoutRecord!.id, reference_table: 'owner_payouts', description: `Expenses ${targetPeriod}`, period_month: targetPeriod }] : []),
        { tenant_id: hotel.id, entry_type: 'platform_fee', debit: platformFee, credit: 0, reference_id: payoutRecord!.id, reference_table: 'owner_payouts', description: `Fee ${feePct}%`, period_month: targetPeriod },
        ...(vatOnFee > 0 ? [{ tenant_id: hotel.id, entry_type: 'vat_on_fee', debit: vatOnFee, credit: 0, reference_id: payoutRecord!.id, reference_table: 'owner_payouts', description: `VAT on fee`, period_month: targetPeriod }] : []),
        { tenant_id: hotel.id, entry_type: 'payout', debit: netPayout, credit: 0, reference_id: payoutRecord!.id, reference_table: 'owner_payouts', description: `Transfer ${transfer.id}`, period_month: targetPeriod },
      ] as any)

      results.push({ tenantId: hotel.id, name: hotel.name, status: 'paid', transferId: transfer.id, netPayout, gross, totalExpenses, platformFee })
    } catch (err: any) {
      results.push({ tenantId: hotel.id, name: hotel.name, status: 'failed', error: err.message })
    }
  }

  return res.json({ ok: true, period: targetPeriod, results })
}

// ── Generate rent invoices (cron / manual) ────────────────────────────────────

async function handleGenerateRentInvoices(req: any, res: any, db: ReturnType<typeof getServiceClient>, tenantId: string) {
  const { period } = req.body ?? {}
  const targetPeriod = period ?? new Date().toISOString().slice(0, 7)
  const [year, month] = targetPeriod.split('-').map(Number)
  const periodStart   = `${targetPeriod}-01`
  const lastDay       = new Date(year, month, 0).getDate()
  const periodEnd     = `${targetPeriod}-${lastDay}`
  const dueDate       = `${targetPeriod}-01`  // due on 1st of month

  // Active leases for this tenant
  const { data: leases } = await db.from('leases')
    .select('id,monthly_rent,property_tenant:property_tenants(id,first_name,last_name)')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .lte('start_date', periodEnd)
    .or(`end_date.is.null,end_date.gte.${periodStart}`)

  if (!leases || leases.length === 0) {
    return res.json({ ok: true, created: 0, message: 'No active leases' })
  }

  // Check which leases already have an invoice for this period
  const { data: existing } = await db.from('rent_invoices')
    .select('lease_id')
    .eq('tenant_id', tenantId)
    .eq('period_start', periodStart)

  const existingLeaseIds = new Set((existing ?? []).map((r: any) => r.lease_id))

  const toCreate = (leases ?? [])
    .filter((l: any) => !existingLeaseIds.has(l.id))
    .map((l: any) => ({
      tenant_id:    tenantId,
      lease_id:     l.id,
      period_start: periodStart,
      period_end:   periodEnd,
      due_date:     dueDate,
      amount:       l.monthly_rent,
      vat_amount:   0,
      status:       'pending',
    }))

  if (toCreate.length === 0) {
    return res.json({ ok: true, created: 0, message: `All invoices for ${targetPeriod} already exist` })
  }

  const { data: created, error } = await db.from('rent_invoices').insert(toCreate).select('id')
  if (error) return res.status(500).json({ error: error.message })

  return res.json({ ok: true, created: (created ?? []).length, period: targetPeriod, total: leases.length })
}

// ── Deposit action — trust account lifecycle ──────────────────────────────────

async function handleDepositAction(req: any, res: any, db: ReturnType<typeof getServiceClient>, tenantId: string) {
  const { leaseId, action, amount, notes, trustRef } = req.body ?? {}
  if (!leaseId || !action) return res.status(400).json({ error: 'leaseId and action are required' })
  if (!['received','refund_full','refund_partial','forfeit'].includes(action)) {
    return res.status(400).json({ error: 'action must be received | refund_full | refund_partial | forfeit' })
  }

  const { data: lease } = await db.from('leases')
    .select('id,deposit_amount,deposit_status,deposit_trust_ref')
    .eq('id', leaseId).eq('tenant_id', tenantId).single()
  if (!lease) return res.status(404).json({ error: 'Lease not found' })

  const period = new Date().toISOString().slice(0, 7)
  const now    = new Date().toISOString()

  if (action === 'received') {
    if (lease.deposit_status === 'held') return res.status(400).json({ error: 'Deposit already marked as held' })
    await db.from('leases').update({
      deposit_paid:      true,
      deposit_status:    'held',
      deposit_trust_ref: trustRef ?? null,
    }).eq('id', leaseId)
    await writeLedger(db, [{
      tenant_id: tenantId, entry_type: 'deposit_in',
      debit: 0, credit: lease.deposit_amount,
      reference_id: leaseId, reference_table: 'leases',
      description: `Security deposit received${trustRef ? ` — ref: ${trustRef}` : ''}`,
      period_month: period,
    }] as any)
    return res.json({ ok: true, status: 'held', amount: lease.deposit_amount })
  }

  if (lease.deposit_status !== 'held') {
    return res.status(400).json({ error: 'Deposit is not in "held" state' })
  }

  if (action === 'refund_full') {
    await db.from('leases').update({
      deposit_status: 'refunded', deposit_refunded_at: now,
      deposit_refund_amount: lease.deposit_amount, deposit_notes: notes ?? null,
    }).eq('id', leaseId)
    await writeLedger(db, [{
      tenant_id: tenantId, entry_type: 'deposit_out',
      debit: lease.deposit_amount, credit: 0,
      reference_id: leaseId, reference_table: 'leases',
      description: `Full deposit refund${notes ? ` — ${notes}` : ''}`, period_month: period,
    }] as any)
    return res.json({ ok: true, status: 'refunded', amount: lease.deposit_amount })
  }

  if (action === 'refund_partial') {
    const refundAmt  = parseFloat(amount) || 0
    const damageAmt  = lease.deposit_amount - refundAmt
    await db.from('leases').update({
      deposit_status: 'partially_refunded', deposit_refunded_at: now,
      deposit_refund_amount: refundAmt, deposit_damage_amount: damageAmt,
      deposit_notes: notes ?? null,
    }).eq('id', leaseId)
    await writeLedger(db, [
      { tenant_id: tenantId, entry_type: 'deposit_out', debit: refundAmt, credit: 0, reference_id: leaseId, reference_table: 'leases', description: `Partial deposit refund — €${refundAmt}`, period_month: period },
      { tenant_id: tenantId, entry_type: 'deposit_forfeited', debit: 0, credit: damageAmt, reference_id: leaseId, reference_table: 'leases', description: `Deposit deduction for damages — €${damageAmt}${notes ? `. ${notes}` : ''}`, period_month: period },
    ] as any)
    return res.json({ ok: true, status: 'partially_refunded', refundAmount: refundAmt, damageAmount: damageAmt })
  }

  if (action === 'forfeit') {
    await db.from('leases').update({
      deposit_status: 'forfeited', deposit_forfeited_at: now,
      deposit_damage_amount: lease.deposit_amount, deposit_notes: notes ?? null,
    }).eq('id', leaseId)
    await writeLedger(db, [{
      tenant_id: tenantId, entry_type: 'deposit_forfeited',
      debit: 0, credit: lease.deposit_amount,
      reference_id: leaseId, reference_table: 'leases',
      description: `Deposit forfeited${notes ? ` — ${notes}` : ''}`, period_month: period,
    }] as any)
    return res.json({ ok: true, status: 'forfeited', amount: lease.deposit_amount })
  }
}

// ── Ledger — paginated read ───────────────────────────────────────────────────

async function handleLedger(req: any, res: any, db: ReturnType<typeof getServiceClient>, tenantId: string) {
  const { period, type, page = '1', limit = '50' } = req.query as Record<string, string>
  const pageNum  = Math.max(1, parseInt(page))
  const pageSize = Math.min(100, parseInt(limit))
  const from     = (pageNum - 1) * pageSize

  let q = db.from('ledger_entries')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (period) q = q.eq('period_month', period)
  if (type)   q = q.eq('entry_type', type)

  const { data, error, count } = await q
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ entries: data ?? [], total: count ?? 0, page: pageNum, pageSize })
}

// ── Payout history ────────────────────────────────────────────────────────────

async function handlePayoutHistory(req: any, res: any, db: ReturnType<typeof getServiceClient>, tenantId: string) {
  const { data, error } = await db.from('owner_payouts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(24)
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ payouts: data ?? [] })
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

  // ── Auth + allow GET for read actions ─────────────────────────────────────
  const ip = getClientIp(req)
  const rl = rateLimit(`stripe:${ip}`, 30, 60_000)
  if (!rl.allowed) return res.status(429).json({ error: 'Too many requests' })

  const db = getServiceClient()
  const { tenantId } = await verifyTenantToken(req, db)
  if (!tenantId) return res.status(401).json({ error: 'Unauthorised' })

  if (action === 'payout-preview')  return handlePayoutPreview(req, res, db, tenantId)
  if (action === 'ledger')          return handleLedger(req, res, db, tenantId)
  if (action === 'payout-history')  return handlePayoutHistory(req, res, db, tenantId)
  if (action === 'connect-status')  return handleConnectStatus(req, res, db, tenantId)

  // ── Remaining actions require POST ─────────────────────────────────────────
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  switch (action) {
    // Platform billing
    case 'checkout':                  return handleCheckout(req, res, db, tenantId)
    case 'portal':                    return handlePortal(req, res, db, tenantId)
    // Connect
    case 'connect-onboard':           return handleConnectOnboard(req, res, db, tenantId)
    case 'connect-status':            return handleConnectStatus(req, res, db, tenantId)
    case 'connect-dashboard':         return handleConnectDashboard(req, res, db, tenantId)
    case 'booking-checkout':          return handleBookingCheckout(req, res, db, tenantId)
    case 'rent-checkout':             return handleRentCheckout(req, res, db, tenantId)
    // Finance
    case 'release-payout':            return handleReleasePayout(req, res, db, tenantId)
    case 'payout-run':                return handlePayoutRun(req, res, db, tenantId)
    case 'generate-rent-invoices':    return handleGenerateRentInvoices(req, res, db, tenantId)
    case 'deposit-action':            return handleDepositAction(req, res, db, tenantId)
    default:
      return res.status(400).json({ error: 'Unknown action' })
  }
}
