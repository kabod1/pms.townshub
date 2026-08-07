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

export async function registerHotel(params: {
  hotelName: string
  email: string
  password: string
  fullName: string
  phone?: string
  city?: string
  country?: string
  mode?: 'hotel' | 'property' | 'both'
}) {
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

  try {
    // Call the RPC with the access token straight off the signUp() response,
    // rather than via supabase.rpc() (which relies on the shared client's
    // internal auth-state listener having already attached the new session
    // to its default headers). That listener update isn't guaranteed to have
    // landed by this point, so register_hotel could run unauthenticated even
    // though signUp() just handed back a perfectly valid session — an
    // intermittent failure that a manual fetch() with an explicit token
    // can't be exposed to.
    const rpcRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/register_hotel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${authData.session.access_token}`,
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
      throw new Error(body.message || `register_hotel failed with status ${rpcRes.status}`)
    }

    return { user: authData.user }
  } catch (err) {
    await supabase.auth.signOut()
    const msg = err instanceof Error ? err.message : String(err)
    logRegistrationFailure(params.email, 'rpc', msg)
    throw new Error(
      msg.includes('function') || msg.includes('does not exist')
        ? 'Run register_hotel.sql in your Supabase SQL Editor first, then try again.'
        : msg.includes('relation')
        ? 'Run schema.sql in your Supabase SQL Editor first, then try again.'
        : `Setup failed: ${msg}`,
    )
  }
}
