import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Mail,
  User,
  AlertCircle,
  Key,
} from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useRenter, useDeleteRenter } from '@/hooks/useRenters'
import { useLeases } from '@/hooks/useLeases'
import { formatDate } from '@/lib/utils'

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between py-2 border-b border-light last:border-0">
      <span className="text-sm text-subtext">{label}</span>
      <span className="text-sm font-medium text-body">{value ?? '—'}</span>
    </div>
  )
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-800',
  expired: 'bg-amber-100 text-amber-800',
  terminated: 'bg-red-100 text-red-700',
  renewed: 'bg-blue-100 text-blue-800',
}

export default function RenterDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: renter, isLoading } = useRenter(id ?? '')
  const deleteRenter = useDeleteRenter()
  const { data: leases } = useLeases()

  const renterLeases = (leases ?? []).filter(
    (l) => l.property_tenant_id === id,
  )

  async function handleDelete() {
    if (!id) return
    await deleteRenter.mutateAsync(id)
    navigate('/renters')
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

  if (!renter) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-subtext">Renter not found.</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/renters')}>
              <ArrowLeft size={16} /> Back
            </Button>
            <div>
              <h1 className="text-xl font-bold text-body">
                {renter.first_name} {renter.last_name}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  label={renter.tenant_type === 'company' ? 'Company' : 'Individual'}
                  className={
                    renter.tenant_type === 'company'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-700'
                  }
                />
                {renter.company_name && (
                  <span className="text-sm text-subtext">{renter.company_name}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/renters/${id}/edit`)}
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

        {/* Contact */}
        <Card>
          <h2 className="text-sm font-semibold text-body mb-3 flex items-center gap-2">
            <Mail size={15} /> Contact Information
          </h2>
          <InfoRow label="Email" value={renter.email} />
          <InfoRow label="Phone" value={renter.phone} />
          <InfoRow label="Secondary Phone" value={renter.secondary_phone} />
          <InfoRow label="Address" value={renter.address} />
          <InfoRow label="City" value={renter.city} />
          <InfoRow label="Country" value={renter.country} />
        </Card>

        {/* Personal */}
        <Card>
          <h2 className="text-sm font-semibold text-body mb-3 flex items-center gap-2">
            <User size={15} /> Personal Details
          </h2>
          <InfoRow label="Nationality" value={renter.nationality} />
          <InfoRow label="Date of Birth" value={renter.date_of_birth ? formatDate(renter.date_of_birth) : null} />
          <InfoRow label="Employer" value={renter.employer} />
          <InfoRow label="ID Type" value={renter.id_type} />
          <InfoRow label="ID Number" value={renter.id_number} />
          <InfoRow label="ID Expiry" value={renter.id_expiry ? formatDate(renter.id_expiry) : null} />
        </Card>

        {/* Emergency Contact */}
        <Card>
          <h2 className="text-sm font-semibold text-body mb-3 flex items-center gap-2">
            <AlertCircle size={15} /> Emergency Contact
          </h2>
          <InfoRow label="Name" value={renter.emergency_contact_name} />
          <InfoRow label="Phone" value={renter.emergency_contact_phone} />
        </Card>

        {/* Tags */}
        {renter.tags && renter.tags.length > 0 && (
          <Card>
            <h2 className="text-sm font-semibold text-body mb-3">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {renter.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Notes */}
        {renter.notes && (
          <Card>
            <h2 className="text-sm font-semibold text-body mb-2">Notes</h2>
            <p className="text-sm text-body whitespace-pre-wrap">{renter.notes}</p>
          </Card>
        )}

        {/* Active Leases */}
        <Card>
          <h2 className="text-sm font-semibold text-body mb-3 flex items-center gap-2">
            <Key size={15} /> Leases
          </h2>
          {renterLeases.length === 0 ? (
            <p className="text-sm text-subtext">No leases found for this renter.</p>
          ) : (
            <div className="space-y-2">
              {renterLeases.map((lease) => (
                <button
                  key={lease.id}
                  onClick={() => navigate(`/leases/${lease.id}`)}
                  className="w-full flex items-center justify-between rounded-lg border border-mid px-4 py-3 text-left hover:bg-light transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-body">{lease.lease_reference}</p>
                    <p className="text-xs text-subtext">
                      {formatDate(lease.start_date)}
                      {lease.end_date ? ` — ${formatDate(lease.end_date)}` : ' (rolling)'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {lease.monthly_rent.toLocaleString()}
                    </span>
                    <Badge
                      label={lease.status}
                      className={STATUS_STYLES[lease.status] ?? 'bg-gray-100 text-gray-700'}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Renter"
        size="sm"
      >
        <p className="text-sm text-body mb-5">
          Are you sure you want to delete{' '}
          <strong>
            {renter.first_name} {renter.last_name}
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
            loading={deleteRenter.isPending}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
