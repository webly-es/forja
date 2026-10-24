import { DEFAULT_PRESCRIPTION } from './prescription'
import type { SessionAction } from './ai/sessionCoach'
import type { WorkoutEntry } from './sessionIncidents'

const WORK_SECONDS = 40 // one set, setup included
const CHANGE_SECONDS = 60 // moving to the next exercise
const MIN_SETS = 2

export const TIME_OPTIONS = [30, 45, 60, 75]

const plannedSets = (e: WorkoutEntry) => e.plan.sets ?? DEFAULT_PRESCRIPTION.sets
const restOf = (e: WorkoutEntry) => e.plan.restSeconds ?? DEFAULT_PRESCRIPTION.restSeconds

function secondsLeft(e: WorkoutEntry, sets: number, done: number): number {
  const left = Math.max(0, sets - done)
  if (left === 0) return 0
  return left * (WORK_SECONDS + restOf(e)) + (done === 0 ? CHANGE_SECONDS : 0)
}

// Minutes still needed for today's active exercises, given the sets already logged.
export function estimateMinutes(entries: WorkoutEntry[], doneSets: Map<number, number>): number {
  const total = entries.reduce((s, e) => s + secondsLeft(e, plannedSets(e), doneSets.get(e.exercise.id!) ?? 0), 0)
  return Math.round(total / 60)
}

// Fits what's left into `minutes`: first one set less on the last exercises (down to 2), then drops
// the last ones. Exercises already started and the first one of the day are never touched.
export function fitToTime(entries: WorkoutEntry[], doneSets: Map<number, number>, minutes: number): SessionAction[] {
  const budget = minutes * 60
  const sets = new Map(entries.map((e) => [e.exercise.id!, plannedSets(e)]))
  const dropped = new Set<number>()
  const total = () =>
    entries.reduce((s, e) => {
      const id = e.exercise.id!
      return dropped.has(id) ? s : s + secondsLeft(e, sets.get(id)!, doneSets.get(id) ?? 0)
    }, 0)

  // Candidates from the end of the workout towards the start.
  const adjustable = entries.slice(1).filter((e) => !doneSets.get(e.exercise.id!)).reverse()

  let trimmed = true
  while (total() > budget && trimmed) {
    trimmed = false
    for (const e of adjustable) {
      if (total() <= budget) break
      const id = e.exercise.id!
      if (sets.get(id)! > MIN_SETS) {
        sets.set(id, sets.get(id)! - 1)
        trimmed = true
      }
    }
  }
  for (const e of adjustable) {
    if (total() <= budget) break
    dropped.add(e.exercise.id!)
  }

  const actions: SessionAction[] = []
  for (const e of entries) {
    const id = e.exercise.id!
    if (dropped.has(id)) actions.push({ type: 'drop', exerciseId: id, reason: 'time' })
    else if (sets.get(id) !== plannedSets(e)) actions.push({ type: 'sets', exerciseId: id, sets: sets.get(id)! })
  }
  return actions
}
