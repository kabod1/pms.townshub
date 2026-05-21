import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useCreateGuest } from '@/hooks/useGuests'

const schema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  nationality: z.string().optional(),
  date_of_birth: z.string().optional(),
  id_type: z.enum(['passport', 'national_id', 'driving_licence', 'other']).optional(),
  id_number: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  postal_code: z.string().optional(),
  company_name: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const ID_TYPE_OPTIONS = [
  { value: '', label: '— Select —' },
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'driving_licence', label: 'Driving Licence' },
  { value: 'other', label: 'Other' },
]

export default function NewGuest() {
  const navigate = useNavigate()
  const createGuest = useCreateGuest()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    const payload = {
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email || null,
      phone: data.phone || null,
      nationality: data.nationality || null,
      date_of_birth: data.date_of_birth || null,
      id_type: data.id_type || null,
      id_number: data.id_number || null,
      address: data.address || null,
      city: data.city || null,
      country: data.country || null,
      postal_code: data.postal_code || null,
      company_name: data.company_name || null,
      notes: data.notes || null,
    }
    const guest = await createGuest.mutateAsync(payload)
    navigate(`/guests/${guest.id}`)
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/guests')}>
            <ArrowLeft size={16} /> Back
          </Button>
          <h1 className="text-xl font-bold text-body">Add New Guest</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold text-body mb-4">Personal Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input label="First Name *" {...register('first_name')} error={errors.first_name?.message} />
              <Input label="Last Name *" {...register('last_name')} error={errors.last_name?.message} />
              <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
              <Input label="Phone" {...register('phone')} />
              <Input label="Nationality" {...register('nationality')} />
              <Input label="Date of Birth" type="date" {...register('date_of_birth')} />
              <Select label="ID Type" options={ID_TYPE_OPTIONS} {...register('id_type')} />
              <Input label="ID / Passport Number" {...register('id_number')} />
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-body mb-4">Address</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Street Address" className="col-span-2" {...register('address')} />
              <Input label="City" {...register('city')} />
              <Input label="Country" {...register('country')} />
              <Input label="Postal Code" {...register('postal_code')} />
              <Input label="Company" {...register('company_name')} />
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-body mb-3">Notes</h2>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Any special preferences or notes..."
              className="w-full rounded-lg border border-mid px-3 py-2 text-sm text-body focus:outline-none focus:ring-2 focus:ring-gold resize-none"
            />
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => navigate('/guests')}>Cancel</Button>
            <Button type="submit" loading={createGuest.isPending}>Save Guest</Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
