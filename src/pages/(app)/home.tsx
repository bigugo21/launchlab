/* home pattern: data-forward — every experiment's readings (humans vs bar, signups, latest verdict) above the fold */

/**
 * The lab overview. Signed in: the team's real experiments. Signed out: the
 * same board with clearly labelled sample rows and an inline sign-in, since
 * anonymous visitors cannot read any collection (RBAC `'*': read false`).
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthOverlay, useAuth, useQuery } from 'deepspace'
import { ArrowRight, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui'
import {
  isUniqueHuman,
  type Click,
  type Conversion,
  type Decision,
  type Experiment,
  type ExperimentStatus,
  type Verdict,
} from '../../schemas/launchlab-schemas'
import { DecisionBadge, SampleBadge, StatusBadge, channelLabel } from '../../components/launchlab'

interface Row {
  id: string
  title: string
  channel: string
  status: ExperimentStatus
  humans: number
  target: number
  signups: number
  decision?: Decision
  sample?: boolean
}

const SAMPLE: Row[] = [
  { id: 's1', title: 'Show HN: clone Slack in an afternoon', channel: 'Hacker News', status: 'running', humans: 34, target: 50, signups: 6, decision: 'change' },
  { id: 's2', title: 'StoryNest fork-it thread on X', channel: 'X', status: 'closed', humans: 61, target: 40, signups: 9, decision: 'expand' },
  { id: 's3', title: 'r/webdev "skip the auth wiring" post', channel: 'Reddit', status: 'closed', humans: 31, target: 50, signups: 0, decision: 'stop' },
]

export default function HomePage() {
  const { isSignedIn, isLoaded } = useAuth()
  return isLoaded && !isSignedIn ? <Board rows={SAMPLE} sample /> : <LiveBoard />
}

function LiveBoard() {
  const { records: experiments, status } = useQuery<Experiment>('experiments', {
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  const { records: clicks } = useQuery<Click>('clicks')
  const { records: conversions } = useQuery<Conversion>('conversions')
  const { records: verdicts } = useQuery<Verdict>('verdicts', { orderBy: 'createdAt', orderDir: 'desc' })

  if (status === 'loading') return <BoardSkeleton />

  const rows: Row[] = experiments.map((e) => ({
    id: e.recordId,
    title: e.data.title,
    channel: channelLabel(e.data.channel),
    status: e.data.status ?? 'draft',
    humans: clicks.filter((c) => c.data.experimentId === e.recordId && isUniqueHuman(c.data)).length,
    target: e.data.targetClicks || 0,
    signups: conversions.filter((c) => c.data.experimentId === e.recordId && c.data.event === 'signup').length,
    decision: verdicts.find((v) => v.data.experimentId === e.recordId)?.data.decision,
    sample: !!e.data.sample,
  }))
  return <Board rows={rows} />
}

function Board({ rows, sample = false }: { rows: Row[]; sample?: boolean }) {
  const [signIn, setSignIn] = useState(false)
  const running = rows.filter((r) => r.status === 'running').length
  const humans = rows.reduce((s, r) => s + r.humans, 0)
  const signups = rows.reduce((s, r) => s + r.signups, 0)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">The lab</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every launch bet, what it measured, and what the evidence says to do next.
          </p>
        </div>
        {sample ? (
          <Button onClick={() => setSignIn(true)} data-testid="home-sign-in">
            Sign in to start
          </Button>
        ) : (
          <Link
            to="/experiments"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            New experiment <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </header>

      {sample && (
        <p className="mt-4 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground" data-testid="sample-note">
          <span className="font-semibold text-foreground">Sample data.</span> Sign in to see your team&apos;s real
          experiments — these rows only show what the board looks like.
        </p>
      )}

      <dl className="mt-6 grid grid-cols-3 gap-3">
        <Total label="running" value={running} />
        <Total label="unique humans" value={humans} />
        <Total label="signups measured" value={signups} />
      </dl>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border p-10 text-center">
          <FlaskConical className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-foreground">No experiments yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Log the first launch bet — a hypothesis, one tracked link, and the bar it must clear.
          </p>
          <Link to="/experiments" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            Create an experiment →
          </Link>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-card" data-testid="lab-board">
          {rows.map((r) => {
            const pct = r.target > 0 ? Math.min(100, Math.round((r.humans / r.target) * 100)) : 0
            const inner = (
              <div className="grid items-center gap-x-6 gap-y-2 px-4 py-3 sm:grid-cols-[1fr_11rem_5rem_6rem]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-foreground">{r.title}</span>
                    {r.sample && <SampleBadge />}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    {r.channel} <StatusBadge status={r.status} />
                  </div>
                </div>
                <div>
                  <div className="font-mono text-xs tabular-nums text-muted-foreground">
                    {r.humans} / {r.target} humans
                  </div>
                  <div className="mt-1 h-1.5 rounded bg-muted">
                    <div className="h-1.5 rounded bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="font-mono text-xs tabular-nums text-muted-foreground">
                  {r.signups} signup{r.signups === 1 ? '' : 's'}
                </div>
                <div className="sm:text-right">
                  {r.decision ? (
                    <DecisionBadge decision={r.decision} />
                  ) : (
                    <span className="text-xs text-muted-foreground">no verdict</span>
                  )}
                </div>
              </div>
            )
            return (
              <li key={r.id}>
                {sample ? (
                  inner
                ) : (
                  <Link to={`/experiments/${r.id}`} className="block hover:bg-muted">
                    {inner}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {signIn && <AuthOverlay onClose={() => setSignIn(false)} />}
    </div>
  )
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-2xl font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  )
}

function BoardSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8" aria-busy="true">
      <div className="h-7 w-32 animate-pulse rounded-md bg-muted" />
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="mt-6 space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    </div>
  )
}
