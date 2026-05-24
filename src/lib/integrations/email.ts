/**
 * Email Integration Stub (SendGrid / Resend)
 * TODO: Choose a provider and fill credentials before deploying.
 *
 * Required env vars (choose one provider):
 *   SENDGRID_API_KEY=SG.xxx         (SendGrid)
 *   RESEND_API_KEY=re_xxx           (Resend — recommended for ease of use)
 *
 * Server endpoint: POST /api/send-email
 */

export type EmailProvider = 'sendgrid' | 'resend'

export const EMAIL_CONFIG = {
  provider: (import.meta.env.VITE_EMAIL_PROVIDER ?? 'resend') as EmailProvider,
  fromAddress: import.meta.env.VITE_EMAIL_FROM ?? 'noreply@townshub.cy',
  fromName: import.meta.env.VITE_EMAIL_FROM_NAME ?? 'TownsHub PMS',
} as const

export interface EmailPayload {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  attachments?: Array<{ filename: string; content: string; type: string }>
}

/**
 * Send an email via the server API.
 * Calls POST /api/send-email — implement that endpoint with your chosen provider.
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch (err) {
    console.error('[Email] sendEmail failed:', err)
    return false
  }
}

// ── Pre-built email templates ──────────────────────────────────────────────

export function bookingConfirmationEmail(params: {
  guestName: string
  bookingRef: string
  checkIn: string
  checkOut: string
  roomName: string
  hotelName: string
  preCheckinUrl: string
}): EmailPayload {
  return {
    to: '',
    subject: `Booking Confirmed — ${params.bookingRef} | ${params.hotelName}`,
    html: `
      <h2>Dear ${params.guestName},</h2>
      <p>Your booking at <strong>${params.hotelName}</strong> is confirmed.</p>
      <p><strong>Ref:</strong> ${params.bookingRef}<br>
         <strong>Room:</strong> ${params.roomName}<br>
         <strong>Check-in:</strong> ${params.checkIn}<br>
         <strong>Check-out:</strong> ${params.checkOut}</p>
      <p><a href="${params.preCheckinUrl}">Complete Pre-Check-In</a></p>
    `,
  }
}

export function postStaySurveyEmail(params: {
  guestName: string
  bookingRef: string
  surveyUrl: string
  hotelName: string
}): EmailPayload {
  return {
    to: '',
    subject: `How was your stay? — ${params.hotelName}`,
    html: `
      <h2>Thank you, ${params.guestName}!</h2>
      <p>We hope you enjoyed your stay at <strong>${params.hotelName}</strong>.</p>
      <p>We'd love to hear your feedback:</p>
      <p><a href="${params.surveyUrl}" style="background:#C9A84C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Leave a Review</a></p>
    `,
  }
}

export function campaignEmail(params: {
  guestName: string
  subject: string
  bodyHtml: string
  unsubscribeUrl: string
}): EmailPayload {
  return {
    to: '',
    subject: params.subject,
    html: `
      ${params.bodyHtml}
      <p style="font-size:11px;color:#999;margin-top:40px;">
        <a href="${params.unsubscribeUrl}">Unsubscribe</a>
      </p>
    `,
  }
}
