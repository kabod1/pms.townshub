import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Trash2, ShieldCheck } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useGuest } from '@/hooks/useGuests'
import { useBookings } from '@/hooks/useBookings'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency } from '@/lib/utils'
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from '@/lib/constants'
import type { Booking } from '@/types'
import toast from 'react-hot-toast'

export default function GuestProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: guest, isLoading, refetch } = useGuest(id!)
  const { data: bookings } = useBookings()
  const { user } = useAuthStore()
  const guestBookings = (bookings ?? []).filter((b) => b.guest_id === id)

  const [exportLoading, setExportLoading] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [consentLoading, setConsentLoading] = useState(false)

  const canManage = ['admin', 'manager'].includes(user?.role ?? '')

  async function handleExport() {
    setExportLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/gdpr?action=export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ guestId: id }),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `guest-data-${id}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Data exported')
    } catch {
      toast.error('Export failed')
    } finally {
      setExportLoading(false)
    }
  }

  async function handleDelete() {
    setDeleteLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/gdpr?action=delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ guestId: id }),
      })
      if (!res.ok) throw new Error('Delete failed')
      toast.success('Guest personal data removed')
      setDeleteOpen(false)
      navigate('/guests')
    } catch {
      toast.error('Delete failed')
    } finally {
      setDeleteLoading(false)
    }
  }

  async function toggleConsent(value: boolean) {
    if (!guest) return
    setConsentLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/gdpr?action=consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ guestId: id, consent: value }),
      })
      if (!res.ok) throw new Error()
      toast.success(value ? 'Marketing consent recorded' : 'Marketing consent withdrawn')
      refetch()
    } catch {
      toast.error('Failed to update consent')
    } finally {
      setConsentLoading(false)
    }
  }

  if (isLoading) return <DashboardLayout><LoadingSpinner fullPage /></DashboardLayout>
  if (!guest) return <DashboardLayout><p className="text-subtext">Guest not found.</p></DashboardLayout>

  const marketingConsent = (guest as any).marketing_consent as boolean | undefined

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/guests')}>
            <ArrowLeft size={16} /> Back
          </Button>
          <h1 className="text-xl font-bold text-body">{guest.first_name} {guest.last_name}</h1>
          <span className="text-sm text-subtext">· {guest.total_stays} stay(s)</span>

          {canManage && (
            <div className="ml-auto flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExport}
                disabled={exportLoading}
                title="Export guest data (GDPR Art. 20)"
              >
                <Download size={15} />
                {exportLoading ? 'Exporting…' : 'Export data'}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDeleteOpen(true)}
                title="Right to be Forgotten (GDPR Art. 17)"
              >
                <Trash2 size={15} />
                Delete data
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <h2 className="text-sm font-semibold text-body mb-3">Contact Details</h2>
            <dl className="space-y-1 text-sm">
              <div className="flex gap-2"><dt className="text-subtext w-24">Email</dt><dd>{guest.email ?? '—'}</dd></div>
              <div className="flex gap-2"><dt className="text-subtext w-24">Phone</dt><dd>{guest.phone ?? '—'}</dd></div>
              <div className="flex gap-2"><dt className="text-subtext w-24">Nationality</dt><dd>{guest.nationality ?? '—'}</dd></div>
              <div className="flex gap-2"><dt className="text-subtext w-24">Date of Birth</dt><dd>{guest.date_of_birth ? formatDate(guest.date_of_birth) : '—'}</dd></div>
              <div className="flex gap-2"><dt className="text-subtext w-24">ID / Passport</dt><dd>{guest.id_number ?? '—'}</dd></div>
              <div className="flex gap-2"><dt className="text-subtext w-24">Address</dt><dd>{guest.address ?? '—'}</dd></div>
            </dl>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-body mb-3">Notes</h2>
            <p className="text-sm">{guest.notes || <span className="italic text-subtext">No notes</span>}</p>
          </Card>
        </div>

        {/* GDPR consent panel */}
        {canManage && (
          <Card>
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="text-gold mt-0.5 shrink-0" />
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-body mb-1">GDPR — Marketing Consent</h2>
                <p className="text-xs text-subtext mb-3">
                  Record whether this guest has given explicit consent to receive marketing communications.
                  Only send marketing emails/SMS to guests with active consent.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleConsent(true)}
                    disabled={consentLoading || marketingConsent === true}
                    className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
                      marketingConsent === true
                        ? 'bg-green-600 text-white cursor-default'
                        : 'border border-green-600 text-green-700 hover:bg-green-50'
                    }`}
                  >
                    {marketingConsent === true ? 'Consent given' : 'Record consent'}
                  </button>
                  <button
                    onClick={() => toggleConsent(false)}
                    disabled={consentLoading || marketingConsent === false}
                    className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
                      marketingConsent === false
                        ? 'bg-red-600 text-white cursor-default'
                        : 'border border-red-400 text-red-600 hover:bg-red-50'
                    }`}
                  >
                    {marketingConsent === false ? 'Opted out' : 'Withdraw consent'}
                  </button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Stay history */}
        <Card padding={false}>
          <div className="px-5 py-4 border-b border-mid">
            <h2 className="text-sm font-semibold text-body">Stay History</h2>
          </div>
          {guestBookings.length === 0 ? (
            <p className="px-5 py-8 text-sm text-subtext text-center">No bookings on record</p>
          ) : (
            <div className="divide-y divide-mid">
              {guestBookings.map((b: Booking) => (
                <div
                  key={b.id}
                  className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-light"
                  onClick={() => navigate(`/bookings/${b.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium font-mono">{b.booking_reference}</p>
                    <p className="text-xs text-subtext">
                      {formatDate(b.check_in_date)} → {formatDate(b.check_out_date)} · Room {b.room?.number ?? '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{formatCurrency(b.total_amount)}</span>
                    <Badge label={BOOKING_STATUS_LABELS[b.status]} className={BOOKING_STATUS_COLORS[b.status]} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete guest personal data?"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            <p className="font-semibold mb-1">This action cannot be undone.</p>
            <p>
              All personal identifiers (name, email, phone, ID number, date of birth, address) will
              be permanently removed. Booking and invoice records are anonymised but retained for
              legal compliance (EU accounting rules require 7 years retention).
            </p>
          </div>
          <p className="text-sm text-subtext">
            Requested under GDPR Article 17 — Right to Erasure. A record of this action will be
            written to the audit log.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting…' : 'Yes, delete personal data'}
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
