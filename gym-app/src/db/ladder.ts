import { db } from './db'
import { getCycleContext, getRecentContext, type CycleContext, type RecentContext } from './workoutReviews'
import { MET_CIRCUIT_TRAINING, estimateCalories } from '../lib/calories'
import { LADDER_DEFAULTS, sessionSeconds } from '../lib/ladder'
import { toDateKey } from '../lib/dates'
import type { Exercise, LadderAdvice, LadderSetup, Profile, Routine, SetLog, WorkoutSession } from '../types'

const PREVIOUS_SESSIONS = 4

export type LadderSession = WorkoutSession & { id: number; ladder: LadderSetup }

const isLadder = (s: WorkoutSession | undefined): s is LadderSession => s?.id != null && s.ladder != null

export function getRoutineExercises(routineId: number): Promise<Exercise[]> {
  return db.routineExercises
    .where('routineId')
    .equals(routineId)
    .sortBy('order')
    .then((links) => db.exercises.bulkGet(links.map((l) => l.exerciseId)))
    .then((list) => list.filter((ex): ex is Exercise => ex != null))
}

async function getFinishedLadderSessions(profileId: number, routineId: number): Promise<LadderSession[]> {
  const sessions = await db.workoutSessions.where('profileId').equals(profileId).toArray()
  return sessions
    .filter((s): s is LadderSession => isLadder(s) && s.routineId === routineId && s.finishedAt != null)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

export interface LadderStartValues {
  dumbbellKg?: number
  startReps: number
  restSeconds: number
  suggestion?: LadderAdvice // the AI's advice after the last circuit
}

// What to prefill before starting: last circuit's settings plus the coach's suggestion.
export async function getLastLadderSetup(profileId: number, routineId: number): Promise<LadderStartValues> {
  const [last] = await getFinishedLadderSessions(profileId, routineId)
  if (!last) return { ...LADDER_DEFAULTS }
  const review = await db.workoutReviews.get(last.id)
  return {
    dumbbellKg: last.ladder.dumbbellKg,
    startReps: last.ladder.startReps,
    restSeconds: last.ladder.restSeconds,
    suggestion: review?.ladder,
  }
}

export async function startLadderSession(
  profileId: number,
  routine: Routine,
  setup: Omit<LadderSetup, 'roundsDone'>,
): Promise<number> {
  return (await db.workoutSessions.add({
    profileId,
    routineId: routine.id!,
    routineName: routine.name,
    startedAt: new Date().toISOString(),
    ladder: { ...setup, roundsDone: 0 },
  })) as number
}

// One set per exercise and round, weight per dumbbell. setNumber is the round, so a
// skipped exercise doesn't shift the rounds of the others.
export async function logLadderRound(
  session: LadderSession,
  round: number,
  entries: { exerciseId: number; reps: number }[],
) {
  const completedAt = new Date().toISOString()
  await db.transaction('rw', db.sets, db.workoutSessions, async () => {
    for (const entry of entries) {
      if (entry.reps <= 0) continue
      await db.sets.add({
        sessionId: session.id,
        profileId: session.profileId,
        exerciseId: entry.exerciseId,
        setNumber: round,
        weightKg: session.ladder.dumbbellKg,
        reps: entry.reps,
        restSeconds: 0,
        completedAt,
      })
    }
    await db.workoutSessions.update(session.id, { ladder: { ...session.ladder, roundsDone: round } })
  })
}

export interface LadderFinish {
  minutes: number
  seconds: number
  calories: number
  hasSets: boolean
  bestSeconds?: number // best earlier full circuit with the same weight and reps
}

// Calories by MET of a vigorous circuit, the person's current weight and the real duration.
export async function finishLadderSession(sessionId: number): Promise<LadderFinish | undefined> {
  const session = await db.workoutSessions.get(sessionId)
  if (!isLadder(session)) return undefined
  const profile = await db.profiles.get(session.profileId)
  if (!profile) return undefined

  const finishedAt = new Date().toISOString()
  const seconds = sessionSeconds(session.startedAt, finishedAt)
  const minutes = Math.max(1, Math.round(seconds / 60))
  const calories = estimateCalories(MET_CIRCUIT_TRAINING, profile.weightKg, minutes)
  await db.workoutSessions.update(sessionId, { finishedAt, caloriesBurned: calories, met: MET_CIRCUIT_TRAINING })

  const hasSets = (await db.sets.where('sessionId').equals(sessionId).count()) > 0
  const bestSeconds = await getBestLadderSeconds({ ...session, finishedAt })
  return { minutes, seconds, calories, hasSets, bestSeconds }
}

const isComplete = (s: LadderSession) => s.ladder.roundsDone >= s.ladder.startReps

async function getBestLadderSeconds(session: LadderSession): Promise<number | undefined> {
  const others = (await getFinishedLadderSessions(session.profileId, session.routineId)).filter(
    (s) =>
      s.id !== session.id &&
      isComplete(s) &&
      s.ladder.dumbbellKg === session.ladder.dumbbellKg &&
      s.ladder.startReps === session.ladder.startReps,
  )
  if (others.length === 0) return undefined
  return Math.min(...others.map((s) => sessionSeconds(s.startedAt, s.finishedAt!)))
}

export interface LadderSummary {
  date: string // ISO datetime of the start
  dumbbellKg: number
  startReps: number
  restSeconds: number
  roundsDone: number
  seconds: number
  plannedReps: number
  doneReps: number
  shortfalls: string[] // "ronda 2, Sentadilla: 4 de 5"
}

function summarize(session: LadderSession, sets: SetLog[], exercises: Exercise[]): LadderSummary {
  const { startReps, roundsDone } = session.ladder
  const names = new Map(exercises.map((e) => [e.id!, e.name]))
  let plannedReps = 0
  for (let round = 1; round <= roundsDone; round++) plannedReps += (startReps - round + 1) * exercises.length

  const shortfalls: string[] = []
  for (const set of sets) {
    const expected = startReps - set.setNumber + 1
    if (set.reps < expected) shortfalls.push(`ronda ${set.setNumber}, ${names.get(set.exerciseId) ?? 'ejercicio'}: ${set.reps} de ${expected}`)
  }
  return {
    date: session.startedAt,
    dumbbellKg: session.ladder.dumbbellKg,
    startReps,
    restSeconds: session.ladder.restSeconds,
    roundsDone,
    seconds: session.finishedAt ? sessionSeconds(session.startedAt, session.finishedAt) : 0,
    plannedReps,
    doneReps: sets.reduce((sum, s) => sum + s.reps, 0),
    shortfalls,
  }
}

export interface LadderHistory {
  session: LadderSession
  profile: Profile
  exercises: Exercise[]
  today: LadderSummary
  previous: LadderSummary[] // newest first
  recent: RecentContext
  cycle?: CycleContext
}

// Everything the ladder coach needs: today's circuit, the last few and the week's context.
export async function getLadderHistory(sessionId: number): Promise<LadderHistory | undefined> {
  const session = await db.workoutSessions.get(sessionId)
  if (!isLadder(session)) return undefined
  const profile = await db.profiles.get(session.profileId)
  if (!profile) return undefined

  const exercises = await getRoutineExercises(session.routineId)
  const setsOf = (id: number) => db.sets.where('sessionId').equals(id).toArray()

  const previousSessions = (await getFinishedLadderSessions(session.profileId, session.routineId))
    .filter((s) => s.startedAt < session.startedAt)
    .slice(0, PREVIOUS_SESSIONS)
  const previous: LadderSummary[] = []
  for (const s of previousSessions) previous.push(summarize(s, await setsOf(s.id), exercises))

  const [today, recent, cycle] = await Promise.all([
    setsOf(session.id).then((sets) => summarize(session, sets, exercises)),
    getRecentContext(session.profileId),
    getCycleContext(profile, toDateKey(new Date(session.startedAt))),
  ])
  return { session, profile, exercises, today, previous, recent, cycle }
}
