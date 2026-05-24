import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { CHANNEL_DEFAULTS, pushAvailability, importIcalFeed } from '@/lib/integrations/channels'
import type { ChannelId, ChannelConfig } from '@/lib/integrations/channels'
import { RefreshCw, Settings, CheckCircle, XCircle, AlertCircle, Link } from 'lucide-react'
import toast from 'react-hot-toast'

const SETTINGS_NAV = [
  { to: '/settings', label: 'Hotel' },
  { to: '/settings/users', label: 'Users' },
  { to: '/settings/billing', label: 'Billing' },
  { to: '/settings/packages', label: 'Packages' },
  { to: '/settings/promotions', label: 'Promotions' },
  { to: '/settings/vouchers', label: 'Vouchers' },
  { to: '/settings/channels', label: 'Channels' },
]

const CHANNEL_FIELDS: Record<ChannelId, { label: string; key: string }[]> = {
  booking_com: [
    { label: 'Property ID', key: 'property_id' },
    { label: 'Username', key: 'username' },
    { label: 'Password', key: 'password' },
  ],
  expedia: [
    { label: 'Partner Account ID', key: 'account_id' },
    { label: 'API Key', key: 'api_key' },
    { label: 'API Secret', key: 'api_secret' },
  ],
  airbnb: [
    { label: 'Client ID', key: 'client_id' },
    { label: 'Client Secret', key: 'client_secret' },
  ],
  ical: [
    { label: 'iCal Feed URL (import from)', key: 'ical_url' },
  ],
}

export default function ChannelManager() {
  const [channels, setChannels] = useState<ChannelConfig[]>(CHANNEL_DEFAULTS)
  const [configChannel, setConfigChannel] = useState<ChannelConfig | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [syncing, setSyncing] = useState<ChannelId | null>(null)
  const [icalUrl, setIcalUrl] = useState('')
  const [icalImporting, setIcalImporting] = useState(false)

  function openConfig(ch: ChannelConfig) {
    setConfigChannel(ch)
    setFields({})
  }

  function saveConfig() {
    if (!configChannel) return
    setChannels((prev) =>
      prev.map((c) =>
        c.id === configChannel.id
          ? { ...c, connected: Object.values(fields).some(Boolean), lastSync: new Date().toISOString() }
          : c
      )
    )
    toast.success(`${configChannel.label} configuration saved — deploy your API keys to activate`)
    setConfigChannel(null)
  }

  async function handleSync(ch: ChannelConfig) {
    setSyncing(ch.id)
    try {
      await pushAvailability(ch.id, [])
      toast.success(`${ch.label} sync triggered (stub) — wire up /api/channels/push to activate`)
    } catch {
      toast.error('Sync failed')
    } finally {
      setSyncing(null)
    }
  }

  async function handleIcalImport() {
    if (!icalUrl.trim()) return
    setIcalImporting(true)
    try {
      await importIcalFeed(icalUrl)
      toast.success('iCal import triggered (stub) — wire up /api/channels/ical-import to activate')
    } finally {
      setIcalImporting(false)
    }
  }

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

        <div className="max-w-3xl space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Integration stubs ready</p>
              <p className="mt-0.5">
                Configure API credentials here. Implement <code className="bg-amber-100 px-1 rounded">api/channels/push.ts</code> and{' '}
                <code className="bg-amber-100 px-1 rounded">api/channels/pull.ts</code> to activate live syncing.
              </p>
            </div>
          </div>

          <h2 className="text-base font-semibold text-body">OTA Channels</h2>

          <div className="grid gap-4">
            {channels.filter(c => c.id !== 'ical').map((ch) => (
              <Card key={ch.id} padding={false}>
                <div className="flex items-center gap-4 p-5">
                  <div className="w-10 h-10 rounded-lg bg-light flex items-center justify-center shrink-0">
                    <span className="text-lg font-bold text-navy">
                      {ch.label.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-body">{ch.label}</p>
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
                        className="text-xs text-blue hover:underline mt-0.5 inline-block"
                      >
                        Partner portal ↗
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
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

          {/* iCal */}
          <h2 className="text-base font-semibold text-body">iCal / Generic Sync</h2>
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
                onClick={handleIcalImport}
                disabled={!icalUrl.trim()}
              >
                <Link size={14} /> Import
              </Button>
            </div>
            <p className="text-xs text-subtext mt-2">
              Your iCal export URL: <code className="font-mono bg-light px-1 rounded">{window.location.origin}/api/ical/YOUR_SLUG/ROOM_TYPE_ID.ics</code>
            </p>
          </Card>

          {/* What gets synced */}
          <Card>
            <h3 className="text-sm font-semibold text-body mb-3">What gets synced</h3>
            <ul className="space-y-2 text-sm text-subtext">
              {[
                { arrow: '→', text: 'Availability sent to OTAs: When you block dates or confirm bookings in TownsHub' },
                { arrow: '→', text: 'Rates pushed to OTAs: From your seasonal rates and promotions' },
                { arrow: '←', text: 'Reservations pulled from OTAs: New bookings appear as unconfirmed in your calendar' },
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

      {/* Config modal */}
      <Modal
        open={!!configChannel}
        onClose={() => setConfigChannel(null)}
        title={`Configure ${configChannel?.label ?? ''}`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-subtext">
            Enter your API credentials. These will be stored securely and used to sync availability and reservations.
          </p>
          {configChannel && CHANNEL_FIELDS[configChannel.id].map((f) => (
            <Input
              key={f.key}
              label={f.label}
              type={f.key.includes('password') || f.key.includes('secret') ? 'password' : 'text'}
              placeholder={`Enter ${f.label.toLowerCase()}`}
              value={fields[f.key] ?? ''}
              onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
            />
          ))}
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            Credentials are saved locally. Implement <code>api/channels/</code> endpoints to activate live syncing.
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" onClick={() => setConfigChannel(null)}>Cancel</Button>
            <Button onClick={saveConfig}>Save Configuration</Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
