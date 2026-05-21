import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const { user, tenant, isLoading, isInitialized, setAuth, clearAuth, setLoading, setInitialized } =
    useAuthStore()

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
        }
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        if (mounted) clearAuth()
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const result = await getCurrentUser()
        if (mounted && result) setAuth(result.user, result.tenant)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [setAuth, clearAuth, setLoading, setInitialized])

  return { user, tenant, isLoading, isInitialized }
}
