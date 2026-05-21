import { useState, KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, X } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useCreateUnit, useProperties } from '@/hooks/useProperties'

const schema = z.object({
  property_id: z.string().min(1, 'Property is required'),
  unit_number: z.string().min(1, 'Unit number is required'),
  floor: z.coerce.number().int().optional().or(z.literal('')),
  type: z.enum([
    'apartment', 'studio', 'villa', 'penthouse', 'maisonette',
    'room', 'office', 'retail', 'warehouse', 'industrial',
    'restaurant', 'desk', 'other',
  ]),
  area_sqm: z.coerce.number().min(0).optional().or(z.literal('')),
  bedrooms: z.coerce.number().int().min(0),
  bathrooms: z.coerce.number().int().min(0),
  parking_spaces: z.coerce.number().int().min(0),
  furnished: z.enum(['furnished', 'semi_furnished', 'unfurnished']),
  market_rent: z.coerce.number().min(0).optional().or(z.literal('')),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function NewUnit() {
  const navigate = useNavigate()
  const createUnit = useCreateUnit()
  const { data: properties = [] } = useProperties()

  const [features, setFeatures] = useState<string[]>([])
  const [featureInput, setFeatureInput] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'apartment',
      furnished: 'unfurnished',
      bedrooms: 0,
      bathrooms: 1,
      parking_spaces: 0,
    },
  })

  function addFeature() {
    const trimmed = featureInput.trim()
    if (trimmed && !features.includes(trimmed)) {
      setFeatures((prev) => [...prev, trimmed])
    }
    setFeatureInput('')
  }

  function handleFeatureKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addFeature()
    }
  }

  function removeFeature(feature: string) {
    setFeatures((prev) => prev.filter((f) => f !== feature))
  }

  async function onSubmit(values: FormValues) {
    await createUnit.mutateAsync({
      property_id: values.property_id,
      unit_number: values.unit_number,
      floor: values.floor !== '' && values.floor != null ? Number(values.floor) : null,
      type: values.type,
      subtype: null,
      area_sqm: values.area_sqm !== '' && values.area_sqm != null ? Number(values.area_sqm) : null,
      bedrooms: values.bedrooms,
      bathrooms: values.bathrooms,
      parking_spaces: values.parking_spaces,
      furnished: values.furnished,
      status: 'vacant',
      market_rent: values.market_rent !== '' && values.market_rent != null ? Number(values.market_rent) : null,
      features,
      photos: [],
      notes: values.notes || null,
      owner_id: null,
      is_active: true,
    })
    navigate('/units')
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/units')}
            className="rounded-lg p-1.5 text-subtext hover:bg-light transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-body">Add Unit</h1>
            <p className="text-sm text-subtext mt-0.5">Fill in the unit details below</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Property + basic */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5 space-y-4">
            <h2 className="text-sm font-semibold text-body">Basic Information</h2>

            <div>
              <label className="text-sm font-medium text-body block mb-1">
                Property <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
                {...register('property_id')}
              >
                <option value="">Select a property…</option>
                {properties.filter((p) => p.is_active).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.city}</option>
                ))}
              </select>
              {errors.property_id && (
                <p className="mt-1 text-xs text-red-600">{errors.property_id.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Unit Number"
                placeholder="e.g. A101"
                error={errors.unit_number?.message}
                {...register('unit_number')}
              />
              <Input
                label="Floor"
                type="number"
                placeholder="0"
                error={errors.floor?.message}
                {...register('floor')}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-body block mb-1">Type</label>
              <select
                className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
                {...register('type')}
              >
                <option value="apartment">Apartment</option>
                <option value="studio">Studio</option>
                <option value="villa">Villa</option>
                <option value="penthouse">Penthouse</option>
                <option value="maisonette">Maisonette</option>
                <option value="room">Room</option>
                <option value="office">Office</option>
                <option value="retail">Retail</option>
                <option value="warehouse">Warehouse</option>
                <option value="industrial">Industrial</option>
                <option value="restaurant">Restaurant</option>
                <option value="desk">Desk</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Specs */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5 space-y-4">
            <h2 className="text-sm font-semibold text-body">Specifications</h2>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Area (m²)"
                type="number"
                placeholder="80"
                error={errors.area_sqm?.message}
                {...register('area_sqm')}
              />
              <Input
                label="Market Rent (€)"
                type="number"
                placeholder="1200"
                error={errors.market_rent?.message}
                {...register('market_rent')}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Bedrooms"
                type="number"
                min={0}
                error={errors.bedrooms?.message}
                {...register('bedrooms')}
              />
              <Input
                label="Bathrooms"
                type="number"
                min={0}
                error={errors.bathrooms?.message}
                {...register('bathrooms')}
              />
              <Input
                label="Parking Spaces"
                type="number"
                min={0}
                error={errors.parking_spaces?.message}
                {...register('parking_spaces')}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-body block mb-1">Furnished</label>
              <select
                className="w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
                {...register('furnished')}
              >
                <option value="furnished">Furnished</option>
                <option value="semi_furnished">Semi Furnished</option>
                <option value="unfurnished">Unfurnished</option>
              </select>
            </div>
          </div>

          {/* Features + notes */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5 space-y-4">
            <h2 className="text-sm font-semibold text-body">Additional Details</h2>

            {/* Features tag input */}
            <div>
              <label className="text-sm font-medium text-body block mb-1">Features</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={featureInput}
                  onChange={(e) => setFeatureInput(e.target.value)}
                  onKeyDown={handleFeatureKeyDown}
                  placeholder="Type and press Enter to add…"
                  className="flex-1 rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
                />
                <Button type="button" variant="outline" size="md" onClick={addFeature}>
                  Add
                </Button>
              </div>
              {features.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {features.map((feature) => (
                    <span
                      key={feature}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                    >
                      {feature}
                      <button
                        type="button"
                        onClick={() => removeFeature(feature)}
                        className="ml-0.5 hover:text-blue-900"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-body block mb-1">Notes</label>
              <textarea
                rows={3}
                placeholder="Internal notes about this unit…"
                className="w-full rounded-lg border border-mid px-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
                {...register('notes')}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pb-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/units')}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting || createUnit.isPending}>
              Create Unit
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
