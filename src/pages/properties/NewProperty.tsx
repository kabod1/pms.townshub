import { useState, KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, X } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useCreateProperty } from '@/hooks/useProperties'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['residential', 'commercial', 'mixed_use', 'land']),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  district: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  postal_code: z.string().optional(),
  total_units: z.coerce.number().int().min(1, 'Must be at least 1'),
  year_built: z.coerce.number().int().min(1800).max(2100).optional().or(z.literal('')),
  total_area_sqm: z.coerce.number().min(0).optional().or(z.literal('')),
  description: z.string().optional(),
  owner_id: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function NewProperty() {
  const navigate = useNavigate()
  const createProperty = useCreateProperty()
  const [amenities, setAmenities] = useState<string[]>([])
  const [amenityInput, setAmenityInput] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'residential',
      country: 'Cyprus',
      total_units: 1,
    },
  })

  function addAmenity() {
    const trimmed = amenityInput.trim()
    if (trimmed && !amenities.includes(trimmed)) {
      setAmenities((prev) => [...prev, trimmed])
    }
    setAmenityInput('')
  }

  function handleAmenityKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addAmenity()
    }
  }

  function removeAmenity(amenity: string) {
    setAmenities((prev) => prev.filter((a) => a !== amenity))
  }

  async function onSubmit(values: FormValues) {
    await createProperty.mutateAsync({
      name: values.name,
      type: values.type,
      address: values.address,
      city: values.city,
      district: values.district || null,
      country: values.country,
      postal_code: values.postal_code || null,
      total_units: values.total_units,
      year_built: values.year_built !== '' && values.year_built != null ? Number(values.year_built) : null,
      total_area_sqm: values.total_area_sqm !== '' && values.total_area_sqm != null ? Number(values.total_area_sqm) : null,
      description: values.description || null,
      owner_id: values.owner_id || null,
      amenities,
      photos: [],
      documents: [],
      latitude: null,
      longitude: null,
      is_active: true,
    })
    navigate('/properties')
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/properties')}
            className="rounded-lg p-1.5 text-subtext hover:bg-light transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-body">Add Property</h1>
            <p className="text-sm text-subtext mt-0.5">Fill in the details below</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic info */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5 space-y-4">
            <h2 className="text-sm font-semibold text-body">Basic Information</h2>

            <Input
              label="Property Name"
              placeholder="e.g. Sunrise Apartments"
              error={errors.name?.message}
              {...register('name')}
            />

            <div>
              <label className="text-sm font-medium text-body">Type</label>
              <select
                className="mt-1 w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
                {...register('type')}
              >
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="mixed_use">Mixed Use</option>
                <option value="land">Land</option>
              </select>
              {errors.type && <p className="mt-1 text-xs text-red-600">{errors.type.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-body block mb-1">Description</label>
              <textarea
                rows={3}
                placeholder="Brief description of the property…"
                className="w-full rounded-lg border border-mid px-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
                {...register('description')}
              />
            </div>
          </div>

          {/* Location */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5 space-y-4">
            <h2 className="text-sm font-semibold text-body">Location</h2>

            <Input
              label="Address"
              placeholder="123 Main Street"
              error={errors.address?.message}
              {...register('address')}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="City"
                placeholder="Limassol"
                error={errors.city?.message}
                {...register('city')}
              />
              <Input
                label="District"
                placeholder="Limassol District"
                error={errors.district?.message}
                {...register('district')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Country"
                placeholder="Cyprus"
                error={errors.country?.message}
                {...register('country')}
              />
              <Input
                label="Postal Code"
                placeholder="3025"
                error={errors.postal_code?.message}
                {...register('postal_code')}
              />
            </div>
          </div>

          {/* Property details */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5 space-y-4">
            <h2 className="text-sm font-semibold text-body">Property Details</h2>

            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Total Units"
                type="number"
                min={1}
                error={errors.total_units?.message}
                {...register('total_units')}
              />
              <Input
                label="Year Built"
                type="number"
                placeholder="2005"
                error={errors.year_built?.message}
                {...register('year_built')}
              />
              <Input
                label="Total Area (m²)"
                type="number"
                placeholder="500"
                error={errors.total_area_sqm?.message}
                {...register('total_area_sqm')}
              />
            </div>

            {/* Amenities */}
            <div>
              <label className="text-sm font-medium text-body block mb-1">Amenities</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={amenityInput}
                  onChange={(e) => setAmenityInput(e.target.value)}
                  onKeyDown={handleAmenityKeyDown}
                  placeholder="Type and press Enter to add…"
                  className="flex-1 rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
                />
                <Button type="button" variant="outline" size="md" onClick={addAmenity}>
                  Add
                </Button>
              </div>
              {amenities.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {amenities.map((amenity) => (
                    <span
                      key={amenity}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                    >
                      {amenity}
                      <button
                        type="button"
                        onClick={() => removeAmenity(amenity)}
                        className="ml-0.5 hover:text-blue-900"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Owner */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5 space-y-4">
            <h2 className="text-sm font-semibold text-body">Ownership</h2>
            <Input
              label="Owner ID (optional)"
              placeholder="UUID of property owner"
              hint="You can assign an owner after creation from the Owners section."
              error={errors.owner_id?.message}
              {...register('owner_id')}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pb-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/properties')}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting || createProperty.isPending}>
              Create Property
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
