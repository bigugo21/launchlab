/**
 * Playbook — approved verdicts only: what the team has actually learned,
 * grouped by decision so "do more of this" is at the top.
 */

import { Link } from 'react-router-dom'
import { useQuery, useUser } from 'deepspace'
import type { Experiment, Verdict } from '../../../schemas/launchlab-schemas'
import { channelLabel } from '../../../components/launchlab'
import { VerdictCard } from '../../../components/verdicts'

const ORDER = { expand: 0, change: 1, stop: 2 } as const

export default function PlaybookPage() {
  const { user } = useUser()
  // Filter in the page: `approved` is a boolean column stored as 0/1, and a
  // `where: { approved: true }` equality match does not hit stored 1s.
  const { records: allVerdicts, status } = useQuery<Verdict>('verdicts')
  const verdicts = allVerdicts.filter((v) => v.data.approved)
  const { records: experiments } = useQuery<Experiment>('experiments')
  const byId = new Map(experiments.map((e) => [e.recordId, e.data]))
  const sorted = [...verdicts].sort(
    (a, b) => ORDER[a.data.decision] - ORDER[b.data.decision] || b.updatedAt.localeCompare(a.updatedAt),
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-foreground">Playbook</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Lessons an admin approved from AI verdicts. Expand first, then what to change, then what to stop.
      </p>
      <div className="mt-6 space-y-4">
        {status === 'loading' ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Nothing approved yet. Run an AI review on an experiment, then approve it here.
          </p>
        ) : (
          sorted.map((v) => {
            const exp = byId.get(v.data.experimentId)
            return (
              <VerdictCard
                key={v.recordId}
                verdict={v.data}
                recordId={v.recordId}
                isAdmin={user?.role === 'admin'}
                title={
                  <Link to={`/experiments/${v.data.experimentId}`} className="hover:underline">
                    {exp?.title ?? 'Deleted experiment'}{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {channelLabel(exp?.channel)}
                    </span>
                  </Link>
                }
              />
            )
          })
        )}
      </div>
    </div>
  )
}
