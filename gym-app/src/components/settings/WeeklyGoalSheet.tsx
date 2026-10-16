import { useAppStore } from '../../store/useAppStore'
import { SettingsSheet } from './SettingsSheet'

export function WeeklyGoalSheet({ onClose }: { onClose: () => void }) {
  const weeklyGoal = useAppStore((s) => s.weeklyGoal)
  const setWeeklyGoal = useAppStore((s) => s.setWeeklyGoal)
  return (
    <SettingsSheet title="Objetivo semanal" onClose={onClose}>
      <p className="text-sm text-text-muted">Días con entreno o cardio que mantienen tu racha.</p>
      <div className="grid grid-cols-7 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <button
            key={n}
            onClick={() => {
              setWeeklyGoal(n)
              onClose()
            }}
            className={`rounded-lg py-2.5 text-sm font-medium transition-colors ${
              weeklyGoal === n ? 'bg-accent text-bg' : 'bg-surface-2 text-text-muted hover:text-text'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </SettingsSheet>
  )
}
