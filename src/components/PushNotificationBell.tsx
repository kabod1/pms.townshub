import { useState, useEffect } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'
import { subscribeToPush, unsubscribeFromPush, getCurrentSubscription } from '@/lib/integrations/push'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type State = 'unsupported' | 'denied' | 'unsubscribed' | 'loading' | 'subscribed'

export function PushNotificationBell() {
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    getCurrentSubscription().then((sub) => {
      if (Notification.permission === 'denied') {
        setState('denied')
      } else {
        setState(sub ? 'subscribed' : 'unsubscribed')
      }
    })
  }, [])

  async function toggle() {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return toast.error('Not authenticated')

    if (state === 'subscribed') {
      setState('loading')
      const ok = await unsubscribeFromPush(token)
      setState(ok ? 'unsubscribed' : 'subscribed')
      if (ok) toast.success('Push notifications disabled')
      else toast.error('Failed to unsubscribe')
    } else {
      setState('loading')
      const ok = await subscribeToPush(token)
      if (ok) {
        setState('subscribed')
        toast.success('Push notifications enabled!')
      } else {
        const perm = Notification.permission
        setState(perm === 'denied' ? 'denied' : 'unsubscribed')
        if (perm === 'denied') {
          toast.error('Notifications blocked — allow them in browser settings')
        } else {
          toast.error('Could not enable notifications')
        }
      }
    }
  }

  if (state === 'unsupported') return null

  const icon =
    state === 'subscribed' ? <BellRing size={18} className="text-gold" /> :
    state === 'denied'     ? <BellOff size={18} className="text-red-400" /> :
    state === 'loading'    ? <Bell size={18} className="animate-pulse text-subtext" /> :
                             <Bell size={18} />

  const title =
    state === 'subscribed'   ? 'Push notifications ON — click to disable' :
    state === 'denied'       ? 'Notifications blocked in browser settings' :
    state === 'unsubscribed' ? 'Enable push notifications' :
                               'Loading…'

  return (
    <button
      onClick={state === 'loading' || state === 'denied' ? undefined : toggle}
      className="rounded-md p-1.5 text-subtext hover:bg-light relative transition-colors"
      title={title}
      disabled={state === 'loading' || state === 'denied'}
    >
      {icon}
      {state === 'subscribed' && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500 ring-2 ring-white" />
      )}
    </button>
  )
}
