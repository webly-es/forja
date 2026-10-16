import { shiftDateKey } from './dates'

export interface ActivityDay {
  strength: number
  cardio: number
  minutes: number
  labels: string[]
}

export interface WeeklyStreak {
  current: number
  best: number
  thisWeek: { active: number; goal: number; remainingDays: number; daysActive: boolean[] }
}

function parseKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Monday of the week containing dateKey (European weeks).
export function weekStartKey(dateKey: string): string {
  const weekday = (parseKey(dateKey).getDay() + 6) % 7 // Monday = 0
  return shiftDateKey(dateKey, -weekday)
}

function activeDaysInWeek(days: Map<string, ActivityDay>, weekStart: string): boolean[] {
  return Array.from({ length: 7 }, (_, i) => days.has(shiftDateKey(weekStart, i)))
}

// Streak of consecutive weeks with at least `goal` active days. The current week only
// counts once it's met, and only breaks the streak once it can no longer be met.
export function computeWeeklyStreak(days: Map<string, ActivityDay>, goal: number, today: string): WeeklyStreak {
  const thisWeekStart = weekStartKey(today)
  const daysActive = activeDaysInWeek(days, thisWeekStart)
  const active = daysActive.filter(Boolean).length
  const todayIndex = (parseKey(today).getDay() + 6) % 7
  // Today still counts as available if nothing has been logged yet.
  const remainingDays = 7 - todayIndex - (daysActive[todayIndex] ? 1 : 0)
  const thisWeekMet = active >= goal

  const weekMet = (weekStart: string) => activeDaysInWeek(days, weekStart).filter(Boolean).length >= goal

  let current = thisWeekMet ? 1 : 0
  let week = shiftDateKey(thisWeekStart, -7)
  while (weekMet(week)) {
    current++
    week = shiftDateKey(week, -7)
  }
  if (!thisWeekMet && active + remainingDays < goal) current = 0

  // Best streak across all history, walking week by week from the first active day.
  let best = current
  const firstDay = [...days.keys()].sort()[0]
  if (firstDay) {
    let run = 0
    for (let w = weekStartKey(firstDay); w < thisWeekStart; w = shiftDateKey(w, 7)) {
      run = weekMet(w) ? run + 1 : 0
      best = Math.max(best, run)
    }
  }

  return { current, best, thisWeek: { active, goal, remainingDays, daysActive } }
}

export interface HeatmapCell {
  dateKey: string
  level: 0 | 1 | 2 | 3
  future: boolean
}

export interface Heatmap {
  columns: HeatmapCell[][] // one column per week, Monday first
  monthLabels: Array<{ column: number; label: string }>
  activeDays: number
}

function levelFor(day: ActivityDay | undefined): HeatmapCell['level'] {
  if (!day) return 0
  if ((day.strength > 0 && day.cardio > 0) || day.minutes > 90) return 3
  return day.strength > 0 ? 2 : 1
}

export function buildHeatmap(days: Map<string, ActivityDay>, weeks: number, today: string): Heatmap {
  const firstWeek = shiftDateKey(weekStartKey(today), -7 * (weeks - 1))
  const columns: HeatmapCell[][] = []
  const monthLabels: Heatmap['monthLabels'] = []
  let activeDays = 0
  let lastMonth = -1

  for (let w = 0; w < weeks; w++) {
    const weekStart = shiftDateKey(firstWeek, w * 7)
    const month = parseKey(weekStart).getMonth()
    if (month !== lastMonth) {
      const label = parseKey(weekStart).toLocaleDateString('es', { month: 'short' }).replace('.', '')
      monthLabels.push({ column: w, label: label.charAt(0).toUpperCase() + label.slice(1) })
      lastMonth = month
    }
    columns.push(
      Array.from({ length: 7 }, (_, i) => {
        const dateKey = shiftDateKey(weekStart, i)
        const future = dateKey > today
        const level = future ? 0 : levelFor(days.get(dateKey))
        if (level > 0) activeDays++
        return { dateKey, level, future }
      }),
    )
  }
  return { columns, monthLabels, activeDays }
}
