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

export interface OrphanedSetGroup {
  exerciseId: number
  count: number
  minDate: string
  maxDate: string
  minWeight: number
  maxWeight: number
  routineNames: string[]
}

// Diagnostic, read-only: finds sets whose exerciseId no longer matches any
// row in the exercises catalog (e.g. an exercise that got deleted and
// re-created under a new id instead of renamed in place — see RENAME_MAP in
// db/seed.ts for the pattern that's supposed to prevent this). These sets
// are invisible in History and in the "última vez"/"máximo" badges because
// both look up by current exerciseId.
export async function getOrphanedSetsSummary(profileId: number): Promise<OrphanedSetGroup[]> {
  const [sets, exercises] = await Promise.all([
    db.sets.where('profileId').equals(profileId).toArray(),
    db.exercises.toArray(),
  ])
  const existingIds = new Set(exercises.map((e) => e.id))
  const orphaned = sets.filter((s) => !existingIds.has(s.exerciseId))
  if (orphaned.length === 0) return []

  const sessionIds = [...new Set(orphaned.map((s) => s.sessionId))]
  const sessions = await db.workoutSessions.bulkGet(sessionIds)
  const routineNameBySession = new Map(sessions.filter(Boolean).map((s) => [s!.id, s!.routineName]))

  const byExercise = new Map<number, SetLog[]>()
  for (const s of orphaned) {
    const list = byExercise.get(s.exerciseId) ?? []
    list.push(s)
    byExercise.set(s.exerciseId, list)
  }

  return [...byExercise.entries()]
    .map(([exerciseId, group]) => ({
      exerciseId,
      count: group.length,
      minDate: group.reduce((a, b) => (a.completedAt < b.completedAt ? a : b)).completedAt,
      maxDate: group.reduce((a, b) => (a.completedAt > b.completedAt ? a : b)).completedAt,
      minWeight: Math.min(...group.map((s) => s.weightKg)),
      maxWeight: Math.max(...group.map((s) => s.weightKg)),
      routineNames: [
        ...new Set(
          group.map((s) => routineNameBySession.get(s.sessionId)).filter((n): n is string => Boolean(n)),
        ),
      ],
    }))
    .sort((a, b) => a.minDate.localeCompare(b.minDate))
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

export async function deleteWorkoutSession(sessionId: number) {
  await db.transaction('rw', db.workoutSessions, db.sets, async () => {
    await db.sets.where('sessionId').equals(sessionId).delete()
    await db.workoutSessions.delete(sessionId)
  })
}

export async function deleteCardioSession(sessionId: number) {
  await db.cardioSessions.delete(sessionId)
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
