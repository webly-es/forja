import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { deleteRoutine } from '../db/queries'
import { useAppStore } from '../store/useAppStore'
import { estimateMet } from '../lib/met'
import { estimateCalories } from '../lib/calories'
import { WorkoutFinishSummary } from '../components/WorkoutFinishSummary'
import { ChevronRight, HeartPulse, Plus, Pencil, Trash2 } from 'lucide-react'

type Mode = 'strength' | 'cardio'

export function StartWorkout() {
  const activeProfileId = useAppStore((s) => s.activeProfileId)!
  const setActiveSessionId = useAppStore((s) => s.setActiveSessionId)
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('strength')
  const [activity, setActivity] = useState('')
  const [minutes, setMinutes] = useState('')
  const [confirmingDeleteRoutineId, setConfirmingDeleteRoutineId] = useState<number | null>(null)
  const [finished, setFinished] = useState<{ sessionId: number; minutes: number; calories: number } | null>(
    null,
  )

  const profile = useLiveQuery(() => db.profiles.get(activeProfileId), [activeProfileId])
  const routines = useLiveQuery(() => db.routines.toArray(), [], [])
  const exerciseCounts = useLiveQuery(
    async () => {
      const links = await db.routineExercises.toArray()
      const counts: Record<number, number> = {}
      for (const link of links) {
        counts[link.routineId] = (counts[link.routineId] ?? 0) + 1
      }
      return counts
    },
    [],
    {} as Record<number, number>,
  )

  async function handleDeleteRoutine(routineId: number) {
    await deleteRoutine(routineId)
    setConfirmingDeleteRoutineId(null)
  }

  async function startRoutine(routineId: number, routineName: string) {
    const sessionId = (await db.workoutSessions.add({
      profileId: activeProfileId,
      routineId,
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
          <button
            onClick={() => navigate('/workout/routines/new')}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-text-muted hover:border-accent hover:text-accent"
          >
            <Plus size={16} />
            Crear rutina
          </button>
          {routines?.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-border bg-surface transition-colors hover:border-accent"
            >
              {confirmingDeleteRoutineId === r.id ? (
                <div className="flex items-center justify-between gap-3 p-4">
                  <span className="text-sm text-text">¿Eliminar "{r.name}"?</span>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => setConfirmingDeleteRoutineId(null)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted"
                    >
                      No
                    </button>
                    <button
                      onClick={() => handleDeleteRoutine(r.id!)}
                      className="rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-bg"
                    >
                      Sí, eliminar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-4">
                  <button
                    onClick={() => startRoutine(r.id!, r.name)}
                    className="flex flex-1 items-center justify-between text-left"
                  >
                    <div>
                      <div className="font-medium text-text">{r.name}</div>
                      <div className="mt-0.5 text-xs text-text-muted">
                        {exerciseCounts?.[r.id!] ?? 0} ejercicios
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-text-muted" />
                  </button>
                  <button
                    onClick={() => navigate(`/workout/routines/${r.id}/edit`)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:text-text"
                    aria-label="Editar rutina"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setConfirmingDeleteRoutineId(r.id!)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:text-danger"
                    aria-label="Eliminar rutina"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
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
