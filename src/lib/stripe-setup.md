# Stripe Products & Prices Setup

Follow these steps to wire up Stripe subscriptions for TownsHub PMS.

---

## 1. Create a Stripe account

Go to https://dashboard.stripe.com and create (or log into) your account.

---

## 2. Create Products and Prices

In the Stripe Dashboard → **Products** → **Add product**, create three products:

### Essential — €49/month
- Name: `TownsHub Essential`
- Description: Up to 20 rooms, core PMS features
- Pricing model: Recurring — **€49.00 / month**
- Currency: EUR

### Professional — €99/month
- Name: `TownsHub Professional`
- Description: Up to 75 rooms, F&B, analytics
- Pricing model: Recurring — **€99.00 / month**
- Currency: EUR

### Enterprise — €249/month
- Name: `TownsHub Enterprise`
- Description: Unlimited rooms, OTA channels, API access
- Pricing model: Recurring — **€249.00 / month**
- Currency: EUR

After saving each product, copy the **Price ID** (looks like `price_1AbCdEfGhIjKlMnO`).

---

## 3. Set environment variables

Add these to your Vercel project (Settings → Environment Variables) and to `.env.local`:

```
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...        # or pk_test_... for testing
STRIPE_SECRET_KEY=sk_live_...                  # server-side only
STRIPE_WEBHOOK_SECRET=whsec_...               # from step 4
STRIPE_PRICE_ESSENTIAL=price_...              # Essential price ID
STRIPE_PRICE_PROFESSIONAL=price_...           # Professional price ID
STRIPE_PRICE_ENTERPRISE=price_...            # Enterprise price ID
```

---

## 4. Set up the webhook

In Stripe Dashboard → **Developers** → **Webhooks** → **Add endpoint**:

- Endpoint URL: `https://your-vercel-domain.vercel.app/api/stripe?action=webhook`
- Listen to events:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

Click **Add endpoint**, then reveal and copy the **Signing secret** (`whsec_...`).  
Set it as `STRIPE_WEBHOOK_SECRET` in your environment.

### Local webhook testing with Stripe CLI

```bash
stripe listen --forward-to localhost:3000/api/stripe?action=webhook
```

This prints a temporary `whsec_...` to use as `STRIPE_WEBHOOK_SECRET` locally.

---

## 5. Set up the Customer Portal

In Stripe Dashboard → **Settings** → **Billing** → **Customer portal**:

- Enable the portal
- Configure which features to allow (cancel, update card, view invoices)
- Save settings

---

## 6. Test the flow

1. Start the dev server: `npm run dev`
2. Go to `/settings/billing`
3. Click **Upgrade** on any plan
4. Use Stripe test card `4242 4242 4242 4242` (any future expiry, any CVC)
5. Complete checkout — you'll be redirected back to `/settings/billing?success=1`
6. Verify the tenant's `subscription_tier` and `subscription_status` updated in Supabase

---

## Supabase columns required on `tenants` table

The webhook handler updates these columns (should already exist per schema):

| Column | Type | Description |
|---|---|---|
| `stripe_customer_id` | `text` | Stripe customer ID (`cus_...`) |
| `stripe_subscription_id` | `text` | Stripe subscription ID (`sub_...`) |
| `subscription_tier` | `text` | `essential` / `professional` / `enterprise` |
| `subscription_status` | `text` | `trialing` / `active` / `past_due` / `cancelled` |
| `trial_ends_at` | `timestamptz` | Trial expiry date |
