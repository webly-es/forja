import { db } from './db'
import { getRoutineDraft, saveRoutine } from './routines'
import type { ExerciseSwap, WorkoutSession } from '../types'

// The routine's exercise a session card stands for (itself, unless it was swapped in today).
export function originalExercise(session: WorkoutSession, exerciseId: number): number {
  return session.swaps?.find((s) => s.to === exerciseId)?.from ?? exerciseId
}

function withSwap(swaps: ExerciseSwap[], from: number, to: number): ExerciseSwap[] {
  const rest = swaps.filter((s) => s.from !== from)
  return to === from ? rest : [...rest, { from, to }]
}

// Replaces an exercise for today's session only; the routine stays as it is.
export async function swapForSession(sessionId: number, shownExerciseId: number, to: number) {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return
  const from = originalExercise(session, shownExerciseId)
  await db.workoutSessions.update(sessionId, { swaps: withSwap(session.swaps ?? [], from, to) })
}

// Replaces it in the routine too (keeping its sets and reps), so next time it's already there.
export async function swapInRoutine(sessionId: number, shownExerciseId: number, to: number) {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return
  const from = originalExercise(session, shownExerciseId)
  const draft = await getRoutineDraft(session.routineId)
  if (draft) {
    const items = draft.items.some((i) => i.exerciseId === to)
      ? draft.items.filter((i) => i.exerciseId !== from)
      : draft.items.map((i) => (i.exerciseId === from ? { ...i, exerciseId: to } : i))
    await saveRoutine({ ...draft, items })
  }
  // The routine now has it, so today's session no longer needs the swap.
  await db.workoutSessions.update(sessionId, { swaps: (session.swaps ?? []).filter((s) => s.from !== from) })
}

// Session exercise ids in routine order with today's swaps applied. A swapped exercise
// that already has sets today stays, with its replacement right after it.
export function applySwaps(routineIds: number[], swaps: ExerciseSwap[] | undefined, loggedIds: Set<number>): { id: number; from: number }[] {
  const result: { id: number; from: number }[] = []
  for (const id of routineIds) {
    const swap = swaps?.find((s) => s.from === id)
    if (!swap) {
      result.push({ id, from: id })
      continue
    }
    if (loggedIds.has(id)) result.push({ id, from: id })
    if (!routineIds.includes(swap.to)) result.push({ id: swap.to, from: id })
  }
  return result
}
