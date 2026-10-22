import type { SetLog } from '../types'

export interface SuggestedTarget {
  weightKg: number // added weight for bodyweight exercises
  reps: number
}

// Same double progression the AI coach uses, worked out offline from the last session of an exercise:
// every working set at the top of the range → smallest weight step and back to the bottom of it;
// otherwise the same weight and one rep more than the best set, never past the top.
export function suggestTarget(
  lastSession: SetLog[],
  repMin: number,
  repMax: number,
  { dumbbells = false }: { dumbbells?: boolean } = {},
): SuggestedTarget | undefined {
  if (lastSession.length === 0) return undefined
  // Working sets = those at the heaviest weight; lighter back-off sets don't count.
  const top = Math.max(...lastSession.map((s) => s.weightKg))
  const working = lastSession.filter((s) => s.weightKg === top)
  const bodyweight = lastSession.some((s) => s.bodyKg != null)
  if (top <= 0 && !bodyweight) return undefined
  const best = Math.max(...working.map((s) => s.reps))
  if (working.every((s) => s.reps >= repMax)) {
    return { weightKg: top + (dumbbells && !bodyweight ? 1 : 2.5), reps: repMin }
  }
  return { weightKg: top, reps: Math.min(repMax, Math.max(repMin, best + 1)) }
}
