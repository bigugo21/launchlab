/** Small shared pieces for Launch Lab pages. */

import { cn } from '@/lib/utils'
import type { Channel, Decision, ExperimentStatus } from '../schemas/launchlab-schemas'

const CHANNEL_LABELS: Record<Channel, string> = {
  reddit: 'Reddit',
  'hacker-news': 'Hacker News',
  x: 'X',
  linkedin: 'LinkedIn',
  discord: 'Discord',
  creator: 'Creator',
  newsletter: 'Newsletter',
  outbound: 'Outbound',
  event: 'Event',
  other: 'Other',
}

export function channelLabel(c: Channel | undefined): string {
  return c ? (CHANNEL_LABELS[c] ?? c) : '—'
}

const STATUS_STYLES: Record<ExperimentStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  running: 'bg-primary/15 text-primary',
  closed: 'bg-foreground/10 text-foreground',
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
  expand: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  change: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  stop: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
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

/** Short, unambiguous link code (no 0/O/1/l). */
export function makeCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(7))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}
