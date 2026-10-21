import { db } from './db'
import { mergeSkipped } from '../lib/sessionIncidents'
import type { SessionAction } from '../lib/ai/sessionCoach'
import type { SessionNote, SkipReason } from '../types'

export async function appendNotes(sessionId: number, notes: SessionNote[]) {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return
  await db.workoutSessions.update(sessionId, { notes: [...(session.notes ?? []), ...notes] })
}

// Applies the coach's changes once accepted. Dropping also records why, for the review.
export async function applyCoachActions(sessionId: number, actions: SessionAction[]) {
  await db.transaction('rw', db.workoutSessions, async () => {
    const session = await db.workoutSessions.get(sessionId)
    if (!session) return
    const adjustments = session.adjustments ?? {}
    const dropped = new Set(adjustments.dropped ?? [])
    const sets = { ...adjustments.sets }
    const newPriority: number[] = []
    const skips: { exerciseId: number; reason: SkipReason }[] = []
    for (const action of actions) {
      if (action.type === 'drop') {
        dropped.add(action.exerciseId)
        skips.push({ exerciseId: action.exerciseId, reason: action.reason })
      } else if (action.type === 'sets') {
        sets[action.exerciseId] = action.sets
      } else {
        newPriority.push(action.exerciseId)
      }
    }
    // The latest priorities go first; older ones keep their relative order after them.
    const priority = [...newPriority, ...(adjustments.priority ?? []).filter((id) => !newPriority.includes(id))]
    await db.workoutSessions.update(sessionId, {
      adjustments: { dropped: [...dropped], sets, priority },
      skipped: skips.length ? mergeSkipped(session.skipped, skips) : session.skipped,
    })
  })
}

// Brings a dropped exercise back into today's workout.
export async function restoreExercise(sessionId: number, exerciseId: number) {
  await db.transaction('rw', db.workoutSessions, async () => {
    const session = await db.workoutSessions.get(sessionId)
    if (!session) return
    await db.workoutSessions.update(sessionId, {
      adjustments: { ...session.adjustments, dropped: (session.adjustments?.dropped ?? []).filter((id) => id !== exerciseId) },
      skipped: (session.skipped ?? []).filter((s) => s.exerciseId !== exerciseId),
    })
  })
}

export async function saveSkipped(sessionId: number, exerciseIds: number[], reason: SkipReason) {
  if (exerciseIds.length === 0) return
  await db.transaction('rw', db.workoutSessions, async () => {
    const session = await db.workoutSessions.get(sessionId)
    if (!session) return
    await db.workoutSessions.update(sessionId, {
      skipped: mergeSkipped(session.skipped, exerciseIds.map((exerciseId) => ({ exerciseId, reason }))),
    })
  })
}
