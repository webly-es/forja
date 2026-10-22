import { db } from './db'
import { filterSetsFromFinishedSessions } from './queries'
import { getBalanceSeries, getWeightSeries, type BalanceDay, type SeriesPoint } from './progress'
import { shiftDateKey, toDateKey, todayKey } from '../lib/dates'
import { getCheckIn, getPeriodLogs } from './cycle'
import { getCycleStatus, type CycleStatus } from '../lib/cycle'
import type { SkippedDetail } from '../lib/sessionIncidents'
import type { CycleCheckIn, Exercise, ExerciseTarget, Profile, SetLog, WorkoutReview, WorkoutSession } from '../types'

const PREVIOUS_SESSIONS = 4
const RECENT_DAYS = 7
const RECENT_WEIGHT_DAYS = 14

export interface PastSession {
  date: string // ISO datetime of the session start
  sets: SetLog[]
}

export interface ExerciseHistory {
  exercise: Exercise
  today: SetLog[]
  previous: PastSession[] // newest first
  plannedSets?: number // the person's own setting, else the routine's
}

// Nutrition and body-weight context around the workout, so the coach can explain a bad day.
export interface RecentContext {
  balance: BalanceDay[] // full days only (today excluded), oldest first
  weights: SeriesPoint[] // oldest first
}

// Cycle status and check-in on the day of the session (female profiles that track it).
export interface CycleContext {
  status: CycleStatus | null
  checkIn?: CycleCheckIn
}

export interface SessionHistory {
  session: WorkoutSession
  profile: Profile
  exercises: ExerciseHistory[]
  recent: RecentContext
  cycle?: CycleContext
  skipped: SkippedDetail[] // exercises left undone or half done, with why (notes are on session)
}

export async function getCycleContext(profile: Profile, day: string): Promise<CycleContext | undefined> {
  if (profile.sex !== 'F' || !profile.cycle || profile.cycle.method === 'off') return undefined
  const [logs, checkIn] = await Promise.all([getPeriodLogs(profile.id!), getCheckIn(profile.id!, day)])
  return { status: getCycleStatus(profile.cycle, logs, day), checkIn }
}

// Always the last week from today, also when an older session is re-analysed from History:
// it is only context for the wording, the numbers that matter come from the sets.
export async function getRecentContext(profileId: number): Promise<RecentContext> {
  const today = todayKey()
  const weightSince = shiftDateKey(today, -RECENT_WEIGHT_DAYS)
  const [balance, weights] = await Promise.all([getBalanceSeries(profileId, RECENT_DAYS + 1), getWeightSeries(profileId)])
  return {
    balance: balance.filter((d) => d.date < today),
    weights: weights.filter((w) => w.date.slice(0, 10) > weightSince),
  }
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
  const [exercises, links, settings] = await Promise.all([
    db.exercises.bulkGet(exerciseIds),
    db.routineExercises.where('routineId').equals(session.routineId).toArray(),
    db.machineSettings.where('profileId').equals(session.profileId).toArray(),
  ])
  const plannedSets = (exerciseId: number) =>
    settings.find((s) => s.exerciseId === exerciseId)?.sets ?? links.find((l) => l.exerciseId === exerciseId)?.sets

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
      plannedSets: plannedSets(exercise.id),
    })
  }
  const [recent, cycle, skippedExercises] = await Promise.all([
    getRecentContext(session.profileId),
    getCycleContext(profile, toDateKey(new Date(session.startedAt))),
    db.exercises.bulkGet((session.skipped ?? []).map((s) => s.exerciseId)),
  ])
  const skipped = (session.skipped ?? []).flatMap((s, i) => {
    const exercise = skippedExercises[i]
    return exercise ? [{ exercise, reason: s.reason, partial: exerciseIds.includes(s.exerciseId) }] : []
  })
  return { session, profile, exercises: result, recent, cycle, skipped }
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
