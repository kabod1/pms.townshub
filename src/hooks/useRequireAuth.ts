import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import type { UserRole } from '@/types'
import { hasRole } from '@/lib/permissions'

export function useRequireAuth(requiredRole?: UserRole) {
  const { user, isInitialized, isLoading } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isInitialized || isLoading) return
    if (!user) {
      navigate('/auth/login', { replace: true })
      return
    }
    if (requiredRole && !hasRole(user.role, requiredRole)) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, isInitialized, isLoading, requiredRole, navigate])

  return { user }
}
