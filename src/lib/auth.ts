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

  try {
    const { error: rpcError } = await supabase.rpc('register_hotel', {
      p_hotel_name: params.hotelName,
      p_slug:       slug,
      p_email:      params.email,
      p_full_name:  params.fullName,
      p_phone:      params.phone ?? null,
      p_city:       params.city ?? null,
      p_country:    params.country ?? 'Cyprus',
      p_mode:       params.mode ?? 'hotel',
    })

    if (rpcError) throw new Error(rpcError.message)

    return { user: authData.user }
  } catch (err) {
    await supabase.auth.signOut()
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      msg.includes('function') || msg.includes('does not exist')
        ? 'Run register_hotel.sql in your Supabase SQL Editor first, then try again.'
        : msg.includes('relation')
        ? 'Run schema.sql in your Supabase SQL Editor first, then try again.'
        : `Setup failed: ${msg}`,
    )
  }
}
