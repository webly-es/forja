import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import { ChevronRight } from 'lucide-react'

export function StartWorkout() {
  const activeProfileId = useAppStore((s) => s.activeProfileId)!
  const setActiveSessionId = useAppStore((s) => s.setActiveSessionId)
  const navigate = useNavigate()

  const routines = useLiveQuery(() => db.routines.toArray(), [], [])
  const exerciseCounts = useLiveQuery(async () => {
    const profile = await db.profiles.get(activeProfileId)
    const all = await db.exercises.toArray()
    const counts: Record<string, number> = {}
    for (const ex of all) {
      if (ex.profileScope && ex.profileScope !== profile?.sex) continue
      counts[ex.routineKey] = (counts[ex.routineKey] ?? 0) + 1
    }
    return counts
  }, [activeProfileId], {} as Record<string, number>)

  async function startRoutine(routineId: number, routineKey: string, routineName: string) {
    const sessionId = (await db.workoutSessions.add({
      profileId: activeProfileId,
      routineId,
      routineKey: routineKey as never,
      routineName,
      startedAt: new Date().toISOString(),
    })) as number
    setActiveSessionId(sessionId)
    navigate(`/workout/active/${sessionId}`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Elige tu rutina</h1>
        <p className="mt-1 text-sm text-text-muted">Selecciona el entrenamiento de hoy</p>
      </div>

      <div className="flex flex-col gap-3">
        {routines?.map((r) => (
          <button
            key={r.id}
            onClick={() => startRoutine(r.id!, r.key, r.name)}
            className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent"
          >
            <div>
              <div className="font-medium text-text">{r.name}</div>
              <div className="mt-0.5 text-xs text-text-muted">
                {exerciseCounts?.[r.key] ?? 0} ejercicios
              </div>
            </div>
            <ChevronRight size={20} className="text-text-muted" />
          </button>
        ))}
      </div>
    </div>
  )
}
