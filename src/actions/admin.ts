/**
 * Admin-only cleanup actions. Both re-check the caller's role on the server;
 * the UI hiding the buttons is not the protection.
 *
 * deleteExperiment — removes an experiment and everything keyed to it.
 * removeMember     — removes a member's profile row from this app's users
 *                    collection. It cannot delete their sign-in account (that
 *                    lives with the platform's auth service); signing in again
 *                    creates a fresh, empty member profile.
 */

import { resolveAppRole } from 'deepspace/worker'
import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { buildSampleLedger } from '../lib/sample-data'
import { snapshotGithub } from '../server/signals'
import type { Experiment } from '../schemas/launchlab-schemas'

/** Every collection that stores rows keyed by `experimentId`. */
const CHILD_COLLECTIONS = ['links', 'clicks', 'verdicts', 'signals', 'conversions', 'conversion_keys'] as const
const PAGE = 500

async function isAdmin(env: Env, userId: string): Promise<boolean> {
  if (env.OWNER_USER_ID && userId === env.OWNER_USER_ID) return true
  return (await resolveAppRole(env, userId)) === 'admin'
}

/** deleteWhere removes at most PAGE rows per call — drain until a short page. */
async function drain(tools: ActionTools, collection: string, where: Record<string, string>): Promise<number> {
  let total = 0
  for (let i = 0; i < 100; i++) {
    const r = await tools.deleteWhere(collection, where, PAGE)
    if (!r.success) throw new Error(`${collection}: ${r.error}`)
    total += r.data.deleted
    if (r.data.deleted < PAGE) return total
  }
  throw new Error(`${collection}: too many rows to delete in one request`)
}

/**
 * Children first, so a failure part-way never leaves orphans pointing at a
 * missing experiment; re-running finishes the job.
 */
async function deleteCascade(tools: ActionTools, experimentId: string): Promise<Record<string, number>> {
  const deleted: Record<string, number> = {}
  for (const coll of CHILD_COLLECTIONS) deleted[coll] = await drain(tools, coll, { experimentId })
  const removed = await tools.remove('experiments', experimentId)
  if (!removed.success) throw new Error(`experiments: ${removed.error}`)
  return deleted
}

export const deleteExperiment: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const experimentId = typeof params.experimentId === 'string' ? params.experimentId : ''
  if (!experimentId) return { success: false, error: 'experimentId is required' }
  if (!(await isAdmin(env, userId))) return { success: false, error: 'Only an admin can delete experiments' }

  const exp = await tools.get('experiments', experimentId)
  if (!exp.success) return { success: false, error: 'Experiment not found' }

  let deleted: Record<string, number>
  try {
    deleted = await deleteCascade(tools, experimentId)
  } catch (e) {
    return { success: false, error: `Cleanup stopped part-way (safe to retry): ${e instanceof Error ? e.message : e}` }
  }
  console.info(`[admin] deleteExperiment exp=${experimentId} by=${userId} ${JSON.stringify(deleted)}`)
  return { success: true, data: { deleted } }
}

export const removeMember: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const target = typeof params.userId === 'string' ? params.userId : ''
  if (!target) return { success: false, error: 'userId is required' }
  if (!(await isAdmin(env, userId))) return { success: false, error: 'Only an admin can remove members' }
  if (target === userId) return { success: false, error: 'You cannot remove yourself' }
  if (target === env.OWNER_USER_ID) return { success: false, error: 'The app owner cannot be removed' }

  // Their experiments must be deleted first, so nothing is left without an owner.
  const owned = await tools.query('experiments', { where: { createdBy: target }, limit: 1 })
  if (owned.success && owned.data.records.length > 0) {
    return { success: false, error: 'Delete this member’s experiments first' }
  }
  const removed = await tools.remove('users', target)
  if (!removed.success) return removed
  console.info(`[admin] removeMember user=${target} by=${userId}`)
  return { success: true, data: { removed: target } }
}

async function clearSamples(tools: ActionTools): Promise<number> {
  // `sample` is a 0/1 boolean column; filter in code rather than trust an
  // equality match on `true` (same reason as the Playbook page).
  const r = await tools.query('experiments', { limit: 1000 })
  if (!r.success) throw new Error(r.error)
  const samples = (r.data.records as unknown as { recordId: string; data: Experiment }[]).filter((e) => e.data.sample)
  for (const e of samples) await deleteCascade(tools, e.recordId)
  return samples.length
}

/** Replace any existing sample ledger with a fresh one. Admin only. */
export const loadSampleData: ActionHandler<Env> = async ({ userId, tools, env }) => {
  if (!(await isAdmin(env, userId))) return { success: false, error: 'Only an admin can load sample data' }
  try {
    await clearSamples(tools)
    const ledger = buildSampleLedger()
    let rows = 0
    for (const s of ledger) {
      const exp = await tools.create('experiments', { ...s.experiment })
      if (!exp.success) throw new Error(`experiment: ${exp.error}`)
      const experimentId = exp.data.recordId
      const linkIds = new Map<string, string>()
      for (const l of s.links) {
        const r = await tools.create('links', { experimentId, code: l.code, label: l.label })
        if (!r.success) throw new Error(`link: ${r.error}`)
        linkIds.set(l.code, r.data.recordId)
      }
      for (const c of s.clicks) {
        const r = await tools.create('clicks', { ...c, experimentId, linkId: linkIds.get(c.code) ?? '' })
        if (!r.success) throw new Error(`click: ${r.error}`)
      }
      for (const c of s.conversions) {
        const r = await tools.create('conversions', { ...c, experimentId })
        if (!r.success) throw new Error(`conversion: ${r.error}`)
      }
      // The one real number: a genuine GitHub snapshot via the integration.
      if (s.experiment.githubRepo) await snapshotGithub(tools, experimentId, s.experiment)
      rows += 1 + s.links.length + s.clicks.length + s.conversions.length
    }
    console.info(`[admin] loadSampleData by=${userId} experiments=${ledger.length} rows=${rows}`)
    return { success: true, data: { experiments: ledger.length, rows } }
  } catch (e) {
    return { success: false, error: `Loading stopped part-way (run it again to replace): ${e instanceof Error ? e.message : e}` }
  }
}

export const clearSampleData: ActionHandler<Env> = async ({ userId, tools, env }) => {
  if (!(await isAdmin(env, userId))) return { success: false, error: 'Only an admin can remove sample data' }
  try {
    const removed = await clearSamples(tools)
    console.info(`[admin] clearSampleData by=${userId} experiments=${removed}`)
    return { success: true, data: { removed } }
  } catch (e) {
    return { success: false, error: `Removal stopped part-way (safe to retry): ${e instanceof Error ? e.message : e}` }
  }
}
