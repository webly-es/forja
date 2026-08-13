import { MUSCLE_GROUPS } from './muscleGroups'
import type { Exercise } from '../types'

export function groupByMuscle(exercises: Exercise[]): [string, Exercise[]][] {
  const map = new Map<string, Exercise[]>()
  for (const ex of exercises) {
    const list = map.get(ex.muscleGroup) ?? []
    list.push(ex)
    map.set(ex.muscleGroup, list)
  }
  return [...map.entries()]
    .map(
      ([group, list]) => [group, list.sort((a, b) => a.name.localeCompare(b.name))] as [string, Exercise[]],
    )
    .sort((a, b) => MUSCLE_GROUPS.indexOf(a[0] as (typeof MUSCLE_GROUPS)[number]) - MUSCLE_GROUPS.indexOf(b[0] as (typeof MUSCLE_GROUPS)[number]))
}
