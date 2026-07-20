import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/db'
import { ArrowLeft } from 'lucide-react'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function HistoryDetail() {
  const { sessionId } = useParams()
  const id = Number(sessionId)
  const navigate = useNavigate()

  const session = useLiveQuery(() => db.workoutSessions.get(id), [id])
  const grouped = useLiveQuery(async () => {
    const sets = await db.sets.where('sessionId').equals(id).toArray()
    const exerciseIds = [...new Set(sets.map((s) => s.exerciseId))]
    const exercises = await db.exercises.bulkGet(exerciseIds)
    const exerciseById = new Map(exercises.filter(Boolean).map((e) => [e!.id, e!]))
    const byExercise = new Map<number, typeof sets>()
    for (const set of sets) {
      const list = byExercise.get(set.exerciseId) ?? []
      list.push(set)
      byExercise.set(set.exerciseId, list)
    }
    return [...byExercise.entries()]
      .map(([exerciseId, sets]) => ({
        exercise: exerciseById.get(exerciseId),
        sets: sets.sort((a, b) => a.setNumber - b.setNumber),
      }))
      .filter((g) => g.exercise)
  }, [id])

  if (!session) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/history')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:text-text"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-medium text-text">{session.routineName}</h1>
          <p className="text-xs text-text-muted">
            {formatDateTime(session.startedAt)}
            {session.caloriesBurned != null && ` · ~${session.caloriesBurned} kcal`}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {grouped?.map((g) => (
          <div key={g.exercise!.id} className="rounded-xl border border-border bg-surface p-4">
            <h3 className="font-medium text-text">{g.exercise!.name}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {g.sets.map((s) => (
                <span
                  key={s.id}
                  className="rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-text-muted"
                >
                  {s.weightKg}kg × {s.reps}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
