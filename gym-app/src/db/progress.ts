import { db } from './db'
import { filterSetsFromFinishedSessions } from './queries'
import { computeDailyEnergy } from '../lib/dailyEnergy'
import { shiftDateKey, todayKey } from '../lib/dates'
import { estimateOneRepMax } from '../lib/workoutHistory'
import type { MeasurementType } from '../lib/measurements'
import type { Exercise } from '../types'

export interface SeriesPoint {
  date: string // yyyy-mm-dd or ISO datetime, oldest first
  value: number
}

export interface BalanceDay {
  date: string // yyyy-mm-dd
  consumed: number
  spent: number
}

// Days with food logged in the last `days` days, oldest first.
export async function getBalanceSeries(profileId: number, days: number): Promise<BalanceDay[]> {
  const since = shiftDateKey(todayKey(), -days)
  const [profile, entries, steps, sessions, cardio] = await Promise.all([
    db.profiles.get(profileId),
    db.foodEntries.where('profileId').equals(profileId).and((e) => e.date > since).toArray(),
    db.dailySteps.where('profileId').equals(profileId).and((d) => d.date > since).toArray(),
    db.workoutSessions.where('profileId').equals(profileId).toArray(),
    db.cardioSessions.where('profileId').equals(profileId).toArray(),
  ])
  if (!profile) return []
  const consumedByDate = new Map<string, number>()
  for (const e of entries) consumedByDate.set(e.date, (consumedByDate.get(e.date) ?? 0) + e.kcal)
  const stepsByDate = new Map(steps.map((d) => [d.date, d.steps]))
  return [...consumedByDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, consumed]) => ({
      date,
      consumed: Math.round(consumed),
      spent: computeDailyEnergy(profile, date, { sessions, cardio, steps: stepsByDate.get(date) ?? 0 }).total,
    }))
}

export async function getWeightSeries(profileId: number): Promise<SeriesPoint[]> {
  const logs = await db.bodyWeightLogs.where('profileId').equals(profileId).toArray()
  return logs.sort((a, b) => a.date.localeCompare(b.date)).map((l) => ({ date: l.date, value: l.weightKg }))
}

export async function getMeasurementSeries(profileId: number, type: MeasurementType): Promise<SeriesPoint[]> {
  const logs = await db.bodyMeasurements.where({ profileId, type }).toArray()
  return logs.sort((a, b) => a.date.localeCompare(b.date)).map((m) => ({ date: m.date, value: m.valueCm }))
}

// Exercises with at least one set in a finished session.
export async function getTrainedExercises(profileId: number): Promise<Exercise[]> {
  const sets = await filterSetsFromFinishedSessions(await db.sets.where('profileId').equals(profileId).toArray())
  const exercises = await db.exercises.bulkGet([...new Set(sets.map((s) => s.exerciseId))])
  return exercises.filter((e): e is Exercise => e != null).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export interface ExerciseProgressPoint {
  date: string // ISO datetime of the session
  topWeight: number
  oneRepMax: number
}

// Per finished session: heaviest set and best estimated 1RM.
export async function getExerciseProgression(profileId: number, exerciseId: number): Promise<ExerciseProgressPoint[]> {
  const sets = await filterSetsFromFinishedSessions(await db.sets.where({ profileId, exerciseId }).toArray())
  const sessions = await db.workoutSessions.bulkGet([...new Set(sets.map((s) => s.sessionId))])
  const startedAt = new Map(sessions.filter((s) => s != null).map((s) => [s!.id!, s!.startedAt]))

  const bySession = new Map<number, ExerciseProgressPoint>()
  for (const s of sets) {
    const date = startedAt.get(s.sessionId)
    if (!date) continue
    const point = bySession.get(s.sessionId) ?? { date, topWeight: 0, oneRepMax: 0 }
    point.topWeight = Math.max(point.topWeight, s.weightKg)
    point.oneRepMax = Math.max(point.oneRepMax, Math.round(estimateOneRepMax(s.weightKg, s.reps) * 10) / 10)
    bySession.set(s.sessionId, point)
  }
  return [...bySession.values()].sort((a, b) => a.date.localeCompare(b.date))
}

// One weight per day; also becomes the profile's current weight (used for calories).
export async function logWeight(profileId: number, weightKg: number) {
  const date = todayKey()
  const existing = await db.bodyWeightLogs.where('profileId').equals(profileId).and((l) => l.date === date).first()
  if (existing) await db.bodyWeightLogs.update(existing.id!, { weightKg })
  else await db.bodyWeightLogs.add({ profileId, date, weightKg })
  await db.profiles.update(profileId, { weightKg })
}

export async function logMeasurements(profileId: number, values: Partial<Record<MeasurementType, number>>) {
  const date = todayKey()
  for (const [type, valueCm] of Object.entries(values) as Array<[MeasurementType, number]>) {
    const existing = await db.bodyMeasurements
      .where('profileId')
      .equals(profileId)
      .and((m) => m.date === date && m.type === type)
      .first()
    if (existing) await db.bodyMeasurements.update(existing.id!, { valueCm })
    else await db.bodyMeasurements.add({ profileId, date, type, valueCm })
  }
}
