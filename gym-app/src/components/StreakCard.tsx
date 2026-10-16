import { useLiveQuery } from 'dexie-react-hooks'
import { Flame } from 'lucide-react'
import { getActivityDays } from '../db/activity'
import { computeWeeklyStreak } from '../lib/streak'
import { todayKey } from '../lib/dates'
import { useAppStore } from '../store/useAppStore'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function weeksLabel(n: number) {
  return n === 1 ? 'semana' : 'semanas'
}

// Weekly streak on Home: weeks in a row meeting the training goal, plus this week's days.
export function StreakCard({ profileId }: { profileId: number }) {
  const weeklyGoal = useAppStore((s) => s.weeklyGoal)
  const today = todayKey()
  const streak = useLiveQuery(
    async () => computeWeeklyStreak(await getActivityDays(profileId), weeklyGoal, today),
    [profileId, weeklyGoal, today],
  )
  if (!streak) return null

  const { current, best, thisWeek } = streak
  const missing = Math.max(0, thisWeek.goal - thisWeek.active)
  const todayIndex = (new Date().getDay() + 6) % 7
  const status =
    missing === 0
      ? 'Objetivo de la semana cumplido'
      : missing > thisWeek.remainingDays
        ? 'Esta semana ya no se llega al objetivo'
        : `Te ${missing === 1 ? 'falta 1 entreno' : `faltan ${missing} entrenos`} esta semana`

  return (
    <div className="card-forged flex items-center gap-4 p-4">
      <div className="flex shrink-0 flex-col items-center">
        <Flame size={18} className={current > 0 ? 'text-accent' : 'text-text-muted'} />
        <span className="font-display text-4xl font-medium leading-none tabular-nums text-text">{current}</span>
        <span className="mt-1 text-[10px] uppercase tracking-wide text-text-muted">{weeksLabel(current)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wide text-text-muted">Racha</span>
          <span className="text-[11px] text-text-muted">
            Mejor: {best} {weeksLabel(best)}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((label, i) => {
            const active = thisWeek.daysActive[i]
            return (
              <div key={label} className="flex flex-col items-center gap-1">
                <span
                  className={`h-6 w-6 rounded-full border ${
                    active
                      ? 'border-accent bg-accent shadow-[0_0_10px_-2px_var(--color-accent)]'
                      : i === todayIndex
                        ? 'border-accent/70'
                        : 'border-white/10'
                  }`}
                />
                <span className={`text-[10px] ${i === todayIndex ? 'text-accent' : 'text-text-muted'}`}>{label}</span>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-text-muted">
          <span className="text-text">
            {thisWeek.active} de {thisWeek.goal}
          </span>{' '}
          · {status}
        </p>
      </div>
    </div>
  )
}
