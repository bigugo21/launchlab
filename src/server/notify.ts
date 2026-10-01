/**
 * Email notifications through the platform `email` integration (Resend).
 *
 * - Plain-text only: titles and notes are user-written, so no HTML is built
 *   from them (no markup injection into someone else's inbox).
 * - Links are built from APP_NAME on the server, never from client input, so
 *   a member cannot make the app email an admin a link of their choosing.
 * - Recipient addresses are read server-side from `users` and never returned
 *   to any client.
 */

import type { ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker.js'

const FROM = 'Launch Lab <noreply@app.space>'

export function appUrl(env: Env, path: string): string {
  return `https://${env.APP_NAME}.app.space${path}`
}

export async function userEmail(tools: ActionTools, userId: string): Promise<string | null> {
  if (!userId) return null
  const r = await tools.get('users', userId)
  if (!r.success) return null
  const rec = (r.data as { record?: { data?: { email?: unknown } } }).record
  const email = rec?.data?.email
  return typeof email === 'string' && email.includes('@') ? email : null
}

/** Strip line breaks so user text cannot forge extra lines/headers in the email. */
export function oneLine(s: string, max = 120): string {
  return s.replace(/[\r\n]+/g, ' ').trim().slice(0, max)
}

export async function sendEmail(
  tools: ActionTools,
  to: string,
  subject: string,
  text: string,
): Promise<boolean> {
  const r = await tools.integration('email/send', { from: FROM, to, subject: oneLine(subject, 150), text })
  if (!r.success) console.error(`[notify] email failed: ${r.error}`)
  return r.success
}
