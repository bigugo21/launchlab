import { describe, expect, it } from 'vitest'
import { isUniqueHuman } from '../schemas/launchlab-schemas'
import { buildSampleLedger } from './sample-data'
import { applyGuardrail } from './verdict-rules'

describe('sample ledger', () => {
  const ledger = buildSampleLedger(1_800_000_000)

  it('marks every experiment as sample data', () => {
    expect(ledger).toHaveLength(3)
    expect(ledger.every((s) => s.experiment.sample)).toBe(true)
  })

  it('is deterministic', () => {
    expect(buildSampleLedger(1_800_000_000)).toEqual(ledger)
  })

  it('covers all three guardrail outcomes', () => {
    const humans = ledger.map((s) => s.clicks.filter(isUniqueHuman).length)
    expect(humans).toEqual([67, 31, 14])
    // HN cleared its bar → EXPAND allowed; Reddit ≥ half bar → STOP allowed;
    // creator thread under the minimum sample → only CHANGE.
    expect(applyGuardrail('expand', { humanClicks: 67, targetClicks: 50 }).decision).toBe('expand')
    expect(applyGuardrail('stop', { humanClicks: 31, targetClicks: 50 }).decision).toBe('stop')
    expect(applyGuardrail('stop', { humanClicks: 14, targetClicks: 40 }).decision).toBe('change')
  })

  it('never puts a click outside its own links', () => {
    for (const s of ledger) {
      const codes = new Set(s.links.map((l) => l.code))
      expect(s.clicks.every((c) => codes.has(c.code))).toBe(true)
    }
  })
})
