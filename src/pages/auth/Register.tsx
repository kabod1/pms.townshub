import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AuthLayout } from '@/layouts/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { registerHotel, getCurrentUser } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { Hotel, Home, Building2 } from 'lucide-react'
import { classNames } from '@/lib/utils'

type Mode = 'hotel' | 'property' | 'both'

const MODES: { value: Mode; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'hotel',
    label: 'Hotel / Resort',
    description: 'Manage rooms, bookings, guests & F&B',
    icon: <Hotel size={20} />,
  },
  {
    value: 'property',
    label: 'Property Management',
    description: 'Manage rental units, leases & owners',
    icon: <Home size={20} />,
  },
  {
    value: 'both',
    label: 'Hotel + Property',
    description: 'Full access to both platforms',
    icon: <Building2 size={20} />,
  },
]

const schema = z.object({
  hotelName:       z.string().min(2, 'Business name is required'),
  fullName:        z.string().min(2, 'Your name is required'),
  email:           z.string().email('Invalid email address'),
  password:        z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  phone:           z.string().optional(),
  city:            z.string().optional(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
type FormData = z.infer<typeof schema>

export default function Register() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<Mode>('hotel')

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      await registerHotel({ ...data, mode })

      try {
        const result = await getCurrentUser()
        setAuth(result.user, result.tenant)
        toast.success('Welcome to TownsHub PMS! Your 30-day trial has started.')
        navigate('/dashboard', { replace: true })
      } catch {
        // Profile created but not yet visible — send to login
        toast.success('Account created! Please sign in to continue.')
        navigate('/auth/login', { replace: true })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const namePlaceholder = mode === 'hotel' ? 'Grand Cyprus Hotel' : mode === 'property' ? 'Sunrise Properties Ltd' : 'Townshub Group'
  const nameLabel = mode === 'hotel' ? 'Hotel / Resort Name' : mode === 'property' ? 'Company / Property Name' : 'Business Name'

  return (
    <AuthLayout>
      <div>
        <h2 className="text-2xl font-bold text-body">Create your account</h2>
        <p className="mt-1 text-sm text-subtext">30-day free trial — no credit card required</p>

        {/* Mode selector */}
        <div className="mt-5 space-y-2">
          <p className="text-sm font-medium text-body">What are you managing?</p>
          <div className="grid gap-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className={classNames(
                  'flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors',
                  mode === m.value
                    ? 'border-gold bg-gold/5'
                    : 'border-mid bg-white hover:border-blue/40',
                )}
              >
                <span className={classNames('shrink-0', mode === m.value ? 'text-gold' : 'text-subtext')}>
                  {m.icon}
                </span>
                <div>
                  <p className={classNames('text-sm font-semibold', mode === m.value ? 'text-gold' : 'text-body')}>
                    {m.label}
                  </p>
                  <p className="text-xs text-subtext">{m.description}</p>
                </div>
                <span className={classNames(
                  'ml-auto h-4 w-4 shrink-0 rounded-full border-2 transition-colors',
                  mode === m.value ? 'border-gold bg-gold' : 'border-mid',
                )} />
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
          <Input
            label={nameLabel}
            placeholder={namePlaceholder}
            error={errors.hotelName?.message}
            {...register('hotelName')}
          />
          <Input
            label="Your Full Name"
            placeholder="Nikos Papadopoulos"
            error={errors.fullName?.message}
            {...register('fullName')}
          />
          <Input
            label="Email address"
            type="email"
            placeholder="admin@yourhotel.com"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone (optional)"
              type="tel"
              placeholder="+357 99 000000"
              {...register('phone')}
            />
            <Input
              label="City (optional)"
              placeholder="Nicosia"
              {...register('city')}
            />
          </div>
          <Input
            label="Password"
            type="password"
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Confirm Password"
            type="password"
            placeholder="Repeat password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <Button type="submit" fullWidth loading={loading} size="lg">
            Create Account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-subtext">
          Already have an account?{' '}
          <Link to="/auth/login" className="font-medium text-blue hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
