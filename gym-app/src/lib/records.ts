import type { SetLog } from '../types'
import { estimateOneRepMax } from './workoutHistory'

export type RecordKind = 'weight' | 'strength'

export interface PersonalRecord {
  kind: RecordKind
  weightKg: number
  reps: number
  previous: { weightKg: number; reps: number }
}

// Below this, a "better" estimated 1RM is just rounding noise between similar sets.
const MIN_STRENGTH_GAIN = 0.01
// The 1RM estimate overrates high-rep sets, so those only count as weight records.
const MAX_REPS_FOR_STRENGTH = 15

// Is (weightKg × reps) a new personal best against every earlier set of the exercise?
// Heaviest weight wins first; otherwise a clearly higher estimated 1RM (e.g. 50×12 beating 52,5×6).
// No record on the very first set ever logged: there's nothing to beat yet.
export function detectRecord(weightKg: number, reps: number, previousSets: SetLog[]): PersonalRecord | null {
  if (previousSets.length === 0 || reps <= 0) return null

  const heaviest = previousSets.reduce((best, s) =>
    s.weightKg > best.weightKg || (s.weightKg === best.weightKg && s.reps > best.reps) ? s : best,
  )
  if (weightKg > heaviest.weightKg) {
    return { kind: 'weight', weightKg, reps, previous: { weightKg: heaviest.weightKg, reps: heaviest.reps } }
  }

  if (reps > MAX_REPS_FOR_STRENGTH) return null

  const strongest = previousSets.reduce((best, s) =>
    estimateOneRepMax(s.weightKg, s.reps) > estimateOneRepMax(best.weightKg, best.reps) ? s : best,
  )
  const before = estimateOneRepMax(strongest.weightKg, strongest.reps)
  if (estimateOneRepMax(weightKg, reps) > before * (1 + MIN_STRENGTH_GAIN)) {
    return { kind: 'strength', weightKg, reps, previous: { weightKg: strongest.weightKg, reps: strongest.reps } }
  }
  return null
}
