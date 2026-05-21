import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AuthLayout } from '@/layouts/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { registerHotel } from '@/lib/auth'
import { getCurrentUser } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

const schema = z.object({
  hotelName: z.string().min(2, 'Hotel name is required'),
  fullName: z.string().min(2, 'Your name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  phone: z.string().optional(),
  city: z.string().optional(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
type FormData = z.infer<typeof schema>

export default function Register() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      await registerHotel(data)
      const result = await getCurrentUser()
      if (result) {
        setAuth(result.user, result.tenant)
        toast.success('Welcome to Townshub PMS! Your 30-day trial has started.')
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div>
        <h2 className="text-2xl font-bold text-body">Register your hotel</h2>
        <p className="mt-1 text-sm text-subtext">30-day free trial — no credit card required</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <Input
            label="Hotel Name"
            placeholder="Grand Cyprus Hotel"
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
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Confirm Password"
            type="password"
            placeholder="Repeat password"
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
