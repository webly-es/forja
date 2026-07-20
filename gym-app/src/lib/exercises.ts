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
    .sort((a, b) => a[0].localeCompare(b[0]))
}
