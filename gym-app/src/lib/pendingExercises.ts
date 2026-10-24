import type { SkipReason, WorkoutSession } from '../types'

export const PENDING_DAYS = 10

export interface PendingExercise {
  exerciseId: number
  routineId: number
  routineName: string
  reason: SkipReason
}

// Exercises left completely undone in recent sessions and not done since, newest first.
// Ones in today's routine are already covered; ones left for pain are only mentioned, never added.
export function findPending(
  recent: WorkoutSession[], // finished sessions before the current one, any order
  doneBySession: Map<number, Set<number>>, // exercise ids with sets, per session (current one included)
  current: WorkoutSession,
  todayIds: Set<number>,
): { recover: PendingExercise[]; painful: PendingExercise[] } {
  const ordered = [...recent].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  const doneSince = new Set(doneBySession.get(current.id!) ?? [])
  const seen = new Set<number>()
  const recover: PendingExercise[] = []
  const painful: PendingExercise[] = []
  for (const session of ordered) {
    const done = doneBySession.get(session.id!) ?? new Set<number>()
    for (const skip of session.skipped ?? []) {
      const id = skip.exerciseId
      if (seen.has(id) || done.has(id) || doneSince.has(id) || todayIds.has(id)) continue
      seen.add(id)
      const item = { exerciseId: id, routineId: session.routineId, routineName: session.routineName, reason: skip.reason }
      if (skip.reason === 'pain') painful.push(item)
      else recover.push(item)
    }
    for (const id of done) doneSince.add(id)
  }
  return { recover, painful }
}
