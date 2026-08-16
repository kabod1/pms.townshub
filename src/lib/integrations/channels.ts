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

// Actual sync logic lives in api/siteminder.ts + src/lib/integrations/siteminder.ts
// (push ARI, receive-via-webhook, iCal import/export) and is called directly
// from ChannelManager.tsx. This file used to also export pushAvailability(),
// pullReservations(), icalExportUrl(), and importIcalFeed() as a parallel
// abstraction — none of them were ever wired to anything real (pushAvailability
// only worked for siteminder and just re-implemented the same fetch call
// ChannelManager.tsx already makes directly; the other three were pure
// console.warn stubs, including icalExportUrl() pointing at an /api/ical/...
// endpoint that was never built). Removed rather than fixed, since nothing
// imported them.
