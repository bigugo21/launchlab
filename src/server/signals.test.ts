import { describe, expect, it } from 'vitest'
import type { Signal } from '../schemas/launchlab-schemas'
import { githubDelta, parseRepo, repoSubject } from './signals'

describe('parseRepo', () => {
  it('accepts slugs and github URLs', () => {
    expect(parseRepo('deepdotspace/storynest')).toEqual({ owner: 'deepdotspace', repo: 'storynest' })
    expect(repoSubject('https://github.com/deepdotspace/storynest.git/')).toBe('deepdotspace/storynest')
  })
  it('rejects anything else', () => {
    for (const bad of ['', 'storynest', 'a/b/c', 'https://gitlab.com/x/y', '../etc/passwd']) {
      expect(parseRepo(bad)).toBeNull()
    }
  })
})

describe('githubDelta', () => {
  const snap = (at: number, stars: number, forks: number, subject = 'o/r'): Signal => ({
    experimentId: 'e',
    source: 'github',
    subject,
    at,
    metrics: { stars, forks, watchers: 0, openIssues: 0 },
  })
  it('measures change from the first to the latest snapshot of the current repo', () => {
    const d = githubDelta([snap(30, 12, 2), snap(10, 8, 1), snap(20, 50, 9, 'other/repo')], 'o/r')
    expect(d).toMatchObject({ stars: 4, forks: 1, snapshots: 2 })
  })
  it('returns null when the repo has no snapshots', () => {
    expect(githubDelta([snap(1, 1, 1)], 'x/y')).toBeNull()
  })
})
