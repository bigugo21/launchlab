/**
 * External attention signals (GitHub stars/forks) for experiments.
 *
 * One code path for both the manual "Refresh" action and the daily cron, so
 * they record identical snapshots. Calls go through the platform's `github`
 * integration (billed to the app owner, $0.0013 per call) — no GitHub token
 * lives in this app.
 */

import type { ActionTools } from 'deepspace/worker'
import type { Experiment, Signal } from '../schemas/launchlab-schemas.js'

const REPO_RE = /^([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})$/

/** Accepts "owner/repo" or a github.com URL; returns "owner/repo" or null. */
export function parseRepo(input: string | undefined): { owner: string; repo: string } | null {
  if (!input) return null
  const trimmed = input
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
  const m = REPO_RE.exec(trimmed)
  return m ? { owner: m[1], repo: m[2] } : null
}

type GithubRepo = {
  stargazers_count?: number
  forks_count?: number
  subscribers_count?: number
  watchers_count?: number
  open_issues_count?: number
}

export async function snapshotGithub(
  tools: ActionTools,
  experimentId: string,
  exp: Experiment,
): Promise<{ ok: true; signal: Signal } | { ok: false; error: string }> {
  const parsed = parseRepo(exp.githubRepo)
  if (!parsed) return { ok: false, error: 'No valid GitHub repo set (use owner/repo)' }

  const res = await tools.integration<GithubRepo>('github/get-repository', parsed)
  if (!res.success) return { ok: false, error: `GitHub lookup failed: ${res.error}` }
  const r = res.data
  if (typeof r?.stargazers_count !== 'number') return { ok: false, error: 'GitHub returned no repository data' }

  const signal: Signal = {
    experimentId,
    source: 'github',
    subject: `${parsed.owner}/${parsed.repo}`,
    at: Math.floor(Date.now() / 1000),
    metrics: {
      stars: r.stargazers_count,
      forks: r.forks_count ?? 0,
      watchers: r.subscribers_count ?? r.watchers_count ?? 0,
      openIssues: r.open_issues_count ?? 0,
    },
  }
  const created = await tools.create('signals', { ...signal })
  if (!created.success) return { ok: false, error: created.error }
  return { ok: true, signal }
}

export function repoSubject(input: string | undefined): string | undefined {
  const p = parseRepo(input)
  return p ? `${p.owner}/${p.repo}` : undefined
}

/** First and latest snapshot for the repo the experiment currently points at. */
export function githubDelta(signals: Signal[], subject: string | undefined) {
  const series = signals
    .filter((s) => s.source === 'github' && s.subject === subject)
    .sort((a, b) => a.at - b.at)
  if (series.length === 0) return null
  const first = series[0]
  const last = series[series.length - 1]
  return {
    subject: last.subject,
    first,
    last,
    snapshots: series.length,
    stars: last.metrics.stars - first.metrics.stars,
    forks: last.metrics.forks - first.metrics.forks,
  }
}
