import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Mail,
  Building2,
  CreditCard,
  Globe,
  Home,
} from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useOwner, useDeleteOwner } from '@/hooks/useOwners'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Property } from '@/types/database'

function maskIban(iban: string | null): string {
  if (!iban) return '—'
  if (iban.length <= 4) return iban
  return `${'•'.repeat(iban.length - 4)}${iban.slice(-4)}`
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between py-2 border-b border-light last:border-0">
      <span className="text-sm text-subtext">{label}</span>
      <span className="text-sm font-medium text-body">{value ?? '—'}</span>
    </div>
  )
}

export default function OwnerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: owner, isLoading } = useOwner(id ?? '')
  const deleteOwner = useDeleteOwner()

  const { tenant } = useAuthStore()
  const { data: properties } = useQuery({
    queryKey: ['properties-by-owner', id, tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, name, type, city, total_units')
        .eq('tenant_id', useAuthStore.getState().tenant!.id)
        .eq('owner_id', id!)
        .order('name')
      if (error) throw error
      return data as Pick<Property, 'id' | 'name' | 'type' | 'city' | 'total_units'>[]
    },
    enabled: !!tenant && !!id,
  })

  async function handleDelete() {
    if (!id) return
    await deleteOwner.mutateAsync(id)
    navigate('/owners')
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    )
  }

  if (!owner) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-subtext">Owner not found.</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/owners')}>
              <ArrowLeft size={16} /> Back
            </Button>
            <div>
              <h1 className="text-xl font-bold text-body">
                {owner.first_name} {owner.last_name}
              </h1>
              {owner.company_name && (
                <p className="text-sm text-subtext flex items-center gap-1">
                  <Building2 size={13} /> {owner.company_name}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/owners/${id}/edit`)}
            >
              <Edit2 size={15} /> Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 size={15} /> Delete
            </Button>
          </div>
        </div>

        {/* Contact Info */}
        <Card>
          <h2 className="text-sm font-semibold text-body mb-3 flex items-center gap-2">
            <Mail size={15} /> Contact Information
          </h2>
          <InfoRow label="Email" value={owner.email} />
          <InfoRow label="Phone" value={owner.phone} />
          <InfoRow label="Address" value={owner.address} />
          <InfoRow label="City" value={owner.city} />
          <InfoRow label="Country" value={owner.country} />
        </Card>

        {/* Banking */}
        <Card>
          <h2 className="text-sm font-semibold text-body mb-3 flex items-center gap-2">
            <CreditCard size={15} /> Banking Details
          </h2>
          <InfoRow label="Bank Name" value={owner.bank_name} />
          <InfoRow label="IBAN" value={maskIban(owner.bank_iban)} />
          <InfoRow label="SWIFT / BIC" value={owner.bank_swift} />
          <InfoRow label="Tax Number" value={owner.tax_number} />
          <InfoRow label="VAT Number" value={owner.vat_number} />
        </Card>

        {/* Management */}
        <Card>
          <h2 className="text-sm font-semibold text-body mb-3 flex items-center gap-2">
            <Globe size={15} /> Management
          </h2>
          <InfoRow
            label="Management Fee"
            value={
              owner.management_fee_type === 'percentage'
                ? `${owner.management_fee_rate}%`
                : `${owner.management_fee_rate} (fixed)`
            }
          />
          <div className="flex justify-between py-2 border-b border-light">
            <span className="text-sm text-subtext">Portal Access</span>
            {owner.portal_access ? (
              <Badge label="Active" className="bg-green-100 text-green-800" />
            ) : (
              <Badge label="None" className="bg-gray-100 text-gray-500" />
            )}
          </div>
          {owner.portal_access && (
            <InfoRow label="Portal Email" value={owner.portal_email} />
          )}
          {owner.notes && (
            <div className="pt-3">
              <p className="text-xs text-subtext mb-1">Notes</p>
              <p className="text-sm text-body whitespace-pre-wrap">{owner.notes}</p>
            </div>
          )}
        </Card>

        {/* Properties */}
        <Card>
          <h2 className="text-sm font-semibold text-body mb-3 flex items-center gap-2">
            <Home size={15} /> Properties
          </h2>
          {!properties || properties.length === 0 ? (
            <p className="text-sm text-subtext">No properties assigned to this owner.</p>
          ) : (
            <div className="space-y-2">
              {properties.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/properties/${p.id}`)}
                  className="w-full flex items-center justify-between rounded-lg border border-mid px-4 py-3 text-left hover:bg-light transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-body">{p.name}</p>
                    <p className="text-xs text-subtext capitalize">
                      {p.type.replace('_', ' ')} — {p.city}
                    </p>
                  </div>
                  <span className="text-xs text-subtext">{p.total_units} units</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Owner"
        size="sm"
      >
        <p className="text-sm text-body mb-5">
          Are you sure you want to delete{' '}
          <strong>
            {owner.first_name} {owner.last_name}
          </strong>
          ? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={deleteOwner.isPending}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
