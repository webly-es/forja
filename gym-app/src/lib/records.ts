import type { SetLog } from '../types'
import { estimateOneRepMax } from './workoutHistory'
import { loadOf } from './bodyweight'

export type RecordKind = 'weight' | 'strength'

type LoggedSet = Pick<SetLog, 'weightKg' | 'bodyKg' | 'reps'>

export interface PersonalRecord {
  kind: RecordKind
  set: LoggedSet
  previous: LoggedSet
}

// Below this, a "better" estimated 1RM is just rounding noise between similar sets.
const MIN_STRENGTH_GAIN = 0.01
// The 1RM estimate overrates high-rep sets, so those only count as weight records.
const MAX_REPS_FOR_STRENGTH = 15

const pick = ({ weightKg, bodyKg, reps }: LoggedSet): LoggedSet => ({ weightKg, bodyKg, reps })

// Is this set a new personal best against every earlier set of the exercise?
// Heaviest load wins first; otherwise a clearly higher estimated 1RM (e.g. 50×12 beating 52,5×6).
// On bodyweight exercises earlier sets are counted at today's body weight, so a heavier
// weigh-in alone never makes a record: only more added weight or more reps do.
// No record on the very first set ever logged: there's nothing to beat yet.
export function detectRecord(set: LoggedSet, previousSets: SetLog[]): PersonalRecord | null {
  if (previousSets.length === 0 || set.reps <= 0) return null
  const load = loadOf(set)
  const loadOfPrevious = (s: LoggedSet) => (set.bodyKg != null ? set.bodyKg + s.weightKg : loadOf(s))

  const heaviest = previousSets.reduce((best, s) =>
    loadOfPrevious(s) > loadOfPrevious(best) || (loadOfPrevious(s) === loadOfPrevious(best) && s.reps > best.reps) ? s : best,
  )
  if (load > loadOfPrevious(heaviest)) {
    return { kind: 'weight', set: pick(set), previous: pick(heaviest) }
  }

  if (set.reps > MAX_REPS_FOR_STRENGTH) return null

  const strongest = previousSets.reduce((best, s) =>
    estimateOneRepMax(loadOfPrevious(s), s.reps) > estimateOneRepMax(loadOfPrevious(best), best.reps) ? s : best,
  )
  const before = estimateOneRepMax(loadOfPrevious(strongest), strongest.reps)
  if (estimateOneRepMax(load, set.reps) > before * (1 + MIN_STRENGTH_GAIN)) {
    return { kind: 'strength', set: pick(set), previous: pick(strongest) }
  }
  return null
}
