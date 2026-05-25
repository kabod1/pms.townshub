/**
 * Channel Manager Integration
 * Supports: SiteMinder (primary), Booking.com, Expedia, Airbnb, iCal
 */

export type ChannelId = 'siteminder' | 'booking_com' | 'expedia' | 'airbnb' | 'ical'

export interface ChannelConfig {
  id: ChannelId
  label: string
  logo: string
  connected: boolean
  lastSync: string | null
  docsUrl: string
  description: string
  badge?: string
}

export const CHANNEL_DEFAULTS: ChannelConfig[] = [
  {
    id: 'siteminder',
    label: 'SiteMinder',
    logo: '/channels/siteminder.svg',
    connected: false,
    lastSync: null,
    docsUrl: 'https://www.siteminder.com/connectivity-partner/',
    description: 'Connect to 450+ OTAs with one integration — the world\'s leading channel manager',
    badge: 'Recommended',
  },
  {
    id: 'booking_com',
    label: 'Booking.com',
    logo: '/channels/bookingcom.svg',
    connected: false,
    lastSync: null,
    docsUrl: 'https://join.booking.com/partner/extranet',
    description: 'Direct connectivity to Booking.com (requires Connectivity Partner approval)',
  },
  {
    id: 'expedia',
    label: 'Expedia / Hotels.com',
    logo: '/channels/expedia.svg',
    connected: false,
    lastSync: null,
    docsUrl: 'https://expediapartnercentral.com',
    description: 'Direct connectivity to Expedia Group channels',
  },
  {
    id: 'airbnb',
    label: 'Airbnb',
    logo: '/channels/airbnb.svg',
    connected: false,
    lastSync: null,
    docsUrl: 'https://www.airbnb.com/hosting',
    description: 'Direct connectivity to Airbnb (requires Software Partner approval)',
  },
  {
    id: 'ical',
    label: 'iCal Feed (generic)',
    logo: '/channels/ical.svg',
    connected: false,
    lastSync: null,
    docsUrl: '',
    description: 'Import bookings from any calendar URL (Google Calendar, VRBO, etc.)',
  },
]

export interface ChannelAvailabilityUpdate {
  roomTypeId: string
  date: string
  available: number
  price: number
}

export async function pushAvailability(
  channel: ChannelId,
  updates: ChannelAvailabilityUpdate[],
  token: string
): Promise<boolean> {
  if (channel === 'siteminder') {
    const res = await fetch('/api/siteminder/push', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: updates[0]?.date,
        to:   updates[updates.length - 1]?.date,
        roomTypeId: updates[0]?.roomTypeId,
        ratePlanId: 'DEFAULT',
      }),
    })
    return res.ok
  }
  console.warn(`[Channels] pushAvailability stub — ${channel}`)
  return false
}

export async function pullReservations(channel: ChannelId): Promise<unknown[]> {
  console.warn(`[Channels] pullReservations stub — ${channel}`)
  return []
}

export function icalExportUrl(tenantSlug: string, roomTypeId: string): string {
  return `/api/ical/${tenantSlug}/${roomTypeId}.ics`
}

export async function importIcalFeed(url: string): Promise<boolean> {
  console.warn('[Channels] importIcalFeed stub — url:', url)
  return false
}
