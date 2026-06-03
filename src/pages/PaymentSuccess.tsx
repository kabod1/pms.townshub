import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2, Hotel } from 'lucide-react'

type State = 'loading' | 'success' | 'already_paid' | 'error'

export default function PaymentSuccess() {
  const [params] = useSearchParams()
  const sessionId = params.get('session_id') ?? ''
  const ref       = params.get('ref') ?? ''
  const type      = params.get('type') ?? ''  // 'invoice' | 'rent'

  const [state,  setState]  = useState<State>('loading')
  const [amount, setAmount] = useState<number | null>(null)
  const [error,  setError]  = useState('')

  useEffect(() => {
    if (!sessionId || !ref || !type) {
      setState('error')
      setError('Invalid payment link — missing parameters.')
      return
    }

    fetch(`/api/stripe?action=confirm-payment&session_id=${sessionId}&ref=${ref}&type=${type}`)
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? 'Payment confirmation failed')
        if (body.alreadyPaid) {
          setState('already_paid')
        } else {
          setState('success')
          setAmount(body.amount ?? null)
        }
      })
      .catch((err) => {
        setState('error')
        setError(err.message ?? 'Something went wrong')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const label = type === 'rent' ? 'rent payment' : 'invoice'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-[#0F2138] flex items-center justify-center">
          <Hotel size={20} className="text-white" />
        </div>
        <span className="font-bold text-xl text-[#0F2138]">TownsHub</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center space-y-4">
        {state === 'loading' && (
          <>
            <Loader2 size={40} className="mx-auto text-[#D4A843] animate-spin" />
            <p className="text-gray-600 font-medium">Confirming your payment…</p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle size={48} className="mx-auto text-green-500" />
            <h1 className="text-xl font-bold text-gray-900">Payment confirmed!</h1>
            {amount !== null && (
              <p className="text-3xl font-black text-[#0F2138]">
                €{amount.toFixed(2)}
              </p>
            )}
            <p className="text-sm text-gray-500">
              Your {label} has been paid and recorded. Thank you!
            </p>
            <p className="text-xs text-gray-400">
              You will receive a confirmation email from Stripe shortly.
            </p>
          </>
        )}

        {state === 'already_paid' && (
          <>
            <CheckCircle size={48} className="mx-auto text-blue-400" />
            <h1 className="text-xl font-bold text-gray-900">Already paid</h1>
            <p className="text-sm text-gray-500">
              This {label} was already marked as paid. No charge was made.
            </p>
          </>
        )}

        {state === 'error' && (
          <>
            <XCircle size={48} className="mx-auto text-red-400" />
            <h1 className="text-xl font-bold text-gray-900">Something went wrong</h1>
            <p className="text-sm text-gray-500">{error}</p>
            <p className="text-xs text-gray-400">
              If you were charged, please contact the property and reference your Stripe receipt.
            </p>
          </>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Powered by <a href="https://pms.townshub.com" className="underline">TownsHub PMS</a> · Payments processed by Stripe
      </p>
    </div>
  )
}

export function PaymentCancelled() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="mb-8 flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-[#0F2138] flex items-center justify-center">
          <Hotel size={20} className="text-white" />
        </div>
        <span className="font-bold text-xl text-[#0F2138]">TownsHub</span>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center space-y-4">
        <XCircle size={48} className="mx-auto text-gray-300" />
        <h1 className="text-xl font-bold text-gray-900">Payment cancelled</h1>
        <p className="text-sm text-gray-500">
          You cancelled the payment. No charge was made. Please contact the property if you need a new payment link.
        </p>
      </div>
    </div>
  )
}
