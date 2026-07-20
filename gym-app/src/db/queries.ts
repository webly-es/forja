import { db } from './db'
import type { SetLog } from '../types'

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
  sets.sort((a, b) => b.completedAt.localeCompare(a.completedAt))
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
