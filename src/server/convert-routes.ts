/**
 * Measured conversions: POST /api/convert
 *
 * Called server-to-server by the product's own backend when a user signs up,
 * activates (e.g. first deploy) or pays:
 *
 *   POST /api/convert
 *   Authorization: Bearer llk_…            (the experiment's conversion key)
 *   { "event": "signup", "externalId": "<hashed user id>", "code": "a4hsgrc" }
 *
 * Trust:
 * - The key is looked up by its SHA-256; the key itself is never stored.
 * - The key's creator must own the experiment (or be an admin) — otherwise a
 *   member could mint a key for someone else's experiment and inflate it.
 * - `uniqueOn [experimentId, event, externalId]` makes replays idempotent.
 */

import type { Hono } from 'hono'
import { resolveAppRole } from 'deepspace/worker'
import type { AppContext } from '../../worker.js'
import { createActionTools } from './action-routes.js'
import { CONVERSION_EVENTS, type ConversionEvent, type ConversionKey } from '../schemas/launchlab-schemas.js'

const KEY_RE = /^llk_[a-f0-9]{48}$/
const EXTERNAL_ID_RE = /^[\w.:@-]{1,128}$/
const CODE_RE = /^[a-z0-9]{4,16}$/

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function registerConvertRoutes(app: Hono<AppContext>): void {
  app.post('/api/convert', async (c) => {
    const auth = c.req.header('Authorization') ?? ''
    const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
    if (!KEY_RE.test(key)) return c.json({ success: false, error: 'Missing or malformed conversion key' }, 401)

    let body: Record<string, unknown>
    try {
      body = await c.req.json()
    } catch {
      return c.json({ success: false, error: 'Body must be JSON' }, 400)
    }
    const event = body.event as ConversionEvent
    const externalId = typeof body.externalId === 'string' ? body.externalId : ''
    const code = typeof body.code === 'string' && CODE_RE.test(body.code) ? body.code : ''
    if (!CONVERSION_EVENTS.includes(event)) {
      return c.json({ success: false, error: `event must be one of ${CONVERSION_EVENTS.join(', ')}` }, 400)
    }
    if (!EXTERNAL_ID_RE.test(externalId)) {
      return c.json({ success: false, error: 'externalId is required (1-128 chars: letters, digits, _ . : @ -)' }, 400)
    }

    const tools = createActionTools(c.env, c.env.OWNER_USER_ID || 'system', '')
    const keyHash = await sha256Hex(key)
    const found = await tools.query('conversion_keys', { where: { keyHash }, limit: 1 })
    const keyRec = found.success
      ? (found.data.records[0] as unknown as { data: ConversionKey; createdBy: string } | undefined)
      : undefined
    if (!keyRec) return c.json({ success: false, error: 'Unknown conversion key' }, 401)

    const expRes = await tools.get('experiments', keyRec.data.experimentId)
    const exp = expRes.success
      ? ((expRes.data as { record?: { createdBy: string } }).record ?? null)
      : null
    if (!exp) return c.json({ success: false, error: 'Experiment no longer exists' }, 404)
    const keyOwner = keyRec.createdBy
    const allowed =
      keyOwner === exp.createdBy ||
      keyOwner === c.env.OWNER_USER_ID ||
      (await resolveAppRole(c.env, keyOwner)) === 'admin'
    if (!allowed) return c.json({ success: false, error: 'Key is not valid for this experiment' }, 403)

    const created = await tools.create('conversions', {
      experimentId: keyRec.data.experimentId,
      code,
      event,
      externalId,
      at: Math.floor(Date.now() / 1000),
    })
    if (!created.success) {
      // The uniqueOn refusal: already counted — success for an idempotent webhook.
      if (/duplicate/i.test(created.error)) return c.json({ success: true, duplicate: true })
      console.error(`[convert] write failed exp=${keyRec.data.experimentId}: ${created.error}`)
      return c.json({ success: false, error: 'Could not record conversion' }, 500)
    }
    return c.json({ success: true, duplicate: false })
  })
}
