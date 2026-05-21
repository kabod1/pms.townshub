import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Mail, MessageSquare, Phone, Send, Megaphone } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import {
  COMMUNICATION_TYPE_LABELS, COMMUNICATION_STATUS_LABELS,
  CAMPAIGN_TRIGGER_LABELS, CAMPAIGN_STATUS_LABELS,
} from '@/lib/constants'
import toast from 'react-hot-toast'
import type { Communication, Campaign, CommunicationType, CampaignTrigger } from '@/types'

const TYPE_ICONS: Record<CommunicationType, React.ReactNode> = {
  email: <Mail size={14} />,
  sms: <MessageSquare size={14} />,
  whatsapp: <MessageSquare size={14} />,
  phone: <Phone size={14} />,
  in_app: <Send size={14} />,
}

const msgSchema = z.object({
  guest_id: z.string().optional(),
  booking_id: z.string().optional(),
  type: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1, 'Message body required'),
})
type MsgForm = z.infer<typeof msgSchema>

const campaignSchema = z.object({
  name: z.string().min(1, 'Name required'),
  subject: z.string().min(1, 'Subject required'),
  body: z.string().min(1, 'Body required'),
  type: z.string().min(1),
  trigger: z.string().min(1),
  trigger_days: z.coerce.number().min(0),
})
type CampaignForm = z.infer<typeof campaignSchema>

const COMM_TYPE_OPTIONS = (['email', 'sms', 'whatsapp', 'phone', 'in_app'] as CommunicationType[]).map((t) => ({
  value: t, label: COMMUNICATION_TYPE_LABELS[t],
}))

const TRIGGER_OPTIONS = (['pre_arrival', 'check_in', 'mid_stay', 'post_stay', 'manual'] as CampaignTrigger[]).map((t) => ({
  value: t, label: CAMPAIGN_TRIGGER_LABELS[t],
}))

function useCommunications() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['communications', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communications')
        .select('*, guest:guests(first_name,last_name,email)')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data as Communication[]
    },
    enabled: !!tenant,
  })
}

function useCampaigns() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['campaigns', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Campaign[]
    },
    enabled: !!tenant,
  })
}

