/**
 * Experiments ledger — every GTM bet the team is running, newest first,
 * with a form to log a new one.
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutations, useQuery } from 'deepspace'
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useToast,
} from '@/components/ui'
import {
  CHANNELS,
  type Click,
  type Experiment,
  isUniqueHuman,
} from '../../../../schemas/launchlab-schemas'
import { StatusBadge, channelLabel } from '../../../../components/launchlab'

const EMPTY_FORM = {
  title: '',
  hypothesis: '',
  channel: 'reddit' as Experiment['channel'],
  smallestTest: '',
  successMetric: '',
  targetClicks: '50',
  destinationUrl: 'https://deep.space',
  githubRepo: '',
}

export default function ExperimentsPage() {
  const { records: experiments, status } = useQuery<Experiment>('experiments', {
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  const { records: clicks } = useQuery<Click>('clicks')
  const [showForm, setShowForm] = useState(false)

  const clicksByExperiment = new Map<string, number>()
  for (const c of clicks) {
    if (!isUniqueHuman(c.data)) continue
    clicksByExperiment.set(c.data.experimentId, (clicksByExperiment.get(c.data.experimentId) ?? 0) + 1)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Experiments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each bet: a hypothesis, the smallest test, and a bar it has to clear.
          </p>
        </div>
        <Button data-testid="new-experiment" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : 'New experiment'}
        </Button>
      </header>

      {showForm && <NewExperimentForm onDone={() => setShowForm(false)} />}

      {status === 'loading' ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : experiments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No experiments yet. Log the first bet you want to test.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {experiments.map((e) => {
            const got = clicksByExperiment.get(e.recordId) ?? 0
            const target = e.data.targetClicks || 0
            const pct = target > 0 ? Math.min(100, Math.round((got / target) * 100)) : 0
            return (
              <li key={e.recordId}>
                <Link
                  to={`/experiments/${e.recordId}`}
                  className="flex flex-wrap items-center gap-4 px-4 py-3 hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{e.data.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {channelLabel(e.data.channel)} · {e.data.hypothesis || 'No hypothesis yet'}
                    </div>
                  </div>
                  <div className="w-40">
                    <div className="mb-1 text-right text-xs tabular-nums text-muted-foreground">
                      {got} / {target} clicks
                    </div>
                    <div className="h-1.5 rounded bg-muted">
                      <div className="h-1.5 rounded bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <StatusBadge status={e.data.status} />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function NewExperimentForm({ onDone }: { onDone: () => void }) {
  const { createConfirmed, ready } = useMutations<Experiment>('experiments')
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const { error } = useToast()
  const navigate = useNavigate()

  const set = (k: keyof typeof EMPTY_FORM) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    setSaving(true)
    try {
      const id = await createConfirmed({
        title: form.title.trim(),
        hypothesis: form.hypothesis.trim(),
        channel: form.channel,
        smallestTest: form.smallestTest.trim(),
        successMetric: form.successMetric.trim(),
        targetClicks: Math.max(1, Number(form.targetClicks) || 1),
        destinationUrl: form.destinationUrl.trim(),
        status: 'draft',
        signups: 0,
        notes: '',
        githubRepo: form.githubRepo.trim(),
      })
      onDone()
      navigate(`/experiments/${id}`)
    } catch (e) {
      error('Could not save experiment', e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      data-testid="experiment-form"
      className="mb-8 grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-2"
    >
      <Field label="Title" className="sm:col-span-2">
        <Input
          required
          value={form.title}
          onChange={(e) => set('title')(e.target.value)}
          placeholder="Show HN: 'Clone Slack in an afternoon' demo"
        />
      </Field>
      <Field label="Hypothesis" className="sm:col-span-2">
        <Textarea
          value={form.hypothesis}
          onChange={(e) => set('hypothesis')(e.target.value)}
          placeholder="Developers who already use Claude Code will click a 'skip the auth/db wiring' demo more than a feature list."
        />
      </Field>
      <Field label="Channel">
        <Select value={form.channel} onValueChange={set('channel')}>
          <SelectTrigger className="w-full" aria-label="Channel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNELS.map((c) => (
              <SelectItem key={c} value={c}>
                {channelLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Pass bar (unique human clicks)">
        <Input
          type="number"
          min={1}
          value={form.targetClicks}
          onChange={(e) => set('targetClicks')(e.target.value)}
        />
      </Field>
      <Field label="Smallest useful test" className="sm:col-span-2">
        <Input
          value={form.smallestTest}
          onChange={(e) => set('smallestTest')(e.target.value)}
          placeholder="One post, one link, 48 hours"
        />
      </Field>
      <Field label="Success metric">
        <Input
          value={form.successMetric}
          onChange={(e) => set('successMetric')(e.target.value)}
          placeholder="≥50 clicks and ≥5 signups"
        />
      </Field>
      <Field label="Where links send people">
        <Input
          type="url"
          required
          value={form.destinationUrl}
          onChange={(e) => set('destinationUrl')(e.target.value)}
        />
      </Field>
      <Field label="GitHub repo to move (optional)" className="sm:col-span-2">
        <Input
          value={form.githubRepo}
          onChange={(e) => set('githubRepo')(e.target.value)}
          placeholder="deepdotspace/storynest — tracks stars and forks while it runs"
        />
      </Field>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!ready || saving}>
          {saving ? 'Saving…' : 'Create experiment'}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
