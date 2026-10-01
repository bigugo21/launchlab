/**
 * Launch Lab collections.
 *
 * experiments — one GTM bet: hypothesis, channel, smallest test, success bar.
 * links       — tracked short links (/go/<code>) that belong to an experiment.
 * clicks      — written ONLY by the worker's /go route (no role may create
 *               them from a client), so a click count cannot be forged from
 *               the browser.
 * verdicts    — written ONLY by the `reviewExperiment` server action (AI),
 *               approved by an admin before they count as Playbook entries.
 *
 * Every signed-in user is a `member` of one shared team ledger: they can read
 * everything and edit what they created. Admins (the app owner) can edit
 * anything and approve verdicts.
 */

import type { CollectionSchema } from 'deepspace/schema'

export const CHANNELS = [
  'reddit',
  'hacker-news',
  'x',
  'linkedin',
  'discord',
  'creator',
  'newsletter',
  'outbound',
  'event',
  'other',
] as const
export type Channel = (typeof CHANNELS)[number]

export const EXPERIMENT_STATUSES = ['draft', 'running', 'closed'] as const
export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number]

export const DECISIONS = ['expand', 'change', 'stop'] as const
export type Decision = (typeof DECISIONS)[number]

export interface Experiment {
  title: string
  hypothesis: string
  channel: Channel
  smallestTest: string
  successMetric: string
  /** Clicks needed for the test to count as a pass. */
  targetClicks: number
  destinationUrl: string
  status: ExperimentStatus
  /** Signups attributed to this experiment, entered by its owner. */
  signups: number
  /** Learnings the team noted while it ran (free text, fed to the AI review). */
  notes: string
  /** Optional "owner/repo" whose stars/forks this experiment is trying to move. */
  githubRepo?: string
  /** Unix seconds when the "target reached" email went out (0/absent = not yet). */
  barNotifiedAt?: number
}

export const CONVERSION_EVENTS = ['signup', 'activated', 'paid'] as const
export type ConversionEvent = (typeof CONVERSION_EVENTS)[number]

/** A measured downstream event, posted by the product's own backend. Worker-written. */
export interface Conversion {
  experimentId: string
  /** Link code that brought the user in (from utm_campaign), if known. */
  code: string
  event: ConversionEvent
  /** The product's own id for the user, ideally hashed — used only to de-duplicate. */
  externalId: string
  /** Unix seconds. */
  at: number
}

/** SHA-256 of an experiment's conversion key. The key itself is never stored. */
export interface ConversionKey {
  experimentId: string
  keyHash: string
  /** Last 4 characters, so the owner can tell keys apart. */
  hint: string
}

/** A point-in-time reading of an external attention metric. Worker-written. */
export interface Signal {
  experimentId: string
  source: 'github'
  /** e.g. "deepdotspace/storynest" */
  subject: string
  /** Unix seconds. */
  at: number
  metrics: { stars: number; forks: number; watchers: number; openIssues: number }
}

export interface TrackedLink {
  experimentId: string
  code: string
  label: string
}

export interface Click {
  linkId: string
  experimentId: string
  code: string
  /** Unix seconds. */
  at: number
  referrerHost: string
  country: string
  isBot: boolean
  /** Same browser already clicked this link in the last 24h. */
  isRepeat?: boolean
}

/** The number that counts: a human's first click on a link. */
export function isUniqueHuman(c: Click): boolean {
  return !c.isBot && !c.isRepeat
}

export interface Verdict {
  experimentId: string
  /** Final decision after the code guardrail. */
  decision: Decision
  /** What the model proposed, kept for audit. */
  aiDecision?: Decision
  /** Why the guardrail changed the model's decision ('' when it didn't). */
  guardrailNote?: string
  /** Measured facts, computed by the worker from stored clicks (not AI). */
  proven: string[]
  assumed: string[]
  nextTest: string
  summary: string
  /** Snapshot of the numbers the AI saw, so the verdict stays auditable. */
  evidence: { clicks: number; humanClicks: number; signups: number; targetClicks: number }
  approved: boolean
  approvedBy: string
}

const memberLedger = {
  '*': { read: false, create: false, update: false, delete: false },
  viewer: { read: true, create: false, update: false, delete: false },
  member: { read: true, create: true, update: 'own', delete: 'own' },
  admin: { read: true, create: true, update: true, delete: true },
} as const

const serverWritten = {
  '*': { read: false, create: false, update: false, delete: false },
  viewer: { read: true, create: false, update: false, delete: false },
  member: { read: true, create: false, update: false, delete: false },
  admin: { read: true, create: false, update: false, delete: true },
} as const

