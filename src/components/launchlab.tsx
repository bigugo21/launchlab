/** Small shared pieces for Launch Lab pages. */

import { getUserColor, usePresenceRoom } from 'deepspace'
import { cn } from '@/lib/utils'
import type { Decision, ExperimentStatus } from '../schemas/launchlab-schemas'

export { channelLabel } from '../lib/channels'

const STATUS_STYLES: Record<ExperimentStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  running: 'bg-primary/15 text-primary',
  closed: 'bg-secondary text-secondary-foreground',
}

export function StatusBadge({ status }: { status: ExperimentStatus | undefined }) {
  const s = status ?? 'draft'
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', STATUS_STYLES[s])}>
      {s}
    </span>
  )
}

const DECISION_STYLES: Record<Decision, string> = {
  expand: 'bg-success/15 text-success',
  change: 'bg-warning/15 text-warning',
  stop: 'bg-destructive/15 text-destructive',
}

export function DecisionBadge({ decision }: { decision: Decision }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
        DECISION_STYLES[decision],
      )}
    >
      {decision}
    </span>
  )
}

/** Teammates looking at the same experiment right now (excludes you). */
export function ViewingNow({ scope }: { scope: string }) {
  const { peers, connected } = usePresenceRoom(scope)
  // One chip per person even if they have the page open in two tabs.
  const people = [...new Map(peers.map((p) => [p.userId, p])).values()]
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="viewing-now">
      <span
        className={cn('h-2 w-2 rounded-full', connected ? 'bg-success' : 'bg-border')}
        aria-hidden
      />
      {people.length === 0 ? (
        <span>Only you here</span>
      ) : (
        <>
          <span>Also viewing:</span>
          {people.map((p) => (
            <span
              key={p.userId}
              className="rounded-full px-2 py-0.5 font-medium text-white"
              style={{ backgroundColor: getUserColor(p.userId) }}
            >
              {p.userName || 'Teammate'}
            </span>
          ))}
        </>
      )}
    </div>
  )
}

/** Short, unambiguous link code (no 0/O/1/l). */
export function makeCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(7))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}
