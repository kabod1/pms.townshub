import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AuthLayout } from '@/layouts/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { signIn, getCurrentUser } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormData = z.infer<typeof schema>

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      await signIn(data.email, data.password)
      const result = await getCurrentUser()
      setAuth(result.user, result.tenant)
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      const step = err?.step
      if (step === 'no_profile') {
        toast.error('Your user profile was not found. Please contact support — your account may need to be re-initialised.')
      } else if (step === 'no_tenant') {
        toast.error('Your hotel/property account was not found. Please contact support.')
      } else if (step === 'timeout') {
        toast.error('Profile load timed out. Please try again.')
      } else {
        toast.error(err instanceof Error ? err.message : 'Sign in failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div>
        <h2 className="text-2xl font-bold text-body">Welcome back</h2>
        <p className="mt-1 text-sm text-subtext">Sign in to your hotel dashboard</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
          <Input
            label="Email address"
            type="email"
            placeholder="you@hotel.com"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />

          <div className="flex items-center justify-end">
            <Link to="/auth/forgot-password" className="text-xs text-blue hover:underline">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" fullWidth loading={loading} size="lg">
            Sign In
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-subtext">
          New hotel?{' '}
          <Link to="/auth/register" className="font-medium text-blue hover:underline">
            Start your 30-day free trial
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
