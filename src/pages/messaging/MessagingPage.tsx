import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Send, MessageCircle, Bot, User, Clock } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Message, Booking } from '@/types'

// ─── In-stay messaging hooks ────────────────────────────────────────────────

function useActiveBookings() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['active-bookings-messaging', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, guest:guests(first_name,last_name), room:rooms(number)')
        .eq('tenant_id', tenant!.id)
        .eq('status', 'checked_in')
        .order('check_in_date', { ascending: false })
      if (error) throw error
      return data as Booking[]
    },
    enabled: !!tenant,
  })
}

function useMessages(bookingId: string | null) {
  return useQuery({
    queryKey: ['messages', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('booking_id', bookingId!)
        .order('created_at')
      if (error) throw error
      return data as Message[]
    },
    enabled: !!bookingId,
    refetchInterval: 10_000,
  })
}

// ─── Guest AI chat hooks ─────────────────────────────────────────────────────

interface GuestChatSession {
  id: string
  tenant_id: string
  guest_name: string | null
  room_number: string | null
  created_at: string
  last_message_at: string
}

interface GuestChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

function useGuestChatSessions() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['guest-chat-sessions', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guest_chat_sessions')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('last_message_at', { ascending: false })
      if (error) throw error
      return data as GuestChatSession[]
    },
    enabled: !!tenant,
    refetchInterval: 15_000,
  })
}

function useGuestChatMessages(sessionId: string | null) {
  return useQuery({
    queryKey: ['guest-chat-messages', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guest_chat_messages')
        .select('*')
        .eq('session_id', sessionId!)
        .order('created_at')
      if (error) throw error
      return data as GuestChatMessage[]
    },
    enabled: !!sessionId,
    refetchInterval: 10_000,
  })
}

// ─── Shared form schema ──────────────────────────────────────────────────────

const msgSchema = z.object({ body: z.string().min(1) })
type MsgForm = z.infer<typeof msgSchema>

// ─── In-stay messaging panel ─────────────────────────────────────────────────

