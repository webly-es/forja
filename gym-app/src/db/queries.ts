import { db } from './db'
import type { SetLog } from '../types'
import { addSeedTombstone, tombstoneKeys } from './seedTombstones'
import { coverForGroups, type RoutineCover } from '../lib/routineCovers'
import type { MuscleGroup } from '../lib/muscleGroups'
import { loadOf } from '../lib/bodyweight'

// Starting a routine (StartWorkout.startRoutine) creates a workoutSessions
// row immediately, before any set is logged. If the user backs out or closes
// the app without hitting "Finalizar", that session is left with no
// finishedAt forever — it's hidden from History (which only lists finished
// sessions) so it can never be deleted from there, but its sets are still in
// db.sets. Filtering them out here is what makes "Última vez"/"Máximo"
// ignore those abandoned sessions instead of surfacing stray/mistaken
// weights logged into a workout that was never actually completed.
export async function filterSetsFromFinishedSessions(
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

// Every set to compare a new one against: finished sessions plus what's already
// logged in the session in progress.
export async function getPreviousSetsForExercise(
  profileId: number,
  exerciseId: number,
  currentSessionId: number,
): Promise<SetLog[]> {
  const rawSets = await db.sets.where('exerciseId').equals(exerciseId).and((s) => s.profileId === profileId).toArray()
  return filterSetsFromFinishedSessions(rawSets, currentSessionId)
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
  sets.sort((a, b) => loadOf(b) - loadOf(a) || b.reps - a.reps)
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
  bodyKg?: number
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
      bodyKg: params.bodyKg,
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
  await db.transaction('rw', db.workoutSessions, db.sets, db.workoutReviews, async () => {
    await db.sets.where('sessionId').equals(sessionId).delete()
    await db.workoutReviews.delete(sessionId)
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
// sessions, sets, cardio sessions, food log, steps, machine settings, AI reviews and targets, cycle logs and check-ins,
// routines it owns). Exercises, shared routines and exercisePhotos are left untouched.
export async function deleteProfile(profileId: number) {
  await db.transaction(
    'rw',
    [
      db.profiles,
      db.bodyWeightLogs,
      db.bodyMeasurements,
      db.workoutSessions,
      db.sets,
      db.cardioSessions,
      db.foodEntries,
      db.dailySteps,
      db.machineSettings,
      db.workoutReviews,
      db.exerciseTargets,
      db.periodLogs,
      db.cycleCheckIns,
      db.routines,
      db.routineExercises,
      db.trainingReports,
    ],
    async () => {
      const owned = (await db.routines.toArray()).filter((r) => r.profileId === profileId).map((r) => r.id!)
      await db.routineExercises.where('routineId').anyOf(owned).delete()
      await db.routines.bulkDelete(owned)
      await db.trainingReports.where('profileId').equals(profileId).delete()
      await db.bodyWeightLogs.where('profileId').equals(profileId).delete()
      await db.bodyMeasurements.where('profileId').equals(profileId).delete()
      await db.workoutSessions.where('profileId').equals(profileId).delete()
      await db.sets.where('profileId').equals(profileId).delete()
      await db.cardioSessions.where('profileId').equals(profileId).delete()
      await db.foodEntries.where('profileId').equals(profileId).delete()
      await db.dailySteps.where('profileId').equals(profileId).delete()
      await db.machineSettings.where('profileId').equals(profileId).delete()
      await db.workoutReviews.where('profileId').equals(profileId).delete()
      await db.exerciseTargets.where('profileId').equals(profileId).delete()
      await db.periodLogs.where('profileId').equals(profileId).delete()
      await db.cycleCheckIns.where('profileId').equals(profileId).delete()
      await db.profiles.delete(profileId)
    },
  )
}

export async function setDailySteps(profileId: number, date: string, steps: number) {
  const existing = await db.dailySteps
    .where('profileId')
    .equals(profileId)
    .and((d) => d.date === date)
    .first()
  if (existing) {
    await db.dailySteps.update(existing.id!, { steps })
  } else {
    await db.dailySteps.add({ profileId, date, steps })
  }
}

export interface RoutineSummary {
  exerciseCount: number
  cover: RoutineCover
}

// Exercise count and cover image for every routine, keyed by routine id.
export async function getRoutineSummaries(): Promise<Record<number, RoutineSummary>> {
  const [links, exercises, routines] = await Promise.all([
    db.routineExercises.toArray(),
    db.exercises.toArray(),
    db.routines.toArray(),
  ])
  const groupById = new Map(exercises.map((e) => [e.id!, e.muscleGroup]))
  // Circuits have their own cover instead of the one of their dominant muscle.
  const ladderIds = new Set(routines.filter((r) => r.format === 'ladder').map((r) => r.id!))
  const groupsByRoutine = new Map<number, MuscleGroup[]>()
  for (const link of links) {
    const group = groupById.get(link.exerciseId)
    const groups = groupsByRoutine.get(link.routineId) ?? []
    if (group) groups.push(group)
    groupsByRoutine.set(link.routineId, groups)
  }
  const summaries: Record<number, RoutineSummary> = {}
  for (const link of links) {
    summaries[link.routineId] ??= {
      exerciseCount: 0,
      cover: ladderIds.has(link.routineId) ? 'escalera' : coverForGroups(groupsByRoutine.get(link.routineId) ?? []),
    }
    summaries[link.routineId].exerciseCount++
  }
  return summaries
}

export interface NewCardioSession {
  activity: string
  durationMinutes: number
  met: number
  caloriesBurned: number
}

// Logs one cardio session per activity on the given local day (at the current time of day).
export async function addCardioSessions(
  profileId: number,
  dateKey: string,
  sessions: NewCardioSession[],
): Promise<number[]> {
  const now = new Date()
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds()).toISOString()
  return db.transaction('rw', db.cardioSessions, () =>
    Promise.all(
      sessions.map(
        (s) =>
          db.cardioSessions.add({
            profileId,
            activity: s.activity.trim(),
            durationMinutes: s.durationMinutes,
            met: s.met,
            caloriesBurned: s.caloriesBurned,
            date,
            createdAt: now.toISOString(),
          }) as Promise<number>,
      ),
    ),
  )
}
