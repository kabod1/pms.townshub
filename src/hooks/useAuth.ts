import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const { user, tenant, isLoading, isInitialized, setAuth, clearAuth, setLoading, setInitialized } =
    useAuthStore()
  const queryClient = useQueryClient()

  useEffect(() => {
    let mounted = true

    async function init() {
      setLoading(true)
      try {
        const result = await getCurrentUser()
        if (mounted) {
          if (result) {
            setAuth(result.user, result.tenant)
          } else {
            clearAuth()
          }
        }
      } catch {
        if (mounted) clearAuth()
      } finally {
        if (mounted) {
          setLoading(false)
          setInitialized(true)
          // Invalidate all cached queries so any that fired before the Supabase
          // session was ready (returning empty due to RLS) refetch with valid auth.
          queryClient.invalidateQueries()
        }
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        if (mounted) { clearAuth(); queryClient.clear() }
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // signUp()/signInWithPassword() inside registerHotel() fire this
        // event the instant a session exists — before register_hotel has
        // necessarily finished creating the profile/tenant. On the register
        // page specifically, Register.tsx already fetches the profile
        // itself once registration actually completes, so reacting here too
        // is guaranteed-redundant: it doubles concurrent requests against an
        // already resource-constrained (Nano-tier) database on every single
        // registration attempt, for a fetch that's certain to fail (no
        // profile exists yet) and was previously an unhandled promise
        // rejection on top of that.
        if (window.location.pathname.startsWith('/auth/register')) return
        try {
          const result = await getCurrentUser()
          if (mounted && result) {
            setAuth(result.user, result.tenant)
            queryClient.invalidateQueries()
          }
        } catch {
          // no profile yet — registerHotel()'s own flow handles that case.
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [setAuth, clearAuth, setLoading, setInitialized, queryClient])

  return { user, tenant, isLoading, isInitialized }
}
