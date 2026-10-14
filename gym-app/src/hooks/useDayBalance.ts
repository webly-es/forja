import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { computeDailyEnergy, type DailyEnergy } from '../lib/dailyEnergy'
import type { FoodEntry } from '../types'

export interface DayBalance {
  entries: FoodEntry[]
  steps: number
  consumed: { kcal: number; proteinG: number; carbsG: number; fatG: number }
  energy: DailyEnergy
}

// Everything the "Hoy" views need for one profile and one local day.
export function useDayBalance(profileId: number, dateKey: string): DayBalance | undefined {
  return useLiveQuery(async () => {
    const [profile, entries, stepsRow, sessions, cardio] = await Promise.all([
      db.profiles.get(profileId),
      db.foodEntries.where('profileId').equals(profileId).and((e) => e.date === dateKey).toArray(),
      db.dailySteps.where('profileId').equals(profileId).and((d) => d.date === dateKey).first(),
      db.workoutSessions.where('profileId').equals(profileId).toArray(),
      db.cardioSessions.where('profileId').equals(profileId).toArray(),
    ])
    if (!profile) return undefined

    const steps = stepsRow?.steps ?? 0
    const consumed = entries.reduce(
      (acc, e) => ({
        kcal: acc.kcal + e.kcal,
        proteinG: acc.proteinG + e.proteinG,
        carbsG: acc.carbsG + e.carbsG,
        fatG: acc.fatG + e.fatG,
      }),
      { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    )
    entries.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt))
    return { entries, steps, consumed, energy: computeDailyEnergy(profile, dateKey, { sessions, cardio, steps }) }
  }, [profileId, dateKey])
}
