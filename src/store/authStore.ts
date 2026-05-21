import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Tenant } from '@/types'

interface AuthState {
  user: User | null
  tenant: Tenant | null
  isLoading: boolean
  isInitialized: boolean
  setAuth: (user: User, tenant: Tenant) => void
  clearAuth: () => void
  setLoading: (loading: boolean) => void
  setInitialized: (initialized: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenant: null,
      isLoading: true,
      isInitialized: false,
      setAuth: (user, tenant) => set({ user, tenant }),
      clearAuth: () => set({ user: null, tenant: null }),
      setLoading: (isLoading) => set({ isLoading }),
      setInitialized: (isInitialized) => set({ isInitialized }),
    }),
    {
      name: 'townshub-auth',
      partialize: (state) => ({ user: state.user, tenant: state.tenant }),
    },
  ),
)