function InStayMessaging() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: bookings = [], isLoading: bookingsLoading } = useActiveBookings()
  const { data: messages = [], isLoading: msgsLoading } = useMessages(selectedBookingId)
  const { register, handleSubmit, reset } = useForm<MsgForm>({ resolver: zodResolver(msgSchema) })

  const selectedBooking = bookings.find((b) => b.id === selectedBookingId) ?? null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMsg = useMutation({
    mutationFn: async ({ body }: MsgForm) => {
      await supabase.from('messages').insert({
        booking_id: selectedBookingId!,
        tenant_id: selectedBooking?.tenant_id,
        sender_type: 'staff',
        sender_name: user?.full_name ?? 'Staff',
        body,
        is_read: false,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', selectedBookingId] })
      reset()
    },
    onError: () => toast.error('Failed to send message'),
  })

  return (
    <div className="flex h-full gap-4">
      {/* Booking list */}
      <div className="w-64 shrink-0 overflow-y-auto rounded-xl bg-white shadow-sm ring-1 ring-mid">
        {bookingsLoading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : bookings.length === 0 ? (
          <div className="p-4 text-center text-sm text-subtext">No guests checked in</div>
        ) : (
          <div className="divide-y divide-mid">
            {bookings.map((b) => {
              const guest = b.guest as { first_name: string; last_name: string } | null
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBookingId(b.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-light transition-colors ${selectedBookingId === b.id ? 'bg-light border-l-2 border-gold' : ''}`}
                >
                  <p className="text-sm font-medium text-body">
                    {guest ? `${guest.first_name} ${guest.last_name}` : 'Guest'}
                  </p>
                  <p className="text-xs text-subtext">
                    Room {b.room?.number ?? '—'} · {b.booking_reference}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col rounded-xl bg-white shadow-sm ring-1 ring-mid overflow-hidden">
        {!selectedBookingId ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState icon={<MessageCircle size={32} />} title="Select a guest" description="Choose a checked-in guest to start messaging." />
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-mid">
              {selectedBooking && (
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-body">
                    {(selectedBooking.guest as { first_name: string; last_name: string } | null)
                      ? `${(selectedBooking.guest as { first_name: string; last_name: string }).first_name} ${(selectedBooking.guest as { first_name: string; last_name: string }).last_name}`
                      : 'Guest'}
                  </p>
                  <Badge label={`Room ${selectedBooking.room?.number ?? '—'}`} className="bg-green-100 text-green-700 text-xs" />
                  <Badge label="Checked In" className="bg-blue-100 text-blue-700 text-xs" />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {msgsLoading ? (
                <div className="flex justify-center py-8"><LoadingSpinner /></div>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-subtext py-8">No messages yet. Start the conversation.</p>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender_type === 'staff' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${msg.sender_type === 'staff' ? 'bg-navy text-white rounded-br-sm' : 'bg-light text-body rounded-bl-sm'}`}>
                      <p className="text-xs opacity-70 mb-0.5">{msg.sender_name}</p>
                      <p className="text-sm">{msg.body}</p>
                      <p className="text-xs opacity-50 mt-0.5 text-right">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSubmit((d) => sendMsg.mutate(d))} className="px-4 py-3 border-t border-mid flex gap-2">
              <input
                {...register('body')}
                placeholder="Type a message…"
                className="flex-1 rounded-lg border border-mid px-3 py-2 text-sm text-body focus:outline-none focus:ring-2 focus:ring-gold"
                autoComplete="off"
              />
              <Button type="submit" size="sm" loading={sendMsg.isPending}>
                <Send size={15} />
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Guest AI chat panel ─────────────────────────────────────────────────────

function GuestAIChat() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: sessions = [], isLoading: sessionsLoading } = useGuestChatSessions()
  const { data: messages = [], isLoading: msgsLoading } = useGuestChatMessages(selectedSessionId)

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex h-full gap-4">
      {/* Session list */}
      <div className="w-64 shrink-0 overflow-y-auto rounded-xl bg-white shadow-sm ring-1 ring-mid">
        {sessionsLoading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-center text-sm text-subtext">
            <Bot size={24} className="mx-auto mb-2 text-subtext opacity-50" />
            No guest conversations yet
          </div>
        ) : (
          <div className="divide-y divide-mid">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSessionId(s.id)}
                className={`w-full text-left px-4 py-3 hover:bg-light transition-colors ${selectedSessionId === s.id ? 'bg-light border-l-2 border-gold' : ''}`}
              >
                <p className="text-sm font-medium text-body">
                  {s.guest_name ?? 'Anonymous Guest'}
                </p>
                <p className="text-xs text-subtext flex items-center gap-1 mt-0.5">
                  {s.room_number && <span>Room {s.room_number} ·</span>}
                  <Clock size={10} />
                  {formatDate(s.last_message_at)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Message thread */}
      <div className="flex-1 flex flex-col rounded-xl bg-white shadow-sm ring-1 ring-mid overflow-hidden">
        {!selectedSessionId ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<Bot size={32} />}
              title="Select a conversation"
              description="Guest AI chat conversations will appear here in real time."
            />
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-mid flex items-center gap-2">
              <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
                <Bot size={14} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-body text-sm">
                  {selectedSession?.guest_name ?? 'Anonymous Guest'}
                </p>
                {selectedSession?.room_number && (
                  <p className="text-xs text-subtext">Room {selectedSession.room_number}</p>
                )}
              </div>
              <Badge label="AI Chat" className="ml-auto bg-amber-100 text-amber-700 text-xs" />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {msgsLoading ? (
                <div className="flex justify-center py-8"><LoadingSpinner /></div>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-subtext py-8">No messages in this session.</p>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-2 items-end ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center shrink-0">
                        <Bot size={12} className="text-white" />
                      </div>
                    )}
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${msg.role === 'user' ? 'bg-slate-700 text-white rounded-br-sm' : 'bg-light text-body rounded-bl-sm'}`}>
                      <p className="text-xs opacity-60 mb-0.5">{msg.role === 'user' ? 'Guest' : 'AI Concierge'}</p>
                      <p className="text-sm">{msg.content}</p>
                      <p className="text-xs opacity-40 mt-0.5 text-right">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-6 h-6 bg-slate-500 rounded-lg flex items-center justify-center shrink-0">
                        <User size={12} className="text-white" />
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            <div className="px-4 py-3 border-t border-mid bg-light/50">
              <p className="text-xs text-subtext text-center">
                This is a read-only view of the AI conversation. The guest is chatting via the public concierge link.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

type Tab = 'in-stay' | 'guest-ai'

export default function MessagingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('in-stay')
  const { tenant } = useAuthStore()

  const guestChatUrl = tenant?.slug
    ? `${window.location.origin}/guest-chat/${tenant.slug}`
    : null

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-80px)] space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-body">Messaging</h1>
            <p className="text-sm text-subtext">
              {activeTab === 'in-stay' ? 'Chat with checked-in guests' : 'Monitor AI concierge conversations'}
            </p>
          </div>
          {activeTab === 'guest-ai' && guestChatUrl && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-subtext">Guest link:</span>
              <code className="text-xs bg-light border border-mid rounded px-2 py-1 text-body font-mono truncate max-w-xs">
                {guestChatUrl}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(guestChatUrl); toast.success('Link copied!') }}
                className="text-xs text-gold hover:underline"
              >
                Copy
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-mid shrink-0">
          <button
            onClick={() => setActiveTab('in-stay')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'in-stay' ? 'border-gold text-gold' : 'border-transparent text-subtext hover:text-body'}`}
          >
            <MessageCircle size={14} /> In-Stay Messaging
          </button>
          <button
            onClick={() => setActiveTab('guest-ai')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'guest-ai' ? 'border-gold text-gold' : 'border-transparent text-subtext hover:text-body'}`}
          >
            <Bot size={14} /> Guest AI Chat
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === 'in-stay' ? <InStayMessaging /> : <GuestAIChat />}
        </div>
      </div>
    </DashboardLayout>
  )
}
