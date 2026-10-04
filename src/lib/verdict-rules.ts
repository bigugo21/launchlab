/**
 * Decision guardrail — the AI explains, but this code decides what it is
 * allowed to conclude. Kept free of worker imports so it is unit-testable.
 *
 *   expand  only if the pass bar was actually cleared
 *   stop    only if at least half the bar's traffic arrived (enough to say
 *           it fell short, not just that it hasn't run long enough)
 *   change  is always allowed — "keep testing, adjust one thing"
 */

import type { Decision } from '../schemas/launchlab-schemas'

export interface SampleFacts {
  humanClicks: number
  targetClicks: number
}

export function minSampleForStop(targetClicks: number): number {
  return Math.ceil(Math.max(1, targetClicks) / 2)
}

export function describeSample({ humanClicks, targetClicks }: SampleFacts): string {
  const target = Math.max(1, targetClicks)
  if (humanClicks >= target) return `bar cleared (${humanClicks}/${target}) — expand or stop are both allowed`
  if (humanClicks >= minSampleForStop(target)) {
    return `enough traffic to judge (${humanClicks}/${target}) but bar not cleared — stop or change allowed, not expand`
  }
  return `too little traffic to judge (${humanClicks}/${target}, need ${minSampleForStop(target)} to stop) — only change is allowed`
}

export interface MeasuredInputs extends SampleFacts {
  /** Measured downstream events (from POST /api/convert), not typed in. */
  signups: number
  activated: number
  paid: number
  /** Unique-human clicks per referring host (only hosts we actually saw). */
  knownSources: Record<string, number>
  /** Unique-human clicks with no referrer — source cannot be determined. */
  unknownSource: number
  bots: number
  repeats: number
  perLink: { label: string; uniqueHumans: number }[]
  /** Change in a tracked GitHub repo between the first and latest snapshot. */
  github?: { subject: string; stars: number; forks: number; starsNow: number; forksNow: number; snapshots: number }
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * The "proven" list is computed, never generated: each line restates a stored
 * number and nothing more, so it cannot over-claim.
 */
export function measuredFacts(m: MeasuredInputs): string[] {
  const target = Math.max(1, m.targetClicks)
  const facts = [
    `${plural(m.humanClicks, 'unique human click')} of the ${target} needed (${pct(m.humanClicks, target)}% of the pass bar).`,
    m.humanClicks > 0
      ? `${plural(m.signups, 'signup')} measured — ${pct(m.signups, m.humanClicks)}% of unique humans.`
      : `${plural(m.signups, 'signup')} measured.`,
  ]
  if (m.activated + m.paid > 0) {
    facts.push(`${plural(m.activated, 'activated developer')} and ${plural(m.paid, 'paying customer')} measured.`)
  }
  const known = Object.entries(m.knownSources).sort((a, b) => b[1] - a[1])
  const knownTotal = known.reduce((s, [, n]) => s + n, 0)
  if (knownTotal > 0) {
    facts.push(`Source known for ${knownTotal} of ${m.humanClicks}: ${known.map(([h, n]) => `${h} (${n})`).join(', ')}.`)
  }
  if (m.unknownSource > 0) {
    facts.push(`${plural(m.unknownSource, 'click')} had no referrer, so ${m.unknownSource === 1 ? 'its' : 'their'} source is unknown.`)
  }
  if (m.bots + m.repeats > 0) {
    facts.push(`Excluded: ${plural(m.bots, 'bot/preview request')} and ${plural(m.repeats, 'repeat visit')}.`)
  }
  if (m.github) {
    const g = m.github
    const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
    facts.push(
      g.snapshots > 1
        ? `GitHub ${g.subject}: ${sign(g.stars)} stars and ${sign(g.forks)} forks since the first snapshot (now ${plural(g.starsNow, 'star')}, ${plural(g.forksNow, 'fork')}).`
        : `GitHub ${g.subject}: one snapshot so far (${plural(g.starsNow, 'star')}, ${plural(g.forksNow, 'fork')}) — no change measured yet.`,
    )
  }
  if (m.perLink.length > 1) {
    facts.push(`By link: ${m.perLink.map((l) => `${l.label} ${l.uniqueHumans}`).join(' · ')}.`)
  }
  return facts
}

export function applyGuardrail(
  proposed: Decision,
  { humanClicks, targetClicks }: SampleFacts,
): { decision: Decision; note: string } {
  const target = Math.max(1, targetClicks)
  if (proposed === 'expand' && humanClicks < target) {
    return {
      decision: 'change',
      note: `AI proposed EXPAND, but only ${humanClicks} of ${target} needed unique humans arrived. Expanding requires clearing the bar.`,
    }
  }
  const min = minSampleForStop(target)
  if (proposed === 'stop' && humanClicks < min) {
    return {
      decision: 'change',
      note: `AI proposed STOP, but ${humanClicks} unique humans is too few to call it (need ${min}, half the bar). Keep testing.`,
    }
  }
  return { decision: proposed, note: '' }
}
