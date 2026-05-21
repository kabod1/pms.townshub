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

export async function getCurrentUser(): Promise<{ user: User; tenant: Tenant } | null> {
  try {
    // 8-second hard timeout — prevents spinner hanging indefinitely
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000))

    const fetchUser = async () => {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      if (authError || !authUser) return null

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profileError || !profile) return null

      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', profile.tenant_id)
        .single()

      if (tenantError || !tenant) return null

      return { user: profile as User, tenant: tenant as Tenant }
    }

    return await Promise.race([fetchUser(), timeout])
  } catch {
    return null
  }
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
