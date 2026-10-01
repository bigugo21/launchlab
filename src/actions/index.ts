import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { approveVerdict, reviewExperiment } from './review'

export const actions: Record<string, ActionHandler<Env>> = {
  reviewExperiment,
  approveVerdict,
}
