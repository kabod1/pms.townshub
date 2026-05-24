/**
 * Email Send API — Vercel Serverless Function
 *
 * TODO: Choose a provider and uncomment the relevant section below.
 *
 * Required env vars (choose one):
 *   RESEND_API_KEY=re_xxx         (Resend — recommended)
 *   SENDGRID_API_KEY=SG.xxx       (SendGrid)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { to, subject, html, text, replyTo, attachments } = req.body

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, html' })
  }

  const recipients = Array.isArray(to) ? to : [to]

  // ── Option A: Resend ─────────────────────────────────────────────────────
  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    const { error } = await resend.emails.send({
      from: `${process.env.EMAIL_FROM_NAME ?? 'TownsHub PMS'} <${process.env.EMAIL_FROM ?? 'noreply@townshub.cy'}>`,
      to: recipients,
      subject,
      html,
      text: text ?? undefined,
      replyTo: replyTo ?? undefined,
    })

    if (error) {
      console.error('[send-email] Resend error:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ ok: true, provider: 'resend' })
  }

  // ── Option B: SendGrid ───────────────────────────────────────────────────
  if (process.env.SENDGRID_API_KEY) {
    const sgMail = (await import('@sendgrid/mail')).default
    sgMail.setApiKey(process.env.SENDGRID_API_KEY)

    await sgMail.sendMultiple({
      to: recipients,
      from: {
        email: process.env.EMAIL_FROM ?? 'noreply@townshub.cy',
        name: process.env.EMAIL_FROM_NAME ?? 'TownsHub PMS',
      },
      subject,
      html,
      text: text ?? '',
      replyTo: replyTo ?? undefined,
      attachments: attachments?.map((a: { filename: string; content: string; type: string }) => ({
        filename: a.filename,
        content: a.content,
        type: a.type,
        disposition: 'attachment',
      })),
    })

    return res.status(200).json({ ok: true, provider: 'sendgrid' })
  }

  // ── No provider configured ───────────────────────────────────────────────
  console.warn('[send-email] No email provider configured. Set RESEND_API_KEY or SENDGRID_API_KEY.')
  // Return 200 so the UI doesn't error during development
  return res.status(200).json({ ok: true, provider: 'stub', message: 'No provider configured — email not sent' })
}
