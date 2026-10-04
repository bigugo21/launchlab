import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { deleteExperiment, removeMember } from './admin'
import { approveVerdict, refreshSignals, reviewExperiment } from './review'

export const actions: Record<string, ActionHandler<Env>> = {
  reviewExperiment,
  approveVerdict,
  refreshSignals,
  deleteExperiment,
  removeMember,
}
