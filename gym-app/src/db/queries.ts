import { db } from './db'
import type { SetLog } from '../types'
import { addSeedTombstone, tombstoneKeys } from './seedTombstones'

// Starting a routine (StartWorkout.startRoutine) creates a workoutSessions
// row immediately, before any set is logged. If the user backs out or closes
// the app without hitting "Finalizar", that session is left with no
// finishedAt forever — it's hidden from History (which only lists finished
// sessions) so it can never be deleted from there, but its sets are still in
// db.sets. Filtering them out here is what makes "Última vez"/"Máximo"
// ignore those abandoned sessions instead of surfacing stray/mistaken
// weights logged into a workout that was never actually completed.
async function filterSetsFromFinishedSessions(
  sets: SetLog[],
  includeSessionId?: number,
): Promise<SetLog[]> {
  const sessionIds = [...new Set(sets.map((s) => s.sessionId))]
  const sessions = await db.workoutSessions.bulkGet(sessionIds)
  const finishedSessionIds = new Set(
    sessions.filter((s) => s?.finishedAt).map((s) => s!.id!),
  )
  return sets.filter((s) => finishedSessionIds.has(s.sessionId) || s.sessionId === includeSessionId)
}

// Returns the first set (lowest setNumber) logged for this exercise in the
// most recent session it appeared in — not just the most recently completed
// set overall, which tends to be the lightest set of that session (a
// dropset/burnout) and makes a poor reference weight for next time.
export async function getLastSetForExercise(
  profileId: number,
  exerciseId: number,
  excludeSessionId?: number,
): Promise<SetLog | undefined> {
  const rawSets = await db.sets
    .where('exerciseId')
    .equals(exerciseId)
    .and((s) => s.profileId === profileId && s.sessionId !== excludeSessionId)
    .toArray()
  if (rawSets.length === 0) return undefined
  const sets = await filterSetsFromFinishedSessions(rawSets)
  if (sets.length === 0) return undefined
  const latestSessionId = sets.reduce((latest, s) => (s.completedAt > latest.completedAt ? s : latest)).sessionId
  const setsInLatestSession = sets.filter((s) => s.sessionId === latestSessionId)
  setsInLatestSession.sort((a, b) => a.setNumber - b.setNumber)
  return setsInLatestSession[0]
}

// currentSessionId lets the live "best set" badge include the in-progress
// session's own sets (so setting a new PR mid-workout updates it right
// away) even though that session isn't finished yet.
export async function getBestSetForExercise(
  profileId: number,
  exerciseId: number,
  currentSessionId?: number,
): Promise<SetLog | undefined> {
  const rawSets = await db.sets.where('exerciseId').equals(exerciseId).and((s) => s.profileId === profileId).toArray()
  const sets = await filterSetsFromFinishedSessions(rawSets, currentSessionId)
  sets.sort((a, b) => b.weightKg - a.weightKg || b.reps - a.reps)
  return sets[0]
}

// Assigns setNumber inside the transaction (instead of trusting a
// possibly-stale count computed at render time) so that saving two sets in
// quick succession — routine when finishing an exercise with a dropset —
// can never collide on the same setNumber.
export async function addSet(params: {
  sessionId: number
  profileId: number
  exerciseId: number
  weightKg: number
  reps: number
}) {
  return db.transaction('rw', db.sets, async () => {
    const existing = await db.sets
      .where({ sessionId: params.sessionId, exerciseId: params.exerciseId })
      .count()
    return db.sets.add({
      sessionId: params.sessionId,
      profileId: params.profileId,
      exerciseId: params.exerciseId,
      setNumber: existing + 1,
      weightKg: params.weightKg,
      reps: params.reps,
      restSeconds: 0,
      completedAt: new Date().toISOString(),
    })
  })
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
  await db.transaction('rw', db.routines, db.routineExercises, db.seedTombstones, async () => {
    const routine = await db.routines.get(routineId)
    if (routine) {
      await addSeedTombstone(tombstoneKeys.routine(routine.key))
    }
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
