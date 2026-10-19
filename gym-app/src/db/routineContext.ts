import { db } from './db'
import { getCycleContext, getRecentContext, type CycleContext, type ExerciseHistory, type RecentContext } from './workoutReviews'
import { todayKey } from '../lib/dates'
import type { Exercise, Profile, SetLog, WorkoutSession } from '../types'

const DEFAULT_WEEKS = 6

// One exercise's recent sessions, newest first, as the coach helpers expect them.
export interface ExerciseProgress {
  exercise: Exercise
  history: ExerciseHistory // `today` = the latest session
  lastDate: string
}

// Everything the routine coach knows about a person, built from what's on the device.
export interface TrainingContext {
  profile: Profile
  cycle?: CycleContext
  recent: RecentContext
  catalog: Exercise[]
  weeks: number
  sessions: WorkoutSession[] // finished strength sessions in the window, oldest first
  sets: SetLog[] // their sets
  progress: ExerciseProgress[]
}

export async function getTrainingContext(profileId: number, weeks = DEFAULT_WEEKS): Promise<TrainingContext | undefined> {
  const profile = await db.profiles.get(profileId)
  if (!profile) return undefined
  const since = new Date(Date.now() - weeks * 7 * 86_400_000).toISOString()

  const [catalog, allSessions, recent, cycle] = await Promise.all([
    db.exercises.toArray(),
    db.workoutSessions.where('profileId').equals(profileId).toArray(),
    getRecentContext(profileId),
    getCycleContext(profile, todayKey()),
  ])
  const sessions = allSessions
    .filter((s) => s.finishedAt && s.startedAt >= since)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const sessionIds = new Set(sessions.map((s) => s.id!))
  const sets = (await db.sets.where('profileId').equals(profileId).toArray()).filter((s) => sessionIds.has(s.sessionId))

  const startedAt = new Map(sessions.map((s) => [s.id!, s.startedAt]))
  const byId = new Map(catalog.map((e) => [e.id!, e]))
  const byExercise = new Map<number, Map<number, SetLog[]>>()
  for (const set of sets) {
    const perSession = byExercise.get(set.exerciseId) ?? new Map<number, SetLog[]>()
    perSession.set(set.sessionId, [...(perSession.get(set.sessionId) ?? []), set])
    byExercise.set(set.exerciseId, perSession)
  }

  const progress: ExerciseProgress[] = []
  for (const [exerciseId, perSession] of byExercise) {
    const exercise = byId.get(exerciseId)
    if (!exercise) continue
    const ordered = [...perSession.entries()]
      .map(([sessionId, list]) => ({ date: startedAt.get(sessionId)!, sets: list.sort((a, b) => a.setNumber - b.setNumber) }))
      .sort((a, b) => b.date.localeCompare(a.date))
    const [latest, ...previous] = ordered
    progress.push({ exercise, history: { exercise, today: latest.sets, previous }, lastDate: latest.date })
  }
  progress.sort((a, b) => b.lastDate.localeCompare(a.lastDate))

  return { profile, cycle, recent, catalog, weeks, sessions, sets, progress }
}
