import { describe, expect, it } from 'vitest'
import { applyGuardrail, describeSample, measuredFacts } from './verdict-rules'

describe('applyGuardrail', () => {
  it('turns an early STOP into CHANGE (the 5-of-50 case)', () => {
    const r = applyGuardrail('stop', { humanClicks: 5, targetClicks: 50 })
    expect(r.decision).toBe('change')
    expect(r.note).toMatch(/too few/)
  })

  it('allows STOP once half the bar has arrived', () => {
    expect(applyGuardrail('stop', { humanClicks: 25, targetClicks: 50 })).toEqual({
      decision: 'stop',
      note: '',
    })
  })

  it('refuses EXPAND below the bar, even with lots of traffic', () => {
    expect(applyGuardrail('expand', { humanClicks: 49, targetClicks: 50 }).decision).toBe('change')
  })

  it('allows EXPAND once the bar is cleared', () => {
    expect(applyGuardrail('expand', { humanClicks: 50, targetClicks: 50 }).decision).toBe('expand')
  })

  it('always allows CHANGE', () => {
    expect(applyGuardrail('change', { humanClicks: 0, targetClicks: 50 }).note).toBe('')
  })

  it('treats a zero/missing target as 1', () => {
    expect(applyGuardrail('stop', { humanClicks: 0, targetClicks: 0 }).decision).toBe('change')
    expect(applyGuardrail('expand', { humanClicks: 1, targetClicks: 0 }).decision).toBe('expand')
  })
})

describe('measuredFacts', () => {
  const base = {
    humanClicks: 5,
    targetClicks: 50,
    signups: 0,
    activated: 0,
    paid: 0,
    knownSources: { 'www.reddit.com': 1 },
    unknownSource: 4,
    bots: 2,
    repeats: 2,
    perLink: [{ label: 'Main link', uniqueHumans: 5 }],
  }

  it('states the numbers and nothing more (the over-claim case)', () => {
    const facts = measuredFacts(base)
    expect(facts).toEqual([
      '5 unique human clicks of the 50 needed (10% of the pass bar).',
      '0 signups measured — 0% of unique humans.',
      'Source known for 1 of 5: www.reddit.com (1).',
      '4 clicks had no referrer, so their source is unknown.',
      'Excluded: 2 bot/preview requests and 2 repeat visits.',
    ])
    // Never claims where unknown traffic did or did not come from.
    expect(facts.join(' ')).not.toMatch(/not (from )?reddit|direct/i)
  })

  it('handles no traffic and multiple links', () => {
    const facts = measuredFacts({
      ...base,
      humanClicks: 0,
      knownSources: {},
      unknownSource: 0,
      bots: 0,
      repeats: 0,
      perLink: [
        { label: 'HN', uniqueHumans: 0 },
        { label: 'X', uniqueHumans: 0 },
      ],
    })
    expect(facts).toEqual([
      '0 unique human clicks of the 50 needed (0% of the pass bar).',
      '0 signups measured.',
      'By link: HN 0 · X 0.',
    ])
  })
})

describe('measured funnel', () => {
  it('reports activation and payment only when they happened', () => {
    const facts = measuredFacts({
      humanClicks: 20,
      targetClicks: 20,
      signups: 4,
      activated: 2,
      paid: 1,
      knownSources: {},
      unknownSource: 0,
      bots: 0,
      repeats: 0,
      perLink: [],
    })
    expect(facts).toContain('4 signups measured — 20% of unique humans.')
    expect(facts).toContain('2 activated developers and 1 paying customer measured.')
  })
})

describe('github fact', () => {
  it('pluralises counts correctly', () => {
    const facts = measuredFacts({
      humanClicks: 2, targetClicks: 2, signups: 0, activated: 0, paid: 0,
      knownSources: {}, unknownSource: 2, bots: 0, repeats: 0, perLink: [],
      github: { subject: 'o/r', stars: 0, forks: 0, starsNow: 7, forksNow: 1, snapshots: 1 },
    })
    expect(facts.at(-1)).toBe('GitHub o/r: one snapshot so far (7 stars, 1 fork) — no change measured yet.')
  })
})

describe('describeSample', () => {
  it('tells the model what it may conclude', () => {
    expect(describeSample({ humanClicks: 5, targetClicks: 50 })).toMatch(/only change is allowed/)
    expect(describeSample({ humanClicks: 30, targetClicks: 50 })).toMatch(/not expand/)
    expect(describeSample({ humanClicks: 60, targetClicks: 50 })).toMatch(/bar cleared/)
  })
})
