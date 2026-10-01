/**
 * Scheduled tasks, run by the per-app CronRoom (see worker.ts).
 *
 * daily-signals — once a day, snapshot GitHub stars/forks for every RUNNING
 * experiment that tracks a repo, so "since start" deltas build up without
 * anyone remembering to press Refresh.
 */

import type { CronTask } from 'deepspace/worker'
import type { Env } from '../worker'
import { createActionTools } from './server/action-routes'
import { snapshotGithub } from './server/signals'
import type { Experiment } from './schemas/launchlab-schemas'

export const tasks: CronTask[] = [{ name: 'daily-signals', schedule: '0 14 * * *', timezone: 'UTC' }]

export async function runTask(name: string, env: Env): Promise<void> {
  if (name !== 'daily-signals') return
  const tools = createActionTools(env, env.OWNER_USER_ID || 'system', '')
  const res = await tools.query('experiments', { where: { status: 'running' }, limit: 500 })
  if (!res.success) {
    console.error(`[cron] daily-signals query failed: ${res.error}`)
    return
  }
  const running = res.data.records as unknown as { recordId: string; data: Experiment }[]
  let ok = 0
  for (const e of running) {
    if (!e.data.githubRepo) continue
    const r = await snapshotGithub(tools, e.recordId, e.data)
    if (r.ok) ok++
    else console.warn(`[cron] github snapshot failed exp=${e.recordId}: ${r.error}`)
  }
  console.info(`[cron] daily-signals: ${ok} snapshot(s) from ${running.length} running experiment(s)`)
}
