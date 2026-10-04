/**
 * Tracked links: GET /go/:code
 *
 * Public (anyone who sees the post can click), so it never trusts the
 * browser: the click is written by the worker with app-action tools, the
 * `clicks` collection denies client creates, and the destination comes from
 * the stored experiment — never from the request — so this cannot be used as
 * an open redirect.
 *
 * Privacy: no IP and no user agent stored. Only the referring host, the
 * Cloudflare country code, a bot flag and a repeat flag. The repeat cookie
 * is a per-link "already counted" marker, not an identifier.
 *
 * The redirect does not wait for the write: the click is recorded in
 * `waitUntil` so the visitor is not slowed down by our bookkeeping.
 */

import type { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import type { AppContext } from '../../worker.js'
import { createActionTools } from './action-routes.js'
import { appUrl, oneLine, sendEmail, userEmail } from './notify.js'
import type { ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker.js'
import { isUniqueHuman, type Click, type Experiment, type TrackedLink } from '../schemas/launchlab-schemas.js'

type ExperimentRecord = { data: Experiment; createdBy: string }

const CODE_RE = /^[a-z0-9]{4,16}$/

/** A second click from the same browser within this window is a "repeat". */
const REPEAT_WINDOW_SECONDS = 24 * 60 * 60

// Crawlers, link unfurlers (Slack/Discord/X previews) and headless tools —
// the main source of fake "clicks" on a freshly posted link.
const BOT_UA_RE =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|discordbot|slackbot|twitterbot|linkedinbot|whatsapp|telegrambot|headless|curl|wget|python-requests|go-http-client|node-fetch|axios/i

export function isBotRequest(req: Request): boolean {
  const ua = req.headers.get('user-agent') ?? ''
  if (!ua || BOT_UA_RE.test(ua)) return true
  // Browser link prefetch/prerender is not a human click.
  const purpose = req.headers.get('sec-purpose') ?? req.headers.get('purpose') ?? ''
  return /prefetch|prerender/i.test(purpose)
}

/** Append UTM tags so the destination's own analytics can attribute signups. */
export function withUtm(destination: string, channel: string, code: string): string | null {
  let url: URL
  try {
    url = new URL(destination)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (!url.searchParams.has('utm_source')) url.searchParams.set('utm_source', channel || 'launchlab')
  url.searchParams.set('utm_medium', 'launchlab')
  url.searchParams.set('utm_campaign', code)
  return url.toString()
}

function referrerHost(req: Request): string {
  const ref = req.headers.get('referer')
  if (!ref) return ''
  try {
    return new URL(ref).hostname
  } catch {
    return ''
  }
}

export function registerGoRoutes(app: Hono<AppContext>): void {
  app.get('/go/:code', async (c) => {
    const code = c.req.param('code').toLowerCase()
    if (!CODE_RE.test(code)) return c.text('Link not found', 404)

    // System identity for the bookkeeping writes — there is no signed-in
    // caller on a public link.
    const tools = createActionTools(c.env, c.env.OWNER_USER_ID || 'system', '')

    const linkRes = await tools.query('links', { where: { code }, limit: 1 })
    const link = linkRes.success
      ? (linkRes.data.records[0] as unknown as { recordId: string; data: TrackedLink } | undefined)
      : undefined
    if (!link) return c.text('Link not found', 404)

    const expRes = await tools.get('experiments', link.data.experimentId)
    const exp = expRes.success
      ? (expRes.data.record as unknown as ExperimentRecord | undefined)
      : undefined
    const target = exp ? withUtm(exp.data.destinationUrl, exp.data.channel, code) : null
    if (!target) return c.text('Link has no valid destination', 404)

    const req = c.req.raw
    const cf = (req as Request & { cf?: { country?: string } }).cf
    const isBot = isBotRequest(req)
    // Repeat visits from the same browser are logged but not counted as new
    // humans. The cookie holds no identity — only "this browser already
    // clicked this link" — and is scoped to this one link's path.
    const cookieName = `ll_${code}`
    const isRepeat = getCookie(c, cookieName) === '1'
    if (!isBot && !isRepeat) {
      setCookie(c, cookieName, '1', {
        path: `/go/${code}`,
        maxAge: REPEAT_WINDOW_SECONDS,
        httpOnly: true,
        sameSite: 'Lax',
        secure: new URL(req.url).protocol === 'https:',
      })
    }
    c.executionCtx.waitUntil(
      tools
        .create('clicks', {
          linkId: link.recordId,
          experimentId: link.data.experimentId,
          code,
          at: Math.floor(Date.now() / 1000),
          referrerHost: referrerHost(req),
          country: cf?.country ?? '',
          isBot,
          isRepeat,
        })
        .then(async (r) => {
          if (!r.success) {
            console.error(`[go] click write failed code=${code}: ${r.error}`)
            return
          }
          if (!isBot && !isRepeat && exp) {
            await notifyIfBarReached(tools, c.env, link.data.experimentId, exp)
          }
        }),
    )

    // 302, not 301: a cached permanent redirect would skip us on repeat clicks.
    return c.redirect(target, 302)
  })
}

/**
 * Email the experiment's owner once, the first time unique human clicks reach
 * the pass bar. `barNotifiedAt` is set before sending so a retry never sends
 * twice; two clicks landing in the same instant could still both pass the
 * check — an accepted, rare duplicate for a notification.
 */
async function notifyIfBarReached(
  tools: ActionTools,
  env: Env,
  experimentId: string,
  exp: ExperimentRecord,
): Promise<void> {
  const target = exp.data.targetClicks || 0
  if (target <= 0 || exp.data.barNotifiedAt) return
  const res = await tools.query('clicks', { where: { experimentId }, limit: 5000 })
  if (!res.success) return
  const unique = (res.data.records as unknown as { data: Click }[]).filter((r) => isUniqueHuman(r.data)).length
  if (unique < target) return

  const marked = await tools.update('experiments', experimentId, { barNotifiedAt: Math.floor(Date.now() / 1000) })
  if (!marked.success) return
  const to = await userEmail(tools, exp.createdBy)
  if (!to) return
  const title = oneLine(exp.data.title)
  await sendEmail(
    tools,
    to,
    `Target reached: ${title}`,
    [
      `Your experiment "${title}" just reached ${unique} unique human clicks — its pass bar was ${target}.`,
      '',
      'Now is a good time to check the measured funnel, add notes on what people said, and run the AI review so the team can decide what to do next.',
      '',
      appUrl(env, `/experiments/${experimentId}`),
      '',
      '— Launch Lab',
    ].join('\n'),
  )
}