export const experimentsSchema: CollectionSchema = {
  name: 'experiments',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'hypothesis', storage: 'text', interpretation: 'plain' },
    { name: 'channel', storage: 'text', interpretation: { kind: 'select', options: [...CHANNELS] } },
    { name: 'smallestTest', storage: 'text', interpretation: 'plain' },
    { name: 'successMetric', storage: 'text', interpretation: 'plain' },
    { name: 'targetClicks', storage: 'number', interpretation: 'plain' },
    { name: 'destinationUrl', storage: 'text', interpretation: { kind: 'url' } },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: [...EXPERIMENT_STATUSES] },
    },
    { name: 'signups', storage: 'number', interpretation: 'plain' },
    { name: 'notes', storage: 'text', interpretation: 'plain' },
    { name: 'githubRepo', storage: 'text', interpretation: 'plain' },
    { name: 'barNotifiedAt', storage: 'number', interpretation: 'plain' },
  ],
  permissions: memberLedger,
}

export const signalsSchema: CollectionSchema = {
  name: 'signals',
  columns: [
    { name: 'experimentId', storage: 'text', interpretation: 'plain' },
    { name: 'source', storage: 'text', interpretation: { kind: 'select', options: ['github'] } },
    { name: 'subject', storage: 'text', interpretation: 'plain' },
    { name: 'at', storage: 'number', interpretation: 'plain' },
    { name: 'metrics', storage: 'text', interpretation: { kind: 'json' } },
  ],
  permissions: serverWritten,
}

export const linksSchema: CollectionSchema = {
  name: 'links',
  columns: [
    { name: 'experimentId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'code', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'label', storage: 'text', interpretation: 'plain' },
  ],
  // A short code must resolve to exactly one link.
  uniqueOn: ['code'],
  permissions: memberLedger,
}

export const clicksSchema: CollectionSchema = {
  name: 'clicks',
  columns: [
    { name: 'linkId', storage: 'text', interpretation: 'plain' },
    { name: 'experimentId', storage: 'text', interpretation: 'plain' },
    { name: 'code', storage: 'text', interpretation: 'plain' },
    { name: 'at', storage: 'number', interpretation: 'plain' },
    { name: 'referrerHost', storage: 'text', interpretation: 'plain' },
    { name: 'country', storage: 'text', interpretation: 'plain' },
    { name: 'isBot', storage: 'number', interpretation: { kind: 'boolean' } },
    { name: 'isRepeat', storage: 'number', interpretation: { kind: 'boolean' } },
  ],
  permissions: serverWritten,
}

export const verdictsSchema: CollectionSchema = {
  name: 'verdicts',
  columns: [
    { name: 'experimentId', storage: 'text', interpretation: 'plain' },
    { name: 'decision', storage: 'text', interpretation: { kind: 'select', options: [...DECISIONS] } },
    { name: 'aiDecision', storage: 'text', interpretation: { kind: 'select', options: [...DECISIONS] } },
    { name: 'guardrailNote', storage: 'text', interpretation: 'plain' },
    { name: 'proven', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'assumed', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'nextTest', storage: 'text', interpretation: 'plain' },
    { name: 'summary', storage: 'text', interpretation: 'plain' },
    { name: 'evidence', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'approved', storage: 'number', interpretation: { kind: 'boolean' } },
    { name: 'approvedBy', storage: 'text', interpretation: 'plain' },
  ],
  // Approval goes through the `approveVerdict` action (admin-gated), so no
  // client role updates verdicts directly.
  permissions: serverWritten,
}

export const conversionsSchema: CollectionSchema = {
  name: 'conversions',
  columns: [
    { name: 'experimentId', storage: 'text', interpretation: 'plain' },
    { name: 'code', storage: 'text', interpretation: 'plain' },
    { name: 'event', storage: 'text', interpretation: { kind: 'select', options: [...CONVERSION_EVENTS] } },
    { name: 'externalId', storage: 'text', interpretation: 'plain' },
    { name: 'at', storage: 'number', interpretation: 'plain' },
  ],
  // One signup (or activation, or payment) per user per experiment — enforced
  // by the room, so a retried or replayed webhook cannot inflate the funnel.
  uniqueOn: ['experimentId', 'event', 'externalId'],
  permissions: serverWritten,
}

export const conversionKeysSchema: CollectionSchema = {
  name: 'conversion_keys',
  columns: [
    { name: 'experimentId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'keyHash', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'hint', storage: 'text', interpretation: 'plain' },
  ],
  uniqueOn: ['keyHash'],
  // Only the key's creator (and admins) can even see the hash.
  permissions: {
    '*': { read: false, create: false, update: false, delete: false },
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: 'own', create: true, update: false, delete: 'own' },
    admin: { read: true, create: true, update: false, delete: true },
  },
}
