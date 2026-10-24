import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, CircleSlash } from 'lucide-react'
import { db } from '../db/db'
import { getSkipPatterns, REPORT_WEEKS } from '../db/trainingReport'
import { SKIP_REASON_LABELS } from '../lib/sessionIncidents'
import { useAppStore } from '../store/useAppStore'

// Exercises that keep being left out in the last weeks, worked out on the device (no AI needed).
export function SkipPatternsCard() {
  const navigate = useNavigate()
  const profileId = useAppStore((s) => s.activeProfileId)!
  const data = useLiveQuery(async () => {
    const patterns = await getSkipPatterns(profileId)
    const [exercises, routines] = await Promise.all([
      db.exercises.bulkGet(patterns.map((p) => p.exerciseId)),
      db.routines.bulkGet(patterns.map((p) => p.routineId)),
    ])
    return patterns.map((p, i) => ({ ...p, name: exercises[i]?.name ?? 'Ejercicio', routine: routines[i] }))
  }, [profileId])

  if (!data?.length) return null

  return (
    <div className="card-forged flex flex-col gap-2.5 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger/15 text-danger">
          <CircleSlash size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-text">Se te quedan sin hacer</span>
          <span className="block text-xs text-text-muted">Últimas {REPORT_WEEKS} semanas · el análisis del entrenador lo tiene en cuenta</span>
        </span>
      </div>
      {data.map((p) => (
        <div key={p.exerciseId} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-text">{p.name}</span>
            <span className="block text-xs text-text-muted">
              {p.skips} de {p.sessions} veces · {SKIP_REASON_LABELS[p.reason].toLowerCase()}
              {p.routine ? ` · ${p.routine.name}` : ''}
            </span>
          </span>
          {p.routine && (
            <button
              onClick={() => navigate(`/workout/routines/${p.routineId}/edit`)}
              className="flex shrink-0 items-center gap-0.5 text-xs text-accent hover:underline"
            >
              Rutina <ChevronRight size={12} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
