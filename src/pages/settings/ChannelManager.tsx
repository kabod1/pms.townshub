import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { CHANNEL_DEFAULTS } from '@/lib/integrations/channels'
import type { ChannelId, ChannelConfig } from '@/lib/integrations/channels'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import {
  RefreshCw, Settings, CheckCircle, XCircle, AlertCircle,
  Link, ExternalLink, Zap, Globe, Copy, Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { classNames } from '@/lib/utils'

const SETTINGS_NAV = [
  { to: '/settings', label: 'Hotel' },
  { to: '/settings/users', label: 'Users' },
  { to: '/settings/billing', label: 'Billing' },
  { to: '/settings/packages', label: 'Packages' },
  { to: '/settings/promotions', label: 'Promotions' },
  { to: '/settings/vouchers', label: 'Vouchers' },
  { to: '/settings/channels', label: 'Channels' },
]

// Fields to collect per channel
const CHANNEL_FIELDS: Record<ChannelId, { label: string; key: string; type?: string; hint?: string }[]> = {
  siteminder: [
    { label: 'Client ID', key: 'clientId', hint: 'From SiteMinder Connectivity Partner dashboard' },
    { label: 'Client Secret', key: 'clientSecret', type: 'password', hint: 'Keep this secure' },
    { label: 'Property ID', key: 'propertyId', hint: 'Your SiteMinder property identifier' },
    { label: 'Webhook Secret', key: 'webhookSecret', type: 'password', hint: 'Set in SiteMinder to sign inbound webhooks' },
  ],
  booking_com: [
    { label: 'Property ID', key: 'property_id' },
    { label: 'Username', key: 'username' },
    { label: 'Password', key: 'password', type: 'password' },
  ],
  expedia: [
    { label: 'Partner Account ID', key: 'account_id' },
    { label: 'API Key', key: 'api_key' },
    { label: 'API Secret', key: 'api_secret', type: 'password' },
  ],
  airbnb: [
    { label: 'Client ID', key: 'client_id' },
    { label: 'Client Secret', key: 'client_secret', type: 'password' },
  ],
  ical: [
    { label: 'iCal Feed URL (import from)', key: 'ical_url' },
  ],
}

const CHANNEL_LOGOS: Record<ChannelId, string> = {
  siteminder:  '🌐',
  booking_com: '🔵',
  expedia:     '🟡',
  airbnb:      '🔴',
  ical:        '📅',
}

type DBConfig = {
  id: string
  channel: ChannelId
  credentials: Record<string, string>
  property_id: string | null
  webhook_secret: string | null
  is_active: boolean
  last_sync_at: string | null
}

export default function ChannelManager() {
  const { tenant } = useAuthStore()
  const [channels, setChannels] = useState<ChannelConfig[]>(CHANNEL_DEFAULTS)
  const [dbConfigs, setDbConfigs] = useState<DBConfig[]>([])
  const [configChannel, setConfigChannel] = useState<ChannelConfig | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [syncing, setSyncing] = useState<ChannelId | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [icalUrl, setIcalUrl] = useState('')
  const [icalImporting, setIcalImporting] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!tenant) return
    loadConfigs()
  }, [tenant])

  async function loadConfigs() {
    const { data } = await supabase
      .from('channel_configs')
      .select('*')
      .eq('tenant_id', tenant!.id)

    if (data) {
      setDbConfigs(data as DBConfig[])
      setChannels((prev) =>
        prev.map((ch) => {
          const db = (data as DBConfig[]).find((d) => d.channel === ch.id)
          return db
            ? { ...ch, connected: db.is_active, lastSync: db.last_sync_at }
            : ch
        })
      )
    }
  }

  function openConfig(ch: ChannelConfig) {
    const db = dbConfigs.find((d) => d.channel === ch.id)
    setConfigChannel(ch)
    setFields(db?.credentials ?? {})
    setTestResult(null)
  }

  async function handleTest() {
    if (!configChannel || configChannel.id !== 'siteminder') return
    setTesting(true)
    setTestResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/siteminder/test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId:     fields.clientId,
          clientSecret: fields.clientSecret,
          propertyId:   fields.propertyId,
        }),
      })
      const data = await res.json()
      setTestResult({
        ok: data.ok,
        message: data.ok
          ? `Connected! Property: ${data.propertyName ?? fields.propertyId}`
          : data.error ?? 'Connection failed',
      })
    } catch (err) {
      setTestResult({ ok: false, message: 'Request failed — check your credentials' })
    } finally {
      setTesting(false)
    }
  }

  async function saveConfig() {
    if (!configChannel || !tenant) return
    setSaving(true)
    try {
      const payload = {
        tenant_id:      tenant.id,
        channel:        configChannel.id,
        credentials:    fields,
        property_id:    fields.propertyId ?? fields.property_id ?? null,
        webhook_secret: fields.webhookSecret ?? fields.webhook_secret ?? null,
        is_active:      Object.values(fields).some(Boolean),
      }

      const { error } = await supabase
        .from('channel_configs')
        .upsert(payload, { onConflict: 'tenant_id,channel' })

      if (error) throw error

      toast.success(`${configChannel.label} configuration saved`)
      await loadConfigs()
      setConfigChannel(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleSync(ch: ChannelConfig) {
    if (!tenant) return
    setSyncing(ch.id)
    try {
      if (ch.id === 'siteminder') {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/siteminder/push', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token ?? ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: new Date().toISOString().slice(0, 10),
            to:   new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10),
            roomTypeId: 'DEFAULT',
            ratePlanId: 'DEFAULT',
          }),
        })
        const data = await res.json()
        if (data.ok) {
          toast.success(`SiteMinder synced — ${data.daysUpdated} days pushed`)
        } else {
          toast.error(data.error ?? 'Sync failed')
        }
        await loadConfigs()
      } else {
        toast.success(`${ch.label} sync triggered — implement /api/channels/push to activate`)
      }
    } catch {
      toast.error('Sync failed')
    } finally {
      setSyncing(null)
    }
  }

  function copyWebhookUrl() {
    const url = `${window.location.origin}/api/siteminder/webhook?tenant=${tenant?.slug}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const webhookUrl = `${window.location.origin}/api/siteminder/webhook?tenant=${tenant?.slug}`

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-body">Settings</h1>

        <div className="flex gap-1 border-b border-mid overflow-x-auto">
          {SETTINGS_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive ? 'border-gold text-gold' : 'border-transparent text-subtext hover:text-body'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="max-w-3xl space-y-6">

          {/* SiteMinder hero card */}
          <div className="rounded-xl bg-gradient-to-r from-navy to-navy/80 p-5 text-white">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Globe size={24} className="text-gold" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold">SiteMinder Channel Manager</h2>
                  <span className="text-xs bg-gold text-white px-2 py-0.5 rounded-full font-medium">Recommended</span>
                </div>
                <p className="text-sm text-white/70 mt-1">
                  Connect once to distribute your rates and availability to 450+ OTAs worldwide —
                  Booking.com, Expedia, Airbnb, Agoda, and more.
                </p>
                <div className="flex flex-wrap gap-3 mt-3">
                  <a
                    href="https://www.siteminder.com/connectivity-partner/"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-gold hover:underline"
                  >
                    <ExternalLink size={12} /> Apply for Connectivity Partner access
                  </a>
                  <a
                    href="https://api-documentation.siteminder.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-white/60 hover:text-white"
                  >
                    <ExternalLink size={12} /> API documentation
                  </a>
                </div>
              </div>
            </div>

            {/* Webhook URL */}
            <div className="mt-4 rounded-lg bg-white/10 px-3 py-2.5">
              <p className="text-xs text-white/60 mb-1">Your SiteMinder Webhook URL (configure this in SiteMinder):</p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-gold font-mono flex-1 truncate">{webhookUrl}</code>
                <button
                  onClick={copyWebhookUrl}
                  className="shrink-0 rounded p-1 hover:bg-white/10 transition-colors"
                  title="Copy webhook URL"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-white/60" />}
                </button>
              </div>
            </div>
          </div>

          {/* How it works */}
          <Card>
            <h3 className="text-sm font-semibold text-body mb-3 flex items-center gap-2">
              <Zap size={14} className="text-gold" /> How SiteMinder works with TownsHub
            </h3>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                {
                  step: '1',
                  title: 'You connect',
                  desc: 'Enter your SiteMinder API credentials below after getting partner access',
                },
                {
                  step: '2',
                  title: 'Rates sync out',
                  desc: 'TownsHub pushes your availability & rates to SiteMinder → all 450+ OTAs automatically',
                },
                {
                  step: '3',
                  title: 'Bookings flow in',
                  desc: 'Reservations from any OTA appear instantly in your TownsHub bookings calendar',
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-navy text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {item.step}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-body">{item.title}</p>
                    <p className="text-xs text-subtext mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Channel cards */}
          <div>
            <h2 className="text-base font-semibold text-body mb-3">OTA Channels</h2>
            <div className="grid gap-3">
              {channels.filter((c) => c.id !== 'ical').map((ch) => (
                <Card key={ch.id} padding={false}>
                  <div className="flex items-center gap-4 p-4">
                    <div className="w-10 h-10 rounded-lg bg-light flex items-center justify-center shrink-0 text-xl">
                      {CHANNEL_LOGOS[ch.id]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-body text-sm">{ch.label}</p>
                        {ch.badge && (
                          <span className="text-xs bg-gold/10 text-gold px-2 py-0.5 rounded-full font-medium border border-gold/20">
                            {ch.badge}
                          </span>
                        )}
                        {ch.connected ? (
                          <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
                            <CheckCircle size={12} /> Connected
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-subtext">
                            <XCircle size={12} /> Not connected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-subtext mt-0.5">{ch.description}</p>
                      {ch.lastSync && (
                        <p className="text-xs text-subtext mt-0.5">
                          Last sync: {new Date(ch.lastSync).toLocaleString()}
                        </p>
                      )}
                      {ch.docsUrl && (
                        <a
                          href={ch.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue hover:underline mt-0.5 inline-flex items-center gap-1"
                        >
                          <ExternalLink size={10} /> Partner portal
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                      {ch.connected && (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={syncing === ch.id}
                          onClick={() => handleSync(ch)}
                        >
                          <RefreshCw size={14} /> Sync now
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openConfig(ch)}>
                        <Settings size={14} /> Configure
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* iCal */}
          <div>
            <h2 className="text-base font-semibold text-body mb-3">iCal / Generic Sync</h2>
            <Card>
              <p className="text-sm text-subtext mb-3">
                Import bookings from any calendar feed (Google Calendar, Airbnb, VRBO, etc.) using an iCal URL.
              </p>
              <div className="flex gap-2 flex-wrap">
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder="https://calendar.google.com/calendar/ical/..."
                    value={icalUrl}
                    onChange={(e) => setIcalUrl(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  loading={icalImporting}
                  onClick={async () => {
                    setIcalImporting(true)
                    await new Promise((r) => setTimeout(r, 1000))
                    toast.success('iCal import triggered (stub)')
                    setIcalImporting(false)
                  }}
                  disabled={!icalUrl.trim()}
                >
                  <Link size={14} /> Import
                </Button>
              </div>
              <p className="text-xs text-subtext mt-2">
                Your iCal export:{' '}
                <code className="font-mono bg-light px-1 rounded">
                  {window.location.origin}/api/ical/{tenant?.slug}/ROOM_TYPE_ID.ics
                </code>
              </p>
            </Card>
          </div>

          {/* What gets synced */}
          <Card>
            <h3 className="text-sm font-semibold text-body mb-3">What gets synced</h3>
            <ul className="space-y-2 text-sm text-subtext">
              {[
                { arrow: '→', text: 'Availability sent to OTAs: When you block dates or confirm bookings in TownsHub' },
                { arrow: '→', text: 'Rates pushed to OTAs: From your seasonal rates and promotions' },
                { arrow: '←', text: 'Reservations pulled from OTAs: New bookings appear instantly in your bookings calendar' },
                { arrow: '←', text: 'Cancellations synced: OTA cancellations automatically update room availability' },
              ].map(({ arrow, text }, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-gold font-bold shrink-0">{arrow}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* Configure modal */}
      <Modal
        open={!!configChannel}
        onClose={() => setConfigChannel(null)}
        title={`Configure ${configChannel?.label ?? ''}`}
        size="sm"
      >
        <div className="space-y-4">
          {configChannel?.id === 'siteminder' && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
              <p className="font-medium mb-0.5">Before connecting</p>
              Apply for SiteMinder Connectivity Partner access at{' '}
              <a href="https://www.siteminder.com/connectivity-partner/" target="_blank" rel="noreferrer" className="underline">
                siteminder.com
              </a>{' '}
              to receive your API credentials.
            </div>
          )}

          {configChannel && CHANNEL_FIELDS[configChannel.id].map((f) => (
            <div key={f.key}>
              <Input
                label={f.label}
                type={f.type ?? 'text'}
                placeholder={`Enter ${f.label.toLowerCase()}`}
                value={fields[f.key] ?? ''}
                onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
              {f.hint && <p className="mt-1 text-xs text-subtext">{f.hint}</p>}
            </div>
          ))}

          {/* Test connection (SiteMinder only) */}
          {configChannel?.id === 'siteminder' && (
            <div>
              <Button
                variant="outline"
                size="sm"
                loading={testing}
                onClick={handleTest}
                disabled={!fields.clientId || !fields.clientSecret || !fields.propertyId}
              >
                Test connection
              </Button>
              {testResult && (
                <div className={classNames(
                  'mt-2 rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-2',
                  testResult.ok
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                )}>
                  {testResult.ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
                  {testResult.message}
                </div>
              )}
            </div>
          )}

          {configChannel?.id !== 'siteminder' && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              <AlertCircle size={12} className="inline mr-1" />
              Consider using SiteMinder instead — one connection reaches all OTAs including this one.
            </div>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" onClick={() => setConfigChannel(null)}>Cancel</Button>
            <Button onClick={saveConfig} loading={saving}>Save Configuration</Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
