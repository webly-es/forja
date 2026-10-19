import { MUSCLE_GROUPS, type MuscleGroup } from '../../lib/muscleGroups'
import type { Exercise, RoutineItem } from '../../types'

// How the routine spreads over muscles: exercises per group, and sets when prescribed.
export function MuscleBalance({ items, exercisesById }: { items: RoutineItem[]; exercisesById: Map<number, Exercise> }) {
  const byGroup = new Map<MuscleGroup, { exercises: number; sets: number }>()
  for (const item of items) {
    const group = exercisesById.get(item.exerciseId)?.muscleGroup
    if (!group) continue
    const entry = byGroup.get(group) ?? { exercises: 0, sets: 0 }
    entry.exercises++
    entry.sets += item.sets ?? 0
    byGroup.set(group, entry)
  }
  if (byGroup.size === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {MUSCLE_GROUPS.filter((g) => byGroup.has(g)).map((g) => {
        const { exercises, sets } = byGroup.get(g)!
        return (
          <span key={g} className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-text-muted">
            {g} <span className="font-medium text-accent">{exercises}</span>
            {sets > 0 && <span className="text-text-muted/70"> · {sets} series</span>}
          </span>
        )
      })}
    </div>
  )
}
