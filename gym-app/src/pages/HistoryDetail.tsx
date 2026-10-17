import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/db'
import { deleteWorkoutSession, getRoutineSummaries, type RoutineSummary } from '../db/queries'
import { coverUrl } from '../lib/routineCovers'
import { EditSetChip } from '../components/EditSetChip'
import { WorkoutReview } from '../components/WorkoutReview'
import { LadderReview } from '../components/ladder/LadderReview'
import { DetailHero, StatTiles } from '../components/DetailHero'
import { DeleteWithConfirm } from '../components/DeleteWithConfirm'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const kg = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 })

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

  const summaries = useLiveQuery(getRoutineSummaries, [], {} as Record<number, RoutineSummary>)
  const [editingSetId, setEditingSetId] = useState<number | null>(null)

  if (!session) return null

  const allSets = grouped?.flatMap((g) => g.sets) ?? []
  const minutes = session.finishedAt
    ? Math.round((Date.parse(session.finishedAt) - Date.parse(session.startedAt)) / 60000)
    : 0
  const volume = allSets.reduce((sum, s) => sum + s.weightKg * s.reps, 0)

  async function handleDelete() {
    await deleteWorkoutSession(id)
    navigate('/history')
  }

  return (
    <div className="flex flex-col gap-5">
      <DetailHero
        title={session.routineName}
        subtitle={
          session.ladder
            ? `${formatDate(session.startedAt)} · ${kg(session.ladder.dumbbellKg)} kg por mancuerna`
            : formatDate(session.startedAt)
        }
        image={coverUrl(summaries[session.routineId]?.cover ?? 'general')}
        backTo="/history"
      />

      <StatTiles
        items={[
          { label: 'minutos', value: String(minutes) },
          { label: 'kcal', value: session.caloriesBurned != null ? `~${session.caloriesBurned}` : '—' },
          { label: 'series', value: String(allSets.length) },
          { label: 'kg movidos', value: volume >= 1000 ? `${kg(volume / 1000)} t` : kg(volume) },
        ]}
      />

      <div className="flex flex-col gap-2.5">
        {grouped?.map((g) => (
          <div key={g.exercise!.id} className="card-forged p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-medium text-text">{g.exercise!.name}</h3>
              <span className="shrink-0 text-xs text-text-muted">{g.exercise!.muscleGroup}</span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {g.sets.map((s) =>
                s.id === editingSetId ? (
                  <EditSetChip key={s.id} set={s} onDone={() => setEditingSetId(null)} />
                ) : (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setEditingSetId(s.id!)}
                    className="rounded-md border border-accent-muted bg-accent-muted/30 px-2 py-1 text-xs tabular-nums text-text"
                  >
                    {kg(s.weightKg)} kg × {s.reps}
                  </button>
                ),
              )}
            </div>
          </div>
        ))}
      </div>

      {grouped && grouped.length > 0 && (
        <section className="card-forged p-4">
          {session.ladder ? <LadderReview sessionId={session.id!} /> : <WorkoutReview sessionId={session.id!} />}
        </section>
      )}

      <DeleteWithConfirm
        label="Eliminar entrenamiento"
        confirmMessage={`¿Eliminar "${session.routineName}" y todas sus series?`}
        onConfirm={handleDelete}
      />
    </div>
  )
}
