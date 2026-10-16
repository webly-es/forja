import { db } from './db'
import { toDateKey } from '../lib/dates'
import type { ActivityDay } from '../lib/streak'

// Finished strength sessions and cardio, grouped by local day (yyyy-mm-dd).
export async function getActivityDays(profileId: number): Promise<Map<string, ActivityDay>> {
  const [sessions, cardio] = await Promise.all([
    db.workoutSessions.where('profileId').equals(profileId).toArray(),
    db.cardioSessions.where('profileId').equals(profileId).toArray(),
  ])

  const days = new Map<string, ActivityDay>()
  const dayFor = (key: string) => {
    let day = days.get(key)
    if (!day) {
      day = { strength: 0, cardio: 0, minutes: 0, labels: [] }
      days.set(key, day)
    }
    return day
  }

  for (const s of sessions) {
    if (!s.finishedAt) continue
    const day = dayFor(toDateKey(new Date(s.startedAt)))
    day.strength++
    day.minutes += Math.max(0, Math.round((Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 60000))
    day.labels.push(s.routineName)
  }
  for (const c of cardio) {
    const day = dayFor(toDateKey(new Date(c.date)))
    day.cardio++
    day.minutes += c.durationMinutes
    day.labels.push(c.activity)
  }
  return days
}
