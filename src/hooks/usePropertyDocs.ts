import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { PropertyDocument, PropertyDocumentType } from '@/types/database'
import toast from 'react-hot-toast'

interface PropertyDocumentFilters {
  unit_id?: string
  lease_id?: string
  property_id?: string
  document_type?: PropertyDocumentType
}

export function usePropertyDocuments(filters?: PropertyDocumentFilters) {
  const { tenant } = useAuthStore()

  return useQuery({
    queryKey: ['property-documents', tenant?.id, filters],
    enabled: !!tenant,
    queryFn: async () => {
      const tenantId = useAuthStore.getState().tenant?.id
      if (!tenantId) return []

      let query = supabase
        .from('property_documents')
        .select('*, property:properties(name), unit:units(unit_number)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (filters?.unit_id) query = query.eq('unit_id', filters.unit_id)
      if (filters?.lease_id) query = query.eq('lease_id', filters.lease_id)
      if (filters?.property_id) query = query.eq('property_id', filters.property_id)
      if (filters?.document_type) query = query.eq('document_type', filters.document_type)

      const { data, error } = await query
      if (error) {
        // fallback without join
        let fallback = supabase
          .from('property_documents')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
        if (filters?.unit_id) fallback = fallback.eq('unit_id', filters.unit_id)
        if (filters?.lease_id) fallback = fallback.eq('lease_id', filters.lease_id)
        if (filters?.property_id) fallback = fallback.eq('property_id', filters.property_id)
        if (filters?.document_type) fallback = fallback.eq('document_type', filters.document_type)
        const { data: fallbackData, error: fallbackError } = await fallback
        if (fallbackError) throw fallbackError
        return (fallbackData ?? []) as PropertyDocument[]
      }
      return (data ?? []) as PropertyDocument[]
    },
  })
}

interface UploadPropertyDocumentInput {
  title: string
  document_type: PropertyDocumentType
  file_url: string
  property_id?: string | null
  unit_id?: string | null
  lease_id?: string | null
  property_tenant_id?: string | null
  owner_id?: string | null
  expiry_date?: string | null
  notes?: string | null
  file_size?: number | null
  file_type?: string | null
}

export function useUploadPropertyDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UploadPropertyDocumentInput) => {
      const tenant = useAuthStore.getState().tenant
      if (!tenant) throw new Error('Not authenticated — please refresh and try again')

      const { error } = await supabase.from('property_documents').insert({
        ...input,
        tenant_id: tenant.id,
        uploaded_by: null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-documents'] })
      toast.success('Document saved successfully')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
