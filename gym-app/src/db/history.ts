import { db } from './db'

export interface HistoryItem {
  id: number
  type: 'strength' | 'cardio'
  title: string
  date: string // ISO datetime
  minutes: number
  kcal: number
  routineId?: number
}

// Finished strength sessions and cardio, newest first.
export async function getHistoryItems(profileId: number): Promise<HistoryItem[]> {
  const [strength, cardio] = await Promise.all([
    db.workoutSessions.where('profileId').equals(profileId).toArray(),
    db.cardioSessions.where('profileId').equals(profileId).toArray(),
  ])

  const items: HistoryItem[] = [
    ...strength
      .filter((s) => s.finishedAt)
      .map((s) => ({
        id: s.id!,
        type: 'strength' as const,
        title: s.routineName,
        date: s.startedAt,
        minutes: Math.max(0, Math.round((Date.parse(s.finishedAt!) - Date.parse(s.startedAt)) / 60000)),
        kcal: s.caloriesBurned ?? 0,
        routineId: s.routineId,
      })),
    ...cardio.map((c) => ({
      id: c.id!,
      type: 'cardio' as const,
      title: c.activity,
      date: c.date,
      minutes: c.durationMinutes,
      kcal: c.caloriesBurned,
    })),
  ]
  return items.sort((a, b) => b.date.localeCompare(a.date))
}
