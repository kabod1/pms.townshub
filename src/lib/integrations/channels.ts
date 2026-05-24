/**
 * Channel Manager Integration Stub
 * Supports: Booking.com, Expedia, Airbnb, and generic iCal feeds.
 *
 * TODO: Replace stubs with real API calls before deploying.
 *
 * Required env vars:
 *   BOOKINGCOM_PROPERTY_ID=...
 *   BOOKINGCOM_USERNAME=...
 *   BOOKINGCOM_PASSWORD=...
 *   EXPEDIA_PARTNER_ACCOUNT_ID=...
 *   EXPEDIA_API_KEY=...
 *   EXPEDIA_API_SECRET=...
 *   AIRBNB_CLIENT_ID=...
 *   AIRBNB_CLIENT_SECRET=...
 */

export type ChannelId = 'booking_com' | 'expedia' | 'airbnb' | 'ical'

export interface ChannelConfig {
  id: ChannelId
  label: string
  logo: string
  connected: boolean
  lastSync: string | null
  docsUrl: string
}

export const CHANNEL_DEFAULTS: ChannelConfig[] = [
  {
    id: 'booking_com',
    label: 'Booking.com',
    logo: '/channels/bookingcom.svg',
    connected: false,
    lastSync: null,
    docsUrl: 'https://join.booking.com/partner/extranet',
  },
  {
    id: 'expedia',
    label: 'Expedia / Hotels.com',
    logo: '/channels/expedia.svg',
    connected: false,
    lastSync: null,
    docsUrl: 'https://expediapartnercentral.com',
  },
  {
    id: 'airbnb',
    label: 'Airbnb',
    logo: '/channels/airbnb.svg',
    connected: false,
    lastSync: null,
    docsUrl: 'https://www.airbnb.com/hosting',
  },
  {
    id: 'ical',
    label: 'iCal Feed (generic)',
    logo: '/channels/ical.svg',
    connected: false,
    lastSync: null,
    docsUrl: '',
  },
]

export interface ChannelAvailabilityUpdate {
  roomTypeId: string
  date: string
  available: number
  price: number
}

/**
 * Push availability + rates to a channel.
 * TODO: Implement /api/channels/push with provider-specific API calls.
 */
export async function pushAvailability(
  channel: ChannelId,
  updates: ChannelAvailabilityUpdate[]
): Promise<boolean> {
  console.warn(`[Channels] pushAvailability stub — ${channel}`, updates)
  // TODO: POST /api/channels/push { channel, updates }
  return false
}

/**
 * Fetch new reservations from a channel.
 * TODO: Implement /api/channels/pull with provider-specific API calls.
 */
export async function pullReservations(channel: ChannelId): Promise<unknown[]> {
  console.warn(`[Channels] pullReservations stub — ${channel}`)
  // TODO: GET /api/channels/pull?channel=...
  return []
}

/**
 * Generate an iCal export URL for a room type.
 * This is server-generated — implement /api/ical/:roomTypeId
 */
export function icalExportUrl(tenantSlug: string, roomTypeId: string): string {
  return `/api/ical/${tenantSlug}/${roomTypeId}.ics`
}

/**
 * Import bookings from an external iCal feed.
 * TODO: Implement /api/channels/ical-import with ical parsing.
 */
export async function importIcalFeed(url: string): Promise<boolean> {
  console.warn('[Channels] importIcalFeed stub — url:', url)
  return false
}
