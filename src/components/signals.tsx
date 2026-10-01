/** Attention panel: GitHub stars/forks for the repo an experiment is trying to move. */

import { useState } from 'react'
import { useMutations, useQuery } from 'deepspace'
import { Button, Input, useToast } from '@/components/ui'
import type { Experiment, Signal } from '../schemas/launchlab-schemas'
import { callAction } from './verdicts'

/** Same normalisation as the worker: "owner/repo" from a slug or github.com URL. */
function subjectOf(input: string | undefined): string | undefined {
  const m = /^(?:https?:\/\/(?:www\.)?github\.com\/)?([A-Za-z0-9-]+\/[A-Za-z0-9._-]+?)(?:\.git)?\/?$/i.exec(
    (input ?? '').trim(),
  )
  return m?.[1]
}

export function AttentionPanel({
  experimentId,
  exp,
  canEdit,
}: {
  experimentId: string
  exp: { recordId: string; data: Experiment }
  canEdit: boolean
}) {
  const { records } = useQuery<Signal>('signals', { where: { experimentId } })
  const { put, ready } = useMutations<Experiment>('experiments')
  const [repoInput, setRepoInput] = useState(exp.data.githubRepo ?? '')
  const [busy, setBusy] = useState(false)
  const { error } = useToast()

  const subject = subjectOf(exp.data.githubRepo)
  const series = records
    .map((r) => r.data)
    .filter((s) => s.subject === subject)
    .sort((a, b) => a.at - b.at)
  const first = series[0]
  const last = series[series.length - 1]

  async function refresh() {
    setBusy(true)
    try {
      await callAction('refreshSignals', { experimentId })
    } catch (e) {
      error('Refresh failed', e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveRepo() {
    const next = repoInput.trim()
    if (next && !subjectOf(next)) {
      error('Not a GitHub repo', 'Use owner/repo, e.g. deepdotspace/storynest')
      return
    }
    put(exp.recordId, { githubRepo: subjectOf(next) ?? '' })
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-card" data-testid="attention-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Attention on GitHub</h2>
          <p className="text-xs text-muted-foreground">
            Stars and forks of the repo this experiment is meant to move. Snapshotted daily while running.
          </p>
        </div>
        {canEdit && subject && (
          <Button size="sm" variant="outline" onClick={refresh} disabled={busy} data-testid="refresh-signals">
            {busy ? 'Refreshing…' : 'Refresh now'}
          </Button>
        )}
      </div>

      <div className="px-5 py-4">
        {!subject ? (
          <p className="text-sm text-muted-foreground">No repo tracked for this experiment.</p>
        ) : !last ? (
          <p className="text-sm text-muted-foreground">
            Tracking <span className="font-medium text-foreground">{subject}</span> — no snapshot yet.
            {canEdit && ' Press "Refresh now" to take the baseline.'}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Stars" now={last.metrics.stars} delta={last.metrics.stars - first.metrics.stars} />
            <Metric label="Forks" now={last.metrics.forks} delta={last.metrics.forks - first.metrics.forks} />
            <div className="text-xs text-muted-foreground">
              <div className="font-medium text-foreground">{subject}</div>
              {series.length} snapshot{series.length === 1 ? '' : 's'} · baseline{' '}
              {new Date(first.at * 1000).toLocaleString()}
              <br />
              latest {new Date(last.at * 1000).toLocaleString()}
            </div>
          </div>
        )}

        {canEdit && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Input
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="owner/repo, e.g. deepdotspace/storynest"
              className="h-8 w-72"
            />
            <Button size="sm" variant="ghost" onClick={saveRepo} disabled={!ready}>
              {subject ? 'Change repo' : 'Track repo'}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

function Metric({ label, now, delta }: { label: string; now: number; delta: number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {now}{' '}
        <span className={delta > 0 ? 'text-sm text-emerald-500' : 'text-sm text-muted-foreground'}>
          {delta >= 0 ? `+${delta}` : delta} since start
        </span>
      </div>
    </div>
  )
}
