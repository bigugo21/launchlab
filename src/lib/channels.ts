/** Display names for channels — shared by the UI and the worker's AI prompt. */

import type { Channel } from '../schemas/launchlab-schemas'

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
