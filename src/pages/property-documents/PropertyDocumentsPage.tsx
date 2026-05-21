import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import {
  FolderOpen,
  Plus,
  X,
  Search,
  Download,
  AlertTriangle,
} from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { usePropertyDocuments, useUploadPropertyDocument } from '@/hooks/usePropertyDocs'
import { useProperties, useUnits } from '@/hooks/useProperties'
import type { PropertyDocumentType } from '@/types/database'

// ─── Document type badge ──────────────────────────────────────────────────────

const DOC_TYPE_COLORS: Partial<Record<PropertyDocumentType, string>> = {
  lease_agreement: 'bg-blue-100 text-blue-800',
  inspection_report: 'bg-teal-100 text-teal-800',
  id_document: 'bg-purple-100 text-purple-800',
  insurance: 'bg-green-100 text-green-800',
  title_deed: 'bg-amber-100 text-amber-800',
  utility_bill: 'bg-yellow-100 text-yellow-800',
  inventory: 'bg-cyan-100 text-cyan-800',
  other: 'bg-gray-100 text-gray-700',
}

function DocTypeBadge({ type }: { type: PropertyDocumentType }) {
  const style = DOC_TYPE_COLORS[type] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${style}`}>
      {type.replace(/_/g, ' ')}
    </span>
  )
}

// ─── Document type options ────────────────────────────────────────────────────

const DOC_TYPES: PropertyDocumentType[] = [
  'lease_agreement','inventory','inspection_report','id_document','proof_of_income',
  'reference_letter','insurance','title_deed','planning_permission','certificate_of_occupancy',
  'utility_bill','correspondence','other',
]

// ─── Upload Modal ─────────────────────────────────────────────────────────────

interface UploadFormValues {
  title: string
  document_type: PropertyDocumentType
  file_url: string
  property_id: string
  unit_id: string
  lease_id: string
  expiry_date: string
  notes: string
}

function UploadModal({ onClose }: { onClose: () => void }) {
  const { data: properties = [] } = useProperties()
  const { data: units = [] } = useUnits()
  const { mutate: upload, isPending } = useUploadPropertyDocument()
  const { register, handleSubmit, formState: { errors } } = useForm<UploadFormValues>({
    defaultValues: { document_type: 'other' },
  })

  const onSubmit = (values: UploadFormValues) => {
    upload(
      {
        title: values.title,
        document_type: values.document_type,
        file_url: values.file_url,
        property_id: values.property_id || null,
        unit_id: values.unit_id || null,
        lease_id: values.lease_id || null,
        expiry_date: values.expiry_date || null,
        notes: values.notes || null,
        file_size: null,
        file_type: null,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-mid px-6 py-4">
          <h2 className="text-base font-semibold text-body">Upload Document</h2>
          <button onClick={onClose} className="text-subtext hover:text-body">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[80vh] overflow-y-auto space-y-4 p-6">
          <Input
            label="Title"
            placeholder="Document title"
            {...register('title', { required: 'Title is required' })}
            error={errors.title?.message}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-body">Document Type</label>
            <select
              className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              {...register('document_type')}
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-body">File URL</label>
            <input
              type="url"
              placeholder="https://..."
              className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              {...register('file_url', { required: 'File URL is required' })}
            />
            <p className="mt-1 text-xs text-subtext">Paste the document URL (Supabase Storage, Google Drive, etc.)</p>
            {errors.file_url && <p className="mt-1 text-xs text-red-600">{errors.file_url.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-body">Property</label>
              <select
                className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none"
                {...register('property_id')}
              >
                <option value="">None</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-body">Unit</label>
              <select
                className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none"
                {...register('unit_id')}
              >
                <option value="">None</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.unit_number}</option>
                ))}
              </select>
            </div>
          </div>

          <Input
            label="Lease ID (optional)"
            placeholder="Leave blank if N/A"
            {...register('lease_id')}
          />

          <Input
            label="Expiry Date"
            type="date"
            {...register('expiry_date')}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-body">Notes</label>
            <textarea
              rows={2}
              className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue-500 focus:outline-none"
              placeholder="Optional notes..."
              {...register('notes')}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" fullWidth loading={isPending}>
              Save Document
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PropertyDocumentsPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<PropertyDocumentType | ''>('')
  const [propertyFilter, setPropertyFilter] = useState('')
  const [showModal, setShowModal] = useState(false)

  const { data: documents = [], isLoading } = usePropertyDocuments({
    document_type: typeFilter || undefined,
    property_id: propertyFilter || undefined,
  })
  const { data: properties = [] } = useProperties()

  const filtered = useMemo(() => {
    if (!search.trim()) return documents
    const q = search.toLowerCase()
    return documents.filter((d) => d.title.toLowerCase().includes(q))
  }, [documents, search])

  // Check if expiry within 30 days
  const isExpiringSoon = (expiryDate: string | null) => {
    if (!expiryDate) return false
    const diff = new Date(expiryDate).getTime() - Date.now()
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-body">Property Documents</h1>
            <p className="mt-0.5 text-sm text-subtext">Manage leases, inspections, and property documents</p>
          </div>
          <Button onClick={() => setShowModal(true)}>
            <Plus size={15} />
            Upload Document
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtext" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents..."
              className="rounded-lg border border-mid bg-white pl-9 pr-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as PropertyDocumentType | '')}
            className="rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Types</option>
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Documents table */}
        <div className="overflow-x-auto rounded-xl border border-mid bg-white shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-sm text-subtext">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-subtext">
              <FolderOpen size={40} className="mb-3 opacity-30" />
              <p className="text-sm">No documents found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mid bg-light text-left text-xs font-medium text-subtext uppercase tracking-wide">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Property / Unit</th>
                  <th className="px-4 py-3">Expiry</th>
                  <th className="px-4 py-3">Uploaded</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-mid">
                {filtered.map((doc) => {
                  const expiring = isExpiringSoon(doc.expiry_date)
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const property = (doc as any).property as { name: string } | undefined
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const unit = (doc as any).unit as { unit_number: string } | undefined

                  return (
                    <tr key={doc.id} className="hover:bg-light/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-body">{doc.title}</td>
                      <td className="px-4 py-3">
                        <DocTypeBadge type={doc.document_type} />
                      </td>
                      <td className="px-4 py-3 text-body text-xs">
                        {property?.name ?? '—'}
                        {unit ? ` / Unit ${unit.unit_number}` : ''}
                      </td>
                      <td className="px-4 py-3">
                        {doc.expiry_date ? (
                          <span className={`flex items-center gap-1 text-xs ${expiring ? 'text-amber-700 font-medium' : 'text-body'}`}>
                            {expiring && <AlertTriangle size={12} />}
                            {new Date(doc.expiry_date).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-subtext text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-subtext">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-mid px-2.5 py-1 text-xs font-medium text-body hover:bg-light transition-colors"
                        >
                          <Download size={12} />
                          Download
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && <UploadModal onClose={() => setShowModal(false)} />}
    </DashboardLayout>
  )
}
