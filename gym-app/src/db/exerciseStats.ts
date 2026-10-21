import { db } from './db'
import { filterSetsFromFinishedSessions } from './queries'
import type { MachineSetting, SetLog } from '../types'
import { loadOf } from '../lib/bodyweight'

export interface ExerciseStats {
  best?: SetLog // heaviest set (body share included), ties broken by reps (same rule as getBestSetForExercise)
  machine?: MachineSetting
}

// Record + machine setting of every exercise for one profile, in one pass
// (the catalog shows ~75 rows, so no per-row queries).
export async function getExerciseStats(profileId: number): Promise<Map<number, ExerciseStats>> {
  const [rawSets, machines] = await Promise.all([
    db.sets.where('profileId').equals(profileId).toArray(),
    db.machineSettings.where('profileId').equals(profileId).toArray(),
  ])
  const sets = await filterSetsFromFinishedSessions(rawSets)
  const stats = new Map<number, ExerciseStats>()
  for (const set of sets) {
    const entry = stats.get(set.exerciseId) ?? {}
    const best = entry.best
    if (!best || loadOf(set) > loadOf(best) || (loadOf(set) === loadOf(best) && set.reps > best.reps)) {
      entry.best = set
    }
    stats.set(set.exerciseId, entry)
  }
  for (const machine of machines) {
    stats.set(machine.exerciseId, { ...stats.get(machine.exerciseId), machine })
  }
  return stats
}
