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
        const result = await getCurrentUser()
        if (mounted && result) {
          setAuth(result.user, result.tenant)
          queryClient.invalidateQueries()
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
