/**
 * Clearly-labelled sample data so a first-time visitor sees a working ledger.
 *
 * Everything here is SYNTHETIC and every experiment is stored with
 * `sample: true`, which the UI renders as a SAMPLE badge + banner. Titles
 * describe plausible launch bets without attaching invented numbers to any
 * real product. Verdicts are NOT seeded: run the real AI review on these.
 *
 * Pure and deterministic (seeded PRNG) so it is unit-testable and every load
 * produces the same ledger.
 */

import type { Channel, Click, Conversion, ConversionEvent, Experiment } from '../schemas/launchlab-schemas'

export interface SampleExperiment {
  experiment: Experiment
  links: { code: string; label: string }[]
  clicks: Omit<Click, 'linkId' | 'experimentId'>[]
  conversions: Omit<Conversion, 'experimentId'>[]
}

interface Spec {
  title: string
  channel: Channel
  hypothesis: string
  smallestTest: string
  successMetric: string
  targetClicks: number
  githubRepo?: string
  notes: string
  links: { code: string; label: string; humans: number; referrers: [string, number][] }[]
  bots: number
  repeats: number
  funnel: Partial<Record<ConversionEvent, number>>
}

const SPECS: Spec[] = [
  {
    title: 'Show HN: clone Slack in an afternoon (demo app)',
    channel: 'hacker-news',
    hypothesis:
      'Developers who already use a coding agent will try an SDK when the post shows a finished multiplayer app, not a feature list.',
    smallestTest: 'One Show HN post linking a live demo, 48 hours.',
    successMetric: '≥50 unique humans and ≥5 signups',
    targetClicks: 50,
    notes:
      'Top comments asked about self-hosting and pricing after the free tier. Two people said they were tired of wiring auth + database + realtime by hand.',
    links: [
      { code: 'smplhn01', label: 'Show HN post', humans: 58, referrers: [['news.ycombinator.com', 41], ['', 17]] },
      { code: 'smplhn02', label: 'Demo README link', humans: 9, referrers: [['github.com', 6], ['', 3]] },
    ],
    bots: 14,
    repeats: 8,
    funnel: { signup: 11, activated: 4 },
  },
  {
    title: 'r/webdev: “skip the auth wiring” post',
    channel: 'reddit',
    hypothesis: 'Frontend developers on r/webdev feel the backend-glue pain enough to click a how-to post.',
    smallestTest: 'One text post with a single tracked link, 72 hours.',
    successMetric: '≥50 unique humans and ≥3 signups',
    targetClicks: 50,
    notes: 'Post was flagged as self-promotion by one moderator after 20 hours; replies were mostly about Supabase.',
    links: [{ code: 'smplrd01', label: 'r/webdev post', humans: 31, referrers: [['www.reddit.com', 19], ['', 12]] }],
    bots: 6,
    repeats: 3,
    funnel: { signup: 1 },
  },
  {
    title: 'Creator thread on X: fork-to-live in three commands',
    channel: 'creator',
    hypothesis: 'A short screen-recorded thread by a developer creator drives forks of an open-source example app.',
    smallestTest: 'One sponsored thread, one link to the repo, one week.',
    successMetric: '≥40 unique humans; repo forks move',
    targetClicks: 40,
    githubRepo: 'deepdotspace/storynest',
    notes: 'Thread got strong engagement but most replies were about the video tool, not the app.',
    links: [{ code: 'smplx001', label: 'Creator thread', humans: 14, referrers: [['t.co', 9], ['', 5]] }],
    bots: 22,
    repeats: 2,
    funnel: { signup: 2 },
  },
]

/** Small seeded PRNG (mulberry32) — deterministic output for tests. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const COUNTRIES = ['US', 'US', 'US', 'GB', 'DE', 'IN', 'CA', 'NG', 'FR', 'BR']

/** Build the sample ledger with timestamps spread over the last few days before `now`. */
export function buildSampleLedger(now: number = Math.floor(Date.now() / 1000)): SampleExperiment[] {
  return SPECS.map((spec, i) => {
    const rand = rng(1000 + i)
    const start = now - (6 - i * 2) * 86400
    const at = () => start + Math.floor(rand() * 2 * 86400)
    const country = () => COUNTRIES[Math.floor(rand() * COUNTRIES.length)]
    const clicks: SampleExperiment['clicks'] = []

    for (const link of spec.links) {
      for (const [host, n] of link.referrers) {
        for (let k = 0; k < n; k++) {
          clicks.push({ code: link.code, at: at(), referrerHost: host, country: country(), isBot: false, isRepeat: false })
        }
      }
    }
    const firstCode = spec.links[0].code
    for (let k = 0; k < spec.bots; k++) {
      clicks.push({ code: firstCode, at: at(), referrerHost: '', country: 'US', isBot: true, isRepeat: false })
    }
    for (let k = 0; k < spec.repeats; k++) {
      clicks.push({ code: firstCode, at: at(), referrerHost: '', country: country(), isBot: false, isRepeat: true })
    }

    const conversions: SampleExperiment['conversions'] = []
    for (const [event, n] of Object.entries(spec.funnel) as [ConversionEvent, number][]) {
      for (let k = 0; k < n; k++) {
        conversions.push({ code: firstCode, event, externalId: `sample-${i}-${k}`, at: at() })
      }
    }

    return {
      experiment: {
        title: spec.title,
        channel: spec.channel,
        hypothesis: spec.hypothesis,
        smallestTest: spec.smallestTest,
        successMetric: spec.successMetric,
        targetClicks: spec.targetClicks,
        destinationUrl: 'https://deep.space',
        status: i === 0 ? 'closed' : i === 1 ? 'closed' : 'running',
        signups: 0,
        notes: spec.notes,
        githubRepo: spec.githubRepo ?? '',
        sample: true,
        barNotifiedAt: now,
      },
      links: spec.links.map(({ code, label }) => ({ code, label })),
      clicks,
      conversions,
    }
  })
}
