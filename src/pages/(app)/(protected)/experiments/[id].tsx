/**
 * One experiment: the bet, its tracked links, live click counts, and the
 * owner's controls (status, signups, notes).
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth, useMutations, useQuery, useUser } from 'deepspace'
import { Button, Input, Textarea, useToast } from '@/components/ui'
import {
  EXPERIMENT_STATUSES,
  type Click,
  type Experiment,
  type TrackedLink,
  isUniqueHuman,
} from '../../../../schemas/launchlab-schemas'
import { StatusBadge, ViewingNow, channelLabel, makeCode } from '../../../../components/launchlab'

export default function ExperimentPage() {
  const { id = '' } = useParams()
  const { userId } = useAuth()
  const { user } = useUser()
  const { records: experiments, status } = useQuery<Experiment>('experiments', {
    where: { recordId: id },
  })
  const { records: links } = useQuery<TrackedLink>('links', { where: { experimentId: id } })
  const { records: clicks } = useQuery<Click>('clicks', { where: { experimentId: id } })

  const exp = experiments[0]
  if (status === 'loading') return <p className="p-8 text-sm text-muted-foreground">Loading…</p>
  if (!exp) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Experiment not found. <Link to="/experiments" className="underline">Back to experiments</Link>
      </div>
    )
  }

  const canEdit = exp.createdBy === userId || user?.role === 'admin'
  const human = clicks.filter((c) => isUniqueHuman(c.data))
  const bots = clicks.filter((c) => c.data.isBot).length
  const repeats = clicks.filter((c) => !c.data.isBot && c.data.isRepeat).length
  const target = exp.data.targetClicks || 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/experiments" className="text-xs text-muted-foreground hover:text-foreground">
        ← Experiments
      </Link>
      <header className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">{exp.data.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {channelLabel(exp.data.channel)} · sends to{' '}
            <span className="break-all">{exp.data.destinationUrl}</span>
          </p>
        </div>
        <StatusBadge status={exp.data.status} />
      </header>
      <div className="mt-3">
        <ViewingNow scope={`experiment:${exp.recordId}`} />
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Unique humans" value={human.length} hint={`target ${target}`} testId="stat-clicks" />
        <Stat
          label="Not counted"
          value={bots + repeats}
          hint={`${bots} bot${bots === 1 ? '' : 's'} · ${repeats} repeat${repeats === 1 ? '' : 's'}`}
          testId="stat-not-counted"
        />
        <Stat label="Signups (reported)" value={exp.data.signups ?? 0} />
        <Stat
          label="Click → signup"
          value={human.length ? `${Math.round(((exp.data.signups ?? 0) / human.length) * 100)}%` : '—'}
        />
      </section>

      <section className="mt-6 grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-2">
        <Detail label="Hypothesis" value={exp.data.hypothesis} className="sm:col-span-2" />
        <Detail label="Smallest useful test" value={exp.data.smallestTest} />
        <Detail label="Success metric" value={exp.data.successMetric} />
      </section>

      <LinksPanel experimentId={id} links={links} clicks={clicks} canEdit={canEdit} />

      <RecentClicks clicks={clicks} links={links} />

      {canEdit && <OwnerControls exp={exp.data} recordId={exp.recordId} />}
    </div>
  )
}

function LinksPanel({
  experimentId,
  links,
  clicks,
  canEdit,
}: {
  experimentId: string
  links: { recordId: string; data: TrackedLink }[]
  clicks: { data: Click }[]
  canEdit: boolean
}) {
  const { createConfirmed, ready } = useMutations<TrackedLink>('links')
  const [label, setLabel] = useState('')
  const { error, success } = useToast()
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  async function addLink() {
    try {
      await createConfirmed({ experimentId, code: makeCode(), label: label.trim() || 'Main link' })
      setLabel('')
    } catch (e) {
      error('Could not create link', e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">Tracked links</h2>
        {canEdit && (
          <div className="flex gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label, e.g. r/webdev post"
              className="h-8 w-56"
            />
            <Button size="sm" onClick={addLink} disabled={!ready} data-testid="add-link">
              Add link
            </Button>
          </div>
        )}
      </div>
      {links.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          No links yet. Each place you post gets its own link so you can compare them.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {links.map((l) => {
            const url = `${origin}/go/${l.data.code}`
            const n = clicks.filter((c) => c.data.code === l.data.code && isUniqueHuman(c.data)).length
            return (
              <li key={l.recordId} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate text-foreground">{l.data.label}</span>
                <code className="rounded bg-muted px-2 py-0.5 text-xs" data-testid="link-url">
                  {url}
                </code>
                <span className="w-20 text-right tabular-nums text-muted-foreground">{n} {n === 1 ? 'click' : 'clicks'}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigator.clipboard.writeText(url).then(() => success('Link copied'))}
                >
                  Copy
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function RecentClicks({
  clicks,
  links,
}: {
  clicks: { recordId: string; data: Click }[]
  links: { data: TrackedLink }[]
}) {
  if (clicks.length === 0) return null
  const labelFor = new Map(links.map((l) => [l.data.code, l.data.label]))
  const recent = [...clicks].sort((a, b) => b.data.at - a.data.at).slice(0, 10)
  return (
    <section className="mt-6 rounded-lg border border-border bg-card">
      <h2 className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">
        Recent clicks <span className="font-normal text-muted-foreground">(live)</span>
      </h2>
      <ul className="divide-y divide-border text-sm" data-testid="recent-clicks">
        {recent.map((c) => (
          <li key={c.recordId} className="flex flex-wrap items-center gap-3 px-5 py-2">
            <span className="w-20 tabular-nums text-muted-foreground">
              {new Date(c.data.at * 1000).toLocaleTimeString()}
            </span>
            <span className="min-w-0 flex-1 truncate text-foreground">
              {labelFor.get(c.data.code) ?? c.data.code}
            </span>
            <span className="text-muted-foreground">{c.data.referrerHost || 'direct'}</span>
            <span className="w-8 text-muted-foreground">{c.data.country || '—'}</span>
            {c.data.isBot ? (
              <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">bot</span>
            ) : c.data.isRepeat ? (
              <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">repeat</span>
            ) : (
              <span className="rounded bg-primary/15 px-1.5 text-xs text-primary">human</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function OwnerControls({ exp, recordId }: { exp: Experiment; recordId: string }) {
  const { put, ready } = useMutations<Experiment>('experiments')
  const [signups, setSignups] = useState(String(exp.signups ?? 0))
  const [notes, setNotes] = useState(exp.notes ?? '')

  return (
    <section className="mt-6 grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-3">
      <div>
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">Status</div>
        <div className="flex gap-1">
          {EXPERIMENT_STATUSES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={exp.status === s ? 'default' : 'outline'}
              disabled={!ready}
              onClick={() => put(recordId, { status: s })}
              className="capitalize"
            >
              {s}
            </Button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">Signups attributed</div>
        <div className="flex gap-2">
          <Input
            type="number"
            min={0}
            value={signups}
            onChange={(e) => setSignups(e.target.value)}
            className="h-8"
          />
          <Button
            size="sm"
            disabled={!ready}
            onClick={() => put(recordId, { signups: Math.max(0, Number(signups) || 0) })}
          >
            Save
          </Button>
        </div>
      </div>
      <div className="sm:col-span-3">
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">
          Notes (what you saw while it ran — comments, objections, surprises)
        </div>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        <div className="mt-2 flex justify-end">
          <Button size="sm" variant="outline" disabled={!ready} onClick={() => put(recordId, { notes })}>
            Save notes
          </Button>
        </div>
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  hint,
  testId,
}: {
  label: string
  value: string | number
  hint?: string
  testId?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground" data-testid={testId}>
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

function Detail({ label, value, className }: { label: string; value?: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 whitespace-pre-wrap text-sm text-foreground">{value || '—'}</div>
    </div>
  )
}
