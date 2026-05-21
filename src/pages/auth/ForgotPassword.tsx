import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AuthLayout } from '@/layouts/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { resetPassword } from '@/lib/auth'
import toast from 'react-hot-toast'

const schema = z.object({ email: z.string().email('Invalid email address') })
type FormData = z.infer<typeof schema>

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      await resetPassword(data.email)
      setSent(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div>
        <h2 className="text-2xl font-bold text-body">Reset your password</h2>
        <p className="mt-1 text-sm text-subtext">
          We'll email you a link to reset your password.
        </p>

        {sent ? (
          <div className="mt-8 rounded-lg bg-green-50 border border-green-200 p-4">
            <p className="text-sm font-medium text-green-800">Check your email</p>
            <p className="mt-1 text-sm text-green-700">
              A password reset link has been sent. It may take a few minutes to arrive.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
            <Input
              label="Email address"
              type="email"
              placeholder="you@hotel.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Button type="submit" fullWidth loading={loading} size="lg">
              Send Reset Link
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-subtext">
          <Link to="/auth/login" className="font-medium text-blue hover:underline">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
