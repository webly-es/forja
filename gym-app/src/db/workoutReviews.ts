import { db } from './db'
import { filterSetsFromFinishedSessions } from './queries'
import type { Exercise, ExerciseTarget, Profile, SetLog, WorkoutReview, WorkoutSession } from '../types'

const PREVIOUS_SESSIONS = 4

export interface PastSession {
  date: string // ISO datetime of the session start
  sets: SetLog[]
}

export interface ExerciseHistory {
  exercise: Exercise
  today: SetLog[]
  previous: PastSession[] // newest first
}

export interface SessionHistory {
  session: WorkoutSession
  profile: Profile
  exercises: ExerciseHistory[]
}

const bySetNumber = (a: SetLog, b: SetLog) => a.setNumber - b.setNumber

// Everything the coach needs: today's sets plus the last few finished sessions of each exercise.
export async function getSessionHistory(sessionId: number): Promise<SessionHistory | undefined> {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return undefined
  const profile = await db.profiles.get(session.profileId)
  if (!profile) return undefined

  const todaySets = await db.sets.where('sessionId').equals(sessionId).toArray()
  const exerciseIds = [...new Set(todaySets.map((s) => s.exerciseId))]
  const exercises = await db.exercises.bulkGet(exerciseIds)

  const result: ExerciseHistory[] = []
  for (const exercise of exercises) {
    if (!exercise?.id) continue
    const raw = await db.sets
      .where('exerciseId')
      .equals(exercise.id)
      .and((s) => s.profileId === session.profileId && s.sessionId !== sessionId)
      .toArray()
    const past = await filterSetsFromFinishedSessions(raw)
    const pastSessionIds = [...new Set(past.map((s) => s.sessionId))]
    const pastSessions = (await db.workoutSessions.bulkGet(pastSessionIds))
      .filter((s): s is WorkoutSession => s != null && s.startedAt < session.startedAt)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, PREVIOUS_SESSIONS)

    result.push({
      exercise,
      today: todaySets.filter((s) => s.exerciseId === exercise.id).sort(bySetNumber),
      previous: pastSessions.map((ps) => ({
        date: ps.startedAt,
        sets: past.filter((s) => s.sessionId === ps.id).sort(bySetNumber),
      })),
    })
  }
  return { session, profile, exercises: result }
}

export function getWorkoutReview(sessionId: number) {
  return db.workoutReviews.get(sessionId)
}

export function getExerciseTarget(profileId: number, exerciseId: number) {
  return db.exerciseTargets.where('[profileId+exerciseId]').equals([profileId, exerciseId]).first()
}

// Stores the review and turns each exercise's advice into its target for next time.
export async function saveWorkoutReview(review: WorkoutReview) {
  await db.transaction('rw', db.workoutReviews, db.exerciseTargets, async () => {
    await db.workoutReviews.put(review)
    for (const advice of review.exercises) {
      if (advice.nextWeightKg <= 0 || advice.nextReps <= 0) continue
      const target: Omit<ExerciseTarget, 'id'> = {
        profileId: review.profileId,
        exerciseId: advice.exerciseId,
        weightKg: advice.nextWeightKg,
        reps: advice.nextReps,
        comment: advice.comment,
        sessionId: review.sessionId,
        createdAt: review.createdAt,
      }
      const existing = await getExerciseTarget(review.profileId, advice.exerciseId)
      // An older session re-analysed from History must not overwrite a newer target
      // (session ids are auto-increment, so a higher id is a later workout).
      if (existing && existing.sessionId > review.sessionId) continue
      if (existing) await db.exerciseTargets.update(existing.id!, target)
      else await db.exerciseTargets.add(target)
    }
  })
}

export async function moveExerciseTargets(fromExerciseId: number, toExerciseId: number) {
  for (const row of await db.exerciseTargets.where('exerciseId').equals(fromExerciseId).toArray()) {
    if (await getExerciseTarget(row.profileId, toExerciseId)) await db.exerciseTargets.delete(row.id!)
    else await db.exerciseTargets.update(row.id!, { exerciseId: toExerciseId })
  }
}

export function deleteExerciseTargetsForExercise(exerciseId: number) {
  return db.exerciseTargets.where('exerciseId').equals(exerciseId).delete()
}
