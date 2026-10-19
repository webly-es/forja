import { db } from './db'
import { getTrainingContext, type TrainingContext } from './routineContext'
import { getBalanceSeries, getWeightSeries, type BalanceDay, type SeriesPoint } from './progress'
import { getRoutineDraftsForProfile } from './routines'
import { shiftDateKey, toDateKey, todayKey } from '../lib/dates'
import { weekStartKey } from '../lib/streak'
import type { MuscleGroup } from '../lib/muscleGroups'
import type { RoutineDraft, TrainingReport } from '../types'

export const REPORT_WEEKS = 8
const BALANCE_DAYS = 28

export interface WeekSummary {
  weekStart: string // Monday, yyyy-mm-dd
  strength: number // finished strength sessions
  cardio: number
  setsByMuscle: Partial<Record<MuscleGroup, number>>
}

// The numbers behind the History report, already grouped so the prompt only has to list them.
export interface TrainingReportData {
  ctx: TrainingContext
  weeklyGoal: number
  weeks: WeekSummary[] // oldest first, current week last
  balance: BalanceDay[] // last 4 weeks, full days only
  weights: SeriesPoint[] // within the report window
  routines: RoutineDraft[]
}

export async function getTrainingReportData(profileId: number, weeklyGoal: number): Promise<TrainingReportData | undefined> {
  const ctx = await getTrainingContext(profileId, REPORT_WEEKS)
  if (!ctx) return undefined
  const today = todayKey()
  const firstWeek = weekStartKey(shiftDateKey(today, -(REPORT_WEEKS - 1) * 7))

  const [cardio, balance, weights, routines] = await Promise.all([
    db.cardioSessions.where('profileId').equals(profileId).toArray(),
    getBalanceSeries(profileId, BALANCE_DAYS + 1),
    getWeightSeries(profileId),
    getRoutineDraftsForProfile(profileId),
  ])

  const weeks: WeekSummary[] = Array.from({ length: REPORT_WEEKS }, (_, i) => ({
    weekStart: shiftDateKey(firstWeek, i * 7),
    strength: 0,
    cardio: 0,
    setsByMuscle: {},
  }))
  const weekOf = (iso: string) => weeks.find((w) => w.weekStart === weekStartKey(toDateKey(new Date(iso))))

  const muscleOf = new Map(ctx.catalog.map((e) => [e.id!, e.muscleGroup]))
  const sessionStart = new Map(ctx.sessions.map((s) => [s.id!, s.startedAt]))
  for (const session of ctx.sessions) {
    const week = weekOf(session.startedAt)
    if (week) week.strength++
  }
  for (const set of ctx.sets) {
    const week = weekOf(sessionStart.get(set.sessionId)!)
    const muscle = muscleOf.get(set.exerciseId)
    if (week && muscle) week.setsByMuscle[muscle] = (week.setsByMuscle[muscle] ?? 0) + 1
  }
  for (const session of cardio) {
    const week = weekOf(session.date)
    if (week) week.cardio++
  }

  return {
    ctx,
    weeklyGoal,
    weeks,
    balance: balance.filter((d) => d.date < today),
    weights: weights.filter((w) => w.date.slice(0, 10) >= firstWeek),
    routines,
  }
}

export function getLatestReport(profileId: number) {
  return db.trainingReports.where('profileId').equals(profileId).last()
}

// Only the latest report is kept for each profile.
export async function saveReport(report: TrainingReport) {
  await db.transaction('rw', db.trainingReports, async () => {
    await db.trainingReports.where('profileId').equals(report.profileId).delete()
    await db.trainingReports.add(report)
  })
}
