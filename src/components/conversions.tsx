/**
 * Measured funnel + conversion-key setup for one experiment.
 *
 * The key is generated in the browser, shown ONCE, and only its SHA-256 is
 * stored (in `conversion_keys`, readable only by its creator and admins).
 */

import { useState } from 'react'
import { useMutations, useQuery } from 'deepspace'
import { Button, useToast } from '@/components/ui'
import type { Conversion, ConversionKey } from '../schemas/launchlab-schemas'

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function newKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return 'llk_' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function FunnelPanel({
  experimentId,
  uniqueHumans,
  conversions,
  canEdit,
  linkCode,
}: {
  experimentId: string
  uniqueHumans: number
  conversions: Conversion[]
  canEdit: boolean
  linkCode?: string
}) {
  const steps = [
    { label: 'Unique humans', n: uniqueHumans },
    { label: 'Signed up', n: conversions.filter((c) => c.event === 'signup').length },
    { label: 'Activated', n: conversions.filter((c) => c.event === 'activated').length },
    { label: 'Paid', n: conversions.filter((c) => c.event === 'paid').length },
  ]
  const top = Math.max(1, steps[0].n, ...steps.map((s) => s.n))

  return (
    <section className="mt-6 rounded-lg border border-border bg-card" data-testid="funnel-panel">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">Funnel (measured)</h2>
        <p className="text-xs text-muted-foreground">
          Clicks come from tracked links; signups, activation and payment are posted by your product&apos;s
          backend — nothing here is typed in by hand.
        </p>
      </div>
      <div className="space-y-2 px-5 py-4">
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1].n : 0
          return (
            <div key={s.label} className="flex items-center gap-3 text-sm">
              <span className="w-28 shrink-0 text-muted-foreground">{s.label}</span>
              <div className="h-6 flex-1 rounded bg-muted">
                {s.n > 0 && (
                  <div
                    className="h-6 rounded bg-primary/70"
                    style={{ width: `${Math.max(3, (s.n / top) * 100)}%` }}
                  />
                )}
              </div>
              <span className="w-10 text-right tabular-nums text-foreground" data-testid={`funnel-${i}`}>
                {s.n}
              </span>
              <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
                {i > 0 && prev > 0 ? `${Math.round((s.n / prev) * 100)}%` : ''}
              </span>
            </div>
          )
        })}
      </div>
      {canEdit && <KeySetup experimentId={experimentId} linkCode={linkCode} />}
    </section>
  )
}

function KeySetup({ experimentId, linkCode }: { experimentId: string; linkCode?: string }) {
  const { records: keys } = useQuery<ConversionKey>('conversion_keys', { where: { experimentId } })
  const { createConfirmed, remove, ready } = useMutations<ConversionKey>('conversion_keys')
  const [shownKey, setShownKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [testResult, setTestResult] = useState('')
  const { error, success } = useToast()
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  async function create() {
    setBusy(true)
    try {
      const key = newKey()
      await createConfirmed({ experimentId, keyHash: await sha256Hex(key), hint: key.slice(-4) })
      setShownKey(key)
    } catch (e) {
      error('Could not create key', e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  /** Calls the real endpoint exactly as a backend would — same key, same route. */
  async function sendTest() {
    if (!shownKey) return
    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { Authorization: `Bearer ${shownKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'signup', externalId: 'test-user-1', ...(linkCode ? { code: linkCode } : {}) }),
      })
      const body = (await res.json()) as { success?: boolean; duplicate?: boolean; error?: string }
      setTestResult(
        `${res.status} · ${body.success ? (body.duplicate ? 'accepted — duplicate, not counted again' : 'accepted — counted') : body.error}`,
      )
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : String(e))
    }
  }

  const example = shownKey
    ? `curl -X POST ${origin}/api/convert \\\n  -H "Authorization: Bearer ${shownKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"event":"signup","externalId":"user-123"${linkCode ? `,"code":"${linkCode}"` : ''}}'`
    : ''

  return (
    <div className="border-t border-border px-5 py-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {keys.length === 0
            ? 'No conversion key yet. Create one and give it to the backend that handles signups.'
            : `Active key${keys.length > 1 ? 's' : ''}: ${keys.map((k) => `…${k.data.hint}`).join(', ')} (only a hash is stored)`}
        </div>
        <div className="flex gap-2">
          {keys.map((k) => (
            <Button
              key={k.recordId}
              size="sm"
              variant="ghost"
              disabled={!ready}
              onClick={() => remove(k.recordId)}
            >
              Revoke …{k.data.hint}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={create} disabled={!ready || busy} data-testid="create-key">
            {keys.length ? 'New key' : 'Create conversion key'}
          </Button>
        </div>
      </div>
      {shownKey && (
        <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-xs font-medium text-foreground">
            Copy this key now — it will not be shown again.
          </p>
          <pre className="mt-2 overflow-x-auto whitespace-pre rounded bg-background p-2 text-xs" data-testid="key-example">
            {example}
          </pre>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={() => navigator.clipboard.writeText(shownKey).then(() => success('Key copied'))}
            >
              Copy key
            </Button>
            <Button size="sm" variant="outline" onClick={sendTest} data-testid="send-test">
              Send test signup (test-user-1)
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShownKey(null)}>
              I&apos;ve saved it
            </Button>
          </div>
          {testResult && (
            <p className="mt-2 text-xs text-foreground" data-testid="test-result">
              Endpoint replied: {testResult}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
