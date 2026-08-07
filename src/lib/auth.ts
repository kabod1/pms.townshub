import { supabase } from './supabase'
import type { User, Tenant } from '@/types'

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export type AuthError = 'no_session' | 'no_profile' | 'no_tenant' | 'timeout' | 'unknown'

export async function getCurrentUser(): Promise<{ user: User; tenant: Tenant }> {
  // Retry up to 3 times to handle Supabase replication lag after sign-up
  let lastErr: unknown = new Error('Could not load your profile. Please try again.')
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1200 * attempt))
    try {
      const result = await Promise.race([
        _fetchCurrentUser(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(Object.assign(new Error('Profile load timed out'), { step: 'timeout' })), 10_000)
        ),
      ])
      return result
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}

async function _fetchCurrentUser(): Promise<{ user: User; tenant: Tenant }> {
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
  if (authError || !authUser) {
    throw Object.assign(new Error('No authenticated session'), { step: 'no_session' })
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (profileError || !profile) {
    // Surface the specific error so callers can show a meaningful message
    const err = new Error(
      profileError?.message ?? 'User profile not found in database'
    )
    ;(err as any).step = 'no_profile'
    ;(err as any).detail = profileError?.code
    throw err
  }

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', profile.tenant_id)
    .single()

  if (tenantError || !tenant) {
    const err = new Error(
      tenantError?.message ?? 'Tenant record not found in database'
    )
    ;(err as any).step = 'no_tenant'
    ;(err as any).detail = tenantError?.code
    throw err
  }

  return { user: profile as User, tenant: tenant as Tenant }
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  })
  if (error) throw error
}

// Best-effort logging so real registration failures can be diagnosed from
// their actual client-side error instead of relying on screenshots. Never
// lets a logging failure affect the real error flow.
function logRegistrationFailure(email: string, step: string, errorMessage: string) {
  fetch('/api/track?action=registration-failure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      step,
      error_message: errorMessage,
      user_agent: navigator.userAgent,
    }),
  }).catch(() => {})
}

type RegisterParams = {
  hotelName: string
  email: string
  password: string
  fullName: string
  phone?: string
  city?: string
  country?: string
  mode?: 'hotel' | 'property' | 'both'
}

// Calls register_hotel with the access token straight off a signUp()/
// signInWithPassword() response, rather than via supabase.rpc() (which
// relies on the shared client's internal auth-state listener having
// already attached the new session to its default headers — not
// guaranteed to have landed yet). Retried up to 3 times: a user on a
// flaky mobile connection can lose this single request with no second
// chance otherwise. If a retry lands after an earlier attempt actually
// succeeded server-side (response just never made it back),
// register_hotel's own guard raises "Hotel already registered for this
// account" — treated here as success rather than a confusing error.
//
// Logs and builds the user-facing message BEFORE signOut() — on a
// connection already struggling enough to fail the RPC after 3 tries,
// signOut()'s own network call can throw too, which would otherwise abort
// this whole handler before the user ever saw an error or it got logged.
async function completeRegistration(
  session: { access_token: string },
  user: { id: string; email?: string },
  params: RegisterParams,
  slug: string,
) {
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt))
    try {
      const rpcRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/register_hotel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          p_hotel_name: params.hotelName,
          p_slug:       slug,
          p_email:      params.email,
          p_full_name:  params.fullName,
          p_phone:      params.phone ?? null,
          p_city:       params.city ?? null,
          p_country:    params.country ?? 'Cyprus',
          p_mode:       params.mode ?? 'hotel',
        }),
      })

      if (!rpcRes.ok) {
        const body = await rpcRes.json().catch(() => ({}))
        const message = body.message || `register_hotel failed with status ${rpcRes.status}`
        if (message.includes('already registered')) {
          return { user }
        }
        throw new Error(message)
      }

      return { user }
    } catch (e) {
      lastErr = e
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr)
  logRegistrationFailure(params.email, 'rpc', msg)
  try {
    await supabase.auth.signOut()
  } catch {
    // best-effort — a failed signOut shouldn't hide the real error below
  }
  throw new Error(
    msg.includes('function') || msg.includes('does not exist')
      ? 'Run register_hotel.sql in your Supabase SQL Editor first, then try again.'
      : msg.includes('relation')
      ? 'Run schema.sql in your Supabase SQL Editor first, then try again.'
      : `Setup failed: ${msg}`,
  )
}

export async function registerHotel(params: RegisterParams) {
  const slug = params.hotelName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
  })
  if (authError) {
    // Surface a friendlier message for the rate-limit case
    if (authError.message.toLowerCase().includes('after')) {
      throw new Error(authError.message)
    }
    // signUp() on an email with an existing CONFIRMED account fails
    // outright with "User already registered" — most often because an
    // earlier attempt with the SAME email+password already created the
    // auth account but register_hotel never completed for it. Rather than
    // just telling them to contact support, try signing in with the
    // credentials they just typed: if it's really the same person retrying,
    // this recovers and finishes registration right here with no human
    // needing to intervene. Only falls back to the "contact support"
    // message if that sign-in also fails (wrong password, or a genuinely
    // different, unrelated existing account).
    if (authError.message.toLowerCase().includes('already registered')) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: params.email,
        password: params.password,
      })
      if (signInError || !signInData.session || !signInData.user) {
        logRegistrationFailure(params.email, 'signup_already_registered', authError.message)
        throw new Error(
          'An account with this email already exists. If registration was never completed for it, ' +
          'please contact support to finish setting it up — otherwise try signing in instead.'
        )
      }
      return completeRegistration(signInData.session, signInData.user, params, slug)
    }
    throw authError
  }
  if (!authData.user) throw new Error('Registration failed — please try again.')

  // Supabase won't grant a fresh session for an email that already has an
  // auth.users row — including an orphaned one left by a previously failed
  // registration. Without a session, register_hotel's auth.uid() check will
  // always fail with a confusing "Not authenticated" error. Fail clearly
  // here instead, so a bad first attempt doesn't permanently trap the user.
  if (!authData.session) {
    logRegistrationFailure(params.email, 'no_session', 'signUp succeeded but returned no session')
    throw new Error(
      'An account with this email already exists but registration was never completed. ' +
      'Please contact support to finish setting up your account.'
    )
  }

  return completeRegistration(authData.session, authData.user, params, slug)
}
