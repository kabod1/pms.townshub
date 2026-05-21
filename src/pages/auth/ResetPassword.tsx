import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
})
type FormData = z.infer<typeof schema>

export default function ResetPassword() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    // Check if there's already an active recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true)
        setChecking(false)
      }
    })

    // Also listen for the PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true)
        setChecking(false)
      }
    })

    // Stop showing spinner after 3s regardless
    const timeout = setTimeout(() => setChecking(false), 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: data.password })
      if (error) throw error
      toast.success('Password updated! Taking you to the dashboard…')
      setTimeout(() => navigate('/dashboard', { replace: true }), 1500)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/logo.jpeg" alt="Townshub" className="h-16 w-auto object-contain rounded-xl" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 text-center">Set new password</h2>
        <p className="mt-1 text-sm text-gray-500 text-center">Choose a strong password for your account.</p>

        <div className="mt-8">
          {checking ? (
            <div className="text-center py-6">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Verifying reset link…</p>
            </div>
          ) : !ready ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-center">
              <p className="text-sm font-medium text-red-800">Reset link expired or invalid</p>
              <p className="mt-1 text-xs text-red-600">Please request a new password reset link.</p>
              <button
                onClick={() => navigate('/auth/forgot-password')}
                className="mt-3 text-sm font-semibold text-red-700 underline"
              >
                Request new link
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="New password"
                type="password"
                placeholder="At least 8 characters"
                error={errors.password?.message}
                {...register('password')}
              />
              <Input
                label="Confirm new password"
                type="password"
                placeholder="Repeat your password"
                error={errors.confirm?.message}
                {...register('confirm')}
              />
              <Button type="submit" fullWidth loading={loading} size="lg">
                Update Password
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
