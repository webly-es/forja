import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import { estimateMet } from '../lib/met'
import { estimateCalories } from '../lib/calories'
import { WorkoutFinishSummary } from '../components/WorkoutFinishSummary'
import { ChevronRight, HeartPulse } from 'lucide-react'

type Mode = 'strength' | 'cardio'

export function StartWorkout() {
  const activeProfileId = useAppStore((s) => s.activeProfileId)!
  const setActiveSessionId = useAppStore((s) => s.setActiveSessionId)
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('strength')
  const [activity, setActivity] = useState('')
  const [minutes, setMinutes] = useState('')
  const [finished, setFinished] = useState<{ sessionId: number; minutes: number; calories: number } | null>(
    null,
  )

  const profile = useLiveQuery(() => db.profiles.get(activeProfileId), [activeProfileId])
  const routines = useLiveQuery(() => db.routines.toArray(), [], [])
  const exerciseCounts = useLiveQuery(async () => {
    const all = await db.exercises.toArray()
    const counts: Record<string, number> = {}
    for (const ex of all) {
      if (ex.profileScope && ex.profileScope !== profile?.sex) continue
      counts[ex.routineKey] = (counts[ex.routineKey] ?? 0) + 1
    }
    return counts
  }, [profile], {} as Record<string, number>)

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

  const canSaveCardio = activity.trim() !== '' && Number(minutes) > 0

  async function saveCardio() {
    if (!canSaveCardio || !profile) return
    const durationMinutes = Number(minutes)
    const met = estimateMet(activity)
    const calories = estimateCalories(met, profile.weightKg, durationMinutes)
    const sessionId = (await db.cardioSessions.add({
      profileId: activeProfileId,
      activity: activity.trim(),
      durationMinutes,
      met,
      caloriesBurned: calories,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    })) as number
    setActivity('')
    setMinutes('')
    setFinished({ sessionId, minutes: durationMinutes, calories })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Empezar entrenamiento</h1>
        <p className="mt-1 text-sm text-text-muted">Elige el tipo de entrenamiento de hoy</p>
      </div>

      <div className="flex gap-2 rounded-xl border border-border bg-surface p-1">
        <button
          onClick={() => setMode('strength')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            mode === 'strength' ? 'bg-accent text-bg' : 'text-text-muted'
          }`}
        >
          Fuerza
        </button>
        <button
          onClick={() => setMode('cardio')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            mode === 'cardio' ? 'bg-accent text-bg' : 'text-text-muted'
          }`}
        >
          Cardio
        </button>
      </div>

      {mode === 'strength' ? (
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
      ) : (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-text-muted">
            <HeartPulse size={18} />
            <span className="text-sm">Actividad libre — escribe lo que hiciste</span>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <input
              type="text"
              placeholder="Ej. piscina, correr, bicicleta..."
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              className="input"
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder="Minutos"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="input"
            />
            <button
              onClick={saveCardio}
              disabled={!canSaveCardio}
              className="rounded-lg bg-accent py-2.5 text-sm font-medium text-bg transition-opacity disabled:opacity-30 hover:bg-accent-hover"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {finished && (
        <WorkoutFinishSummary
          title="Cardio completado"
          durationMinutes={finished.minutes}
          calories={finished.calories}
          onClose={() => {
            setFinished(null)
            navigate('/home')
          }}
          onViewDetail={() => navigate(`/history/cardio/${finished.sessionId}`)}
        />
      )}
    </div>
  )
}
