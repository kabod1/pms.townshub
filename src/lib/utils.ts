import { format, differenceInDays, parseISO } from 'date-fns'
import { CURRENCY_SYMBOL } from './constants'

export function formatCurrency(amount: number, currency = 'EUR'): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? currency
  return `${symbol}${amount.toFixed(2)}`
}

export function formatDate(date: string | Date, pattern = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, pattern)
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd MMM yyyy HH:mm')
}

export function nightCount(checkIn: string, checkOut: string): number {
  return differenceInDays(parseISO(checkOut), parseISO(checkIn))
}

export function calculateTotalAmount(
  roomRate: number,
  checkIn: string,
  checkOut: string,
  extras = 0,
): number {
  const nights = nightCount(checkIn, checkOut)
  return roomRate * nights + extras
}

export function generateInvoiceNumber(tenantSlug: string, sequence: number): string {
  const year = new Date().getFullYear()
  const seq = String(sequence).padStart(4, '0')
  return `INV-${tenantSlug.toUpperCase()}-${year}-${seq}`
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}…`
}

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function classNames(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
