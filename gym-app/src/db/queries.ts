import { db } from './db'
import type { SetLog } from '../types'

// Returns the first set (lowest setNumber) logged for this exercise in the
// most recent session it appeared in — not just the most recently completed
// set overall, which tends to be the lightest set of that session (a
// dropset/burnout) and makes a poor reference weight for next time.
export async function getLastSetForExercise(
  profileId: number,
  exerciseId: number,
  excludeSessionId?: number,
): Promise<SetLog | undefined> {
  const sets = await db.sets
    .where('exerciseId')
    .equals(exerciseId)
    .and((s) => s.profileId === profileId && s.sessionId !== excludeSessionId)
    .toArray()
  if (sets.length === 0) return undefined
  const latestSessionId = sets.reduce((latest, s) => (s.completedAt > latest.completedAt ? s : latest)).sessionId
  const setsInLatestSession = sets.filter((s) => s.sessionId === latestSessionId)
  setsInLatestSession.sort((a, b) => a.setNumber - b.setNumber)
  return setsInLatestSession[0]
}

export async function getBestSetForExercise(
  profileId: number,
  exerciseId: number,
): Promise<SetLog | undefined> {
  const sets = await db.sets.where('exerciseId').equals(exerciseId).and((s) => s.profileId === profileId).toArray()
  sets.sort((a, b) => b.weightKg - a.weightKg || b.reps - a.reps)
  return sets[0]
}

export async function deleteSetAndRenumber(sessionId: number, exerciseId: number, setId: number) {
  await db.transaction('rw', db.sets, async () => {
    await db.sets.delete(setId)
    const remaining = await db.sets
      .where({ sessionId, exerciseId })
      .toArray()
      .then((sets) => sets.sort((a, b) => a.setNumber - b.setNumber))
    for (let i = 0; i < remaining.length; i++) {
      const newSetNumber = i + 1
      if (remaining[i].setNumber !== newSetNumber) {
        await db.sets.update(remaining[i].id!, { setNumber: newSetNumber })
      }
    }
  })
}

export async function deleteRoutine(routineId: number) {
  await db.transaction('rw', db.routines, db.routineExercises, async () => {
    await db.routineExercises.where('routineId').equals(routineId).delete()
    await db.routines.delete(routineId)
  })
}

// Deletes a profile and everything scoped to it (weight log, workout
// sessions, sets, cardio sessions). Exercises/routines/exercisePhotos are
// shared across profiles and are left untouched.
export async function deleteProfile(profileId: number) {
  await db.transaction(
    'rw',
    db.profiles,
    db.bodyWeightLogs,
    db.workoutSessions,
    db.sets,
    db.cardioSessions,
    async () => {
      await db.bodyWeightLogs.where('profileId').equals(profileId).delete()
      await db.workoutSessions.where('profileId').equals(profileId).delete()
      await db.sets.where('profileId').equals(profileId).delete()
      await db.cardioSessions.where('profileId').equals(profileId).delete()
      await db.profiles.delete(profileId)
    },
  )
}
