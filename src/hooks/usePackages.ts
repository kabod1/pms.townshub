import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Package } from '@/types'
import toast from 'react-hot-toast'

type PackageInput = Omit<Package, 'id' | 'tenant_id' | 'created_at'>

export function usePackages() {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['packages', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('sort_order')
      if (error) throw error
      return data as Package[]
    },
    enabled: !!tenant,
  })
}

export function useCreatePackage() {
  const { tenant } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: PackageInput) => {
      const { error } = await supabase
        .from('packages')
        .insert({ ...input, tenant_id: tenant!.id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] })
      toast.success('Package created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdatePackage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<PackageInput> & { id: string }) => {
      const { error } = await supabase.from('packages').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] })
      toast.success('Package updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