export default function CommunicationsCenter() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'log' | 'campaigns'>('log')
  const [showMsgModal, setShowMsgModal] = useState(false)
  const [showCampaignModal, setShowCampaignModal] = useState(false)

  const { data: comms = [], isLoading: commsLoading } = useCommunications()
  const { data: campaigns = [], isLoading: campLoading } = useCampaigns()

  const msgForm = useForm<MsgForm>({ resolver: zodResolver(msgSchema), defaultValues: { type: 'email' } })
  const campForm = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
    defaultValues: { type: 'email', trigger: 'pre_arrival', trigger_days: 1 },
  })

  const sendMessage = useMutation({
    mutationFn: async (data: MsgForm) => {
      await supabase.from('communications').insert({
        tenant_id: tenant!.id,
        guest_id: data.guest_id || null,
        booking_id: data.booking_id || null,
        type: data.type,
        direction: 'outbound',
        subject: data.subject || null,
        body: data.body,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communications'] })
      toast.success('Message logged')
      setShowMsgModal(false)
      msgForm.reset({ type: 'email' })
    },
    onError: () => toast.error('Failed to log message'),
  })

  const saveCampaign = useMutation({
    mutationFn: async (data: CampaignForm) => {
      await supabase.from('campaigns').insert({
        tenant_id: tenant!.id,
        ...data,
        status: 'draft',
        sent_count: 0,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Campaign saved as draft')
      setShowCampaignModal(false)
      campForm.reset({ type: 'email', trigger: 'pre_arrival', trigger_days: 1 })
    },
    onError: () => toast.error('Failed to save campaign'),
  })

  const updateCampaignStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await supabase.from('campaigns').update({ status }).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  })

  const isLoading = commsLoading || campLoading

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-body">Communications</h1>
            <p className="text-sm text-subtext">Guest messages, email campaigns, and automated sequences</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCampaignModal(true)}>
              <Megaphone size={15} /> New Campaign
            </Button>
            <Button size="sm" onClick={() => setShowMsgModal(true)}>
              <Plus size={15} /> Log Message
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-mid">
          {(['log', 'campaigns'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                activeTab === tab ? 'border-gold text-gold' : 'border-transparent text-subtext hover:text-body'
              }`}
            >
              {tab === 'log' ? 'Communication Log' : 'Campaigns'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : activeTab === 'log' ? (
          comms.length === 0 ? (
            <EmptyState icon={<Mail size={32} />} title="No communications" description="Log a message or set up automated campaigns." />
          ) : (
            <div className="space-y-2">
              {comms.map((c) => (
                <div key={c.id} className="flex items-start gap-3 rounded-xl bg-white shadow-sm ring-1 ring-mid px-4 py-3">
                  <div className="mt-0.5 text-subtext">{TYPE_ICONS[c.type]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-body">
                        {c.guest
                          ? `${(c.guest as { first_name: string; last_name: string }).first_name} ${(c.guest as { first_name: string; last_name: string }).last_name}`
                          : 'Guest'}
                      </span>
                      <Badge label={COMMUNICATION_TYPE_LABELS[c.type]} className="bg-blue-50 text-blue-700 text-xs" />
                      <Badge
                        label={COMMUNICATION_STATUS_LABELS[c.status]}
                        className={c.status === 'failed' ? 'bg-red-100 text-red-700 text-xs' : 'bg-green-100 text-green-700 text-xs'}
                      />
                      <span className="text-xs text-subtext capitalize">{c.direction}</span>
                    </div>
                    {c.subject && <p className="text-sm font-medium text-body mt-0.5">{c.subject}</p>}
                    <p className="text-sm text-subtext mt-0.5 line-clamp-2">{c.body}</p>
                  </div>
                  <span className="text-xs text-subtext shrink-0">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : (
          campaigns.length === 0 ? (
            <EmptyState icon={<Megaphone size={32} />} title="No campaigns" description="Create automated email/SMS campaigns for pre-arrival, check-in, and post-stay." />
          ) : (
            <div className="space-y-3">
              {campaigns.map((camp) => (
                <div key={camp.id} className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-body">{camp.name}</p>
                        <Badge label={CAMPAIGN_STATUS_LABELS[camp.status]} className={
                          camp.status === 'sent' ? 'bg-green-100 text-green-700 text-xs' :
                          camp.status === 'scheduled' ? 'bg-blue-100 text-blue-700 text-xs' :
                          camp.status === 'cancelled' ? 'bg-red-100 text-red-700 text-xs' :
                          'bg-gray-100 text-gray-600 text-xs'
                        } />
                      </div>
                      <p className="text-xs text-subtext mt-0.5">
                        {COMMUNICATION_TYPE_LABELS[camp.type]} · {CAMPAIGN_TRIGGER_LABELS[camp.trigger]}
                        {camp.trigger !== 'manual' && ` (${camp.trigger_days} day(s))`}
                      </p>
                      <p className="text-sm text-subtext mt-1 line-clamp-1">{camp.subject}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-subtext">{camp.sent_count} sent</span>
                      {camp.status === 'draft' && (
                        <Button size="sm" variant="outline" onClick={() => updateCampaignStatus.mutate({ id: camp.id, status: 'scheduled' })}>
                          Schedule
                        </Button>
                      )}
                      {camp.status === 'scheduled' && (
                        <Button size="sm" variant="danger" onClick={() => updateCampaignStatus.mutate({ id: camp.id, status: 'cancelled' })}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Log Message Modal */}
      <Modal
        open={showMsgModal}
        onClose={() => { setShowMsgModal(false); msgForm.reset({ type: 'email' }) }}
        title="Log Communication"
        size="sm"
      >
        <form onSubmit={msgForm.handleSubmit((d) => sendMessage.mutate(d))} className="space-y-4">
          <Select label="Type" options={COMM_TYPE_OPTIONS} {...msgForm.register('type')} />
          <Input label="Subject (optional)" {...msgForm.register('subject')} />
          <div>
            <label className="block text-sm font-medium text-body mb-1">Message</label>
            <textarea
              {...msgForm.register('body')}
              rows={4}
              className="w-full rounded-lg border border-mid px-3 py-2 text-sm text-body focus:outline-none focus:ring-2 focus:ring-gold resize-none"
              placeholder="Message content…"
            />
            {msgForm.formState.errors.body && (
              <p className="text-xs text-red-600 mt-1">{msgForm.formState.errors.body.message}</p>
            )}
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" type="button" onClick={() => setShowMsgModal(false)}>Cancel</Button>
            <Button type="submit" loading={sendMessage.isPending}>Log Message</Button>
          </div>
        </form>
      </Modal>

      {/* Campaign Modal */}
      <Modal
        open={showCampaignModal}
        onClose={() => { setShowCampaignModal(false); campForm.reset({ type: 'email', trigger: 'pre_arrival', trigger_days: 1 }) }}
        title="New Campaign"
      >
        <form onSubmit={campForm.handleSubmit((d) => saveCampaign.mutate(d))} className="space-y-4">
          <Input label="Campaign Name" error={campForm.formState.errors.name?.message} {...campForm.register('name')} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Channel" options={COMM_TYPE_OPTIONS} {...campForm.register('type')} />
            <Select label="Trigger" options={TRIGGER_OPTIONS} {...campForm.register('trigger')} />
            <Input label="Trigger Days" type="number" min={0} {...campForm.register('trigger_days')} />
          </div>
          <Input label="Subject" error={campForm.formState.errors.subject?.message} {...campForm.register('subject')} />
          <div>
            <label className="block text-sm font-medium text-body mb-1">Message Body</label>
            <textarea
              {...campForm.register('body')}
              rows={5}
              className="w-full rounded-lg border border-mid px-3 py-2 text-sm text-body focus:outline-none focus:ring-2 focus:ring-gold resize-none"
              placeholder="Use {{guest_name}}, {{check_in_date}}, {{hotel_name}} as placeholders…"
            />
            {campForm.formState.errors.body && (
              <p className="text-xs text-red-600 mt-1">{campForm.formState.errors.body.message}</p>
            )}
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" type="button" onClick={() => setShowCampaignModal(false)}>Cancel</Button>
            <Button type="submit" loading={saveCampaign.isPending}>Save Draft</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
