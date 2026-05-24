import { useState, KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, X, Palette, Megaphone, Instagram, Facebook, Linkedin, Globe } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useCreateProperty } from '@/hooks/useProperties'

const LISTING_PLATFORMS = ['Airbnb', 'Booking.com', 'VRBO', 'Expedia', 'TripAdvisor', 'HomeAway', 'Direct']

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
  // Branding
  tagline: z.string().optional(),
  logo_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  primary_color: z.string().optional(),
  accent_color: z.string().optional(),
  website_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  // Marketing
  marketing_description: z.string().optional(),
  social_instagram: z.string().optional(),
  social_facebook: z.string().optional(),
  social_linkedin: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function NewProperty() {
  const navigate = useNavigate()
  const createProperty = useCreateProperty()
  const [amenities, setAmenities] = useState<string[]>([])
  const [amenityInput, setAmenityInput] = useState('')
  const [platforms, setPlatforms] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'residential',
      country: 'Cyprus',
      total_units: 1,
      primary_color: '#0B1F4B',
      accent_color: '#C9A84C',
    },
  })

  const primaryColor = watch('primary_color') ?? '#0B1F4B'
  const accentColor = watch('accent_color') ?? '#C9A84C'
  const logoUrl = watch('logo_url')

  function addAmenity() {
    const trimmed = amenityInput.trim()
    if (trimmed && !amenities.includes(trimmed)) setAmenities((p) => [...p, trimmed])
    setAmenityInput('')
  }

  function handleAmenityKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); addAmenity() }
  }

  function togglePlatform(p: string) {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])
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
      settings: {
        tagline: values.tagline || undefined,
        logo_url: values.logo_url || undefined,
        primary_color: values.primary_color || undefined,
        accent_color: values.accent_color || undefined,
        website_url: values.website_url || undefined,
        marketing_description: values.marketing_description || undefined,
        social_instagram: values.social_instagram || undefined,
        social_facebook: values.social_facebook || undefined,
        social_linkedin: values.social_linkedin || undefined,
        listing_platforms: platforms.length > 0 ? platforms : undefined,
      },
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

            <Input label="Address" placeholder="123 Main Street" error={errors.address?.message} {...register('address')} />

            <div className="grid grid-cols-2 gap-4">
              <Input label="City" placeholder="Limassol" error={errors.city?.message} {...register('city')} />
              <Input label="District" placeholder="Limassol District" {...register('district')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input label="Country" placeholder="Cyprus" error={errors.country?.message} {...register('country')} />
              <Input label="Postal Code" placeholder="3025" {...register('postal_code')} />
            </div>
          </div>

          {/* Property details */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5 space-y-4">
            <h2 className="text-sm font-semibold text-body">Property Details</h2>

            <div className="grid grid-cols-3 gap-4">
              <Input label="Total Units" type="number" min={1} error={errors.total_units?.message} {...register('total_units')} />
              <Input label="Year Built" type="number" placeholder="2005" {...register('year_built')} />
              <Input label="Total Area (m²)" type="number" placeholder="500" {...register('total_area_sqm')} />
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
                <Button type="button" variant="outline" size="md" onClick={addAmenity}>Add</Button>
              </div>
              {amenities.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {amenities.map((a) => (
                    <span key={a} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                      {a}
                      <button type="button" onClick={() => setAmenities((p) => p.filter((x) => x !== a))} className="ml-0.5 hover:text-blue-900">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Branding */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5 space-y-4">
            <h2 className="text-sm font-semibold text-body flex items-center gap-2">
              <Palette size={15} /> Brand Identity
            </h2>

            <Input label="Tagline" placeholder="Modern living in the heart of Limassol" {...register('tagline')} />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-body mb-1">Primary Colour</label>
                <div className="flex items-center gap-2">
                  <input type="color" {...register('primary_color')} className="h-9 w-14 rounded border border-mid cursor-pointer" />
                  <span className="flex-1 rounded-lg border border-mid px-3 py-2 text-sm text-body bg-light font-mono">{primaryColor}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-body mb-1">Accent Colour</label>
                <div className="flex items-center gap-2">
                  <input type="color" {...register('accent_color')} className="h-9 w-14 rounded border border-mid cursor-pointer" />
                  <span className="flex-1 rounded-lg border border-mid px-3 py-2 text-sm text-body bg-light font-mono">{accentColor}</span>
                </div>
              </div>
            </div>

            <Input
              label="Logo URL"
              placeholder="https://example.com/logo.png"
              error={errors.logo_url?.message}
              {...register('logo_url')}
            />
            {logoUrl && (
              <div>
                <p className="text-xs text-subtext mb-1">Preview:</p>
                <img src={logoUrl} alt="Logo preview" className="h-12 object-contain rounded border border-mid" />
              </div>
            )}

            <Input
              label="Website URL"
              placeholder="https://sunrise-apartments.com"
              error={errors.website_url?.message}
              {...register('website_url')}
            />

            {/* Colour preview */}
            <div className="rounded-lg p-4 flex items-center gap-3 transition-colors" style={{ backgroundColor: primaryColor }}>
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0" style={{ backgroundColor: accentColor }}>
                P
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Brand Preview</p>
                <p className="text-white/70 text-xs">Your property brand colours</p>
              </div>
            </div>
          </div>

          {/* Marketing */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5 space-y-4">
            <h2 className="text-sm font-semibold text-body flex items-center gap-2">
              <Megaphone size={15} /> Marketing
            </h2>

            <div>
              <label className="block text-sm font-medium text-body mb-1">Marketing Description</label>
              <textarea
                rows={4}
                placeholder="Compelling description for listings and marketing materials…"
                className="w-full rounded-lg border border-mid px-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue resize-none"
                {...register('marketing_description')}
              />
            </div>

            {/* Social links */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-subtext uppercase tracking-wide">Social Media</p>
              <div className="flex items-center gap-2">
                <Instagram size={16} className="text-pink-500 shrink-0" />
                <input
                  type="text"
                  placeholder="instagram.com/yourproperty"
                  className="flex-1 rounded-lg border border-mid px-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
                  {...register('social_instagram')}
                />
              </div>
              <div className="flex items-center gap-2">
                <Facebook size={16} className="text-blue-600 shrink-0" />
                <input
                  type="text"
                  placeholder="facebook.com/yourproperty"
                  className="flex-1 rounded-lg border border-mid px-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
                  {...register('social_facebook')}
                />
              </div>
              <div className="flex items-center gap-2">
                <Linkedin size={16} className="text-blue-700 shrink-0" />
                <input
                  type="text"
                  placeholder="linkedin.com/company/yourproperty"
                  className="flex-1 rounded-lg border border-mid px-3 py-2 text-sm text-body placeholder:text-subtext focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
                  {...register('social_linkedin')}
                />
              </div>
            </div>

            {/* Listing platforms */}
            <div>
              <p className="text-xs font-semibold text-subtext uppercase tracking-wide mb-2">Listing Platforms</p>
              <div className="flex flex-wrap gap-2">
                {LISTING_PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                      platforms.includes(p)
                        ? 'bg-navy text-white border-navy'
                        : 'bg-white text-body border-mid hover:border-navy hover:text-navy'
                    }`}
                  >
                    <Globe size={11} />
                    {p}
                  </button>
                ))}
              </div>
              {platforms.length > 0 && (
                <p className="text-xs text-subtext mt-2">Selected: {platforms.join(', ')}</p>
              )}
            </div>
          </div>

          {/* Ownership */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-5 space-y-4">
            <h2 className="text-sm font-semibold text-body">Ownership</h2>
            <Input
              label="Owner ID (optional)"
              placeholder="UUID of property owner"
              error={errors.owner_id?.message}
              {...register('owner_id')}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pb-6">
            <Button type="button" variant="outline" onClick={() => navigate('/properties')}>
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
