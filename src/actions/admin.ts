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

export const deleteExperiment: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const experimentId = typeof params.experimentId === 'string' ? params.experimentId : ''
  if (!experimentId) return { success: false, error: 'experimentId is required' }
  if (!(await isAdmin(env, userId))) return { success: false, error: 'Only an admin can delete experiments' }

  const exp = await tools.get('experiments', experimentId)
  if (!exp.success) return { success: false, error: 'Experiment not found' }

  const deleted: Record<string, number> = {}
  try {
    // Children first, so a failure part-way never leaves orphans pointing at
    // a missing experiment; re-running finishes the job.
    for (const coll of CHILD_COLLECTIONS) deleted[coll] = await drain(tools, coll, { experimentId })
  } catch (e) {
    return { success: false, error: `Cleanup stopped part-way (safe to retry): ${e instanceof Error ? e.message : e}` }
  }
  const removed = await tools.remove('experiments', experimentId)
  if (!removed.success) return removed
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
