/** AI verdict display + the calls that create/approve verdicts. */

import { useState } from 'react'
import { getAuthToken, useQuery } from 'deepspace'
import { Button, useToast } from '@/components/ui'
import type { Verdict } from '../schemas/launchlab-schemas'
import { DecisionBadge } from './launchlab'

export async function callAction<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await getAuthToken()}`,
    },
    body: JSON.stringify(params),
  })
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; data?: T; error?: string }
  if (!res.ok || !body.success) throw new Error(body.error || `Request failed (${res.status})`)
  return body.data as T
}

export function VerdictCard({
  verdict,
  recordId,
  isAdmin,
  title,
}: {
  verdict: Verdict
  recordId: string
  isAdmin: boolean
  title?: React.ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const { error } = useToast()
  const ev = verdict.evidence

  async function setApproved(approve: boolean) {
    setBusy(true)
    try {
      await callAction('approveVerdict', { verdictId: recordId, approve })
    } catch (e) {
      error('Could not update verdict', e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="rounded-lg border border-border bg-card p-5" data-testid="verdict-card">
      <div className="flex flex-wrap items-center gap-3">
        <DecisionBadge decision={verdict.decision} />
        {title && <div className="min-w-0 flex-1 font-medium text-foreground">{title}</div>}
        {verdict.approved ? (
          <span className="text-xs font-medium text-success">✓ In playbook</span>
        ) : (
          <span className="text-xs text-muted-foreground">Awaiting admin approval</span>
        )}
      </div>
      {verdict.guardrailNote && (
        <p
          className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground"
          data-testid="guardrail-note"
        >
          <span className="font-semibold">Rule applied:</span> {verdict.guardrailNote}
        </p>
      )}
      <p className="mt-3 text-sm text-foreground">{verdict.summary}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ClaimList heading="Measured (computed from stored clicks)" items={verdict.proven} tone="proven" />
        <ClaimList heading="Still an assumption (AI)" items={verdict.assumed} tone="assumed" />
      </div>
      <div className="mt-4 rounded-md bg-muted/50 p-3 text-sm">
        <span className="font-medium text-foreground">Next smallest test: </span>
        <span className="text-foreground">{verdict.nextTest}</span>
      </div>
      {ev && (
        <p className="mt-3 text-xs text-muted-foreground">
          Judged on: {ev.humanClicks} unique humans of {ev.targetClicks} needed · {ev.signups} measured signup{ev.signups === 1 ? '' : 's'} ·{' '}
          {ev.clicks} raw clicks
        </p>
      )}
      {isAdmin && (
        <div className="mt-4 flex justify-end">
          {verdict.approved ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setApproved(false)}>
              Remove from playbook
            </Button>
          ) : (
            <Button size="sm" disabled={busy} onClick={() => setApproved(true)} data-testid="approve-verdict">
              Approve into playbook
            </Button>
          )}
        </div>
      )}
    </article>
  )
}

function ClaimList({
  heading,
  items,
  tone,
}: {
  heading: string
  items: string[]
  tone: 'proven' | 'assumed'
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{heading}</div>
      {items?.length ? (
        <ul className="space-y-1 text-sm text-foreground">
          {items.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className={tone === 'proven' ? 'text-success' : 'text-warning'} aria-hidden>
                {tone === 'proven' ? '✓' : '?'}
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing yet.</p>
      )}
    </div>
  )
}

/** Review panel on an experiment page: run a review, see the latest verdict. */
export function ReviewPanel({
  experimentId,
  canReview,
  isAdmin,
}: {
  experimentId: string
  canReview: boolean
  isAdmin: boolean
}) {
  const { records } = useQuery<Verdict>('verdicts', {
    where: { experimentId },
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  const [running, setRunning] = useState(false)
  const { error } = useToast()
  const latest = records[0]

  async function run() {
    setRunning(true)
    try {
      await callAction('reviewExperiment', { experimentId })
    } catch (e) {
      error('Review failed', e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">AI verdict</h2>
          <p className="text-xs text-muted-foreground">
            Measured facts are computed from stored clicks. Claude adds the judgment — assumptions and
            the next test — and code checks its decision against the data.
          </p>
        </div>
        {canReview && (
          <Button size="sm" onClick={run} disabled={running} data-testid="run-review">
            {running ? 'Reviewing…' : latest ? 'Re-run review' : 'Run AI review'}
          </Button>
        )}
      </div>
      {latest ? (
        <VerdictCard verdict={latest.data} recordId={latest.recordId} isAdmin={isAdmin} />
      ) : (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No verdict yet. Run a review once the experiment has some traffic.
        </p>
      )}
      {records.length > 1 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {records.length - 1} earlier verdict{records.length > 2 ? 's' : ''} kept for the record.
        </p>
      )}
    </section>
  )
}
