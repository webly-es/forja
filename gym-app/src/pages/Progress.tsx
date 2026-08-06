import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import type { Exercise } from '../types'

interface ProgressRow {
  label: string
  value: number
  delta: number | null
}

function withDeltas(rows: { label: string; value: number }[]): ProgressRow[] {
  return rows.map((row, i) => ({
    ...row,
    delta: i === 0 ? null : Math.round((row.value - rows[i - 1].value) * 10) / 10,
  }))
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null || delta === 0) return <span className="text-text-muted">—</span>
  const positive = delta > 0
  return (
    <span className={positive ? 'text-emerald-500' : 'text-danger'}>
      {positive ? '+' : ''}
      {delta}
    </span>
  )
}

function ProgressTable({ rows, emptyMessage }: { rows: ProgressRow[]; emptyMessage: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-text-muted">{emptyMessage}</p>
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {rows.map((row, i) => (
        <div
          key={row.label + i}
          className={`flex items-center justify-between px-4 py-3 text-sm ${i > 0 ? 'border-t border-border' : ''}`}
        >
          <span className="text-text-muted">{row.label}</span>
          <div className="flex items-center gap-3">
            <span className="font-medium text-text">{row.value} kg</span>
            <DeltaBadge delta={row.delta} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function Progress() {
  const activeProfileId = useAppStore((s) => s.activeProfileId)!

  const weightData = useLiveQuery(
    () =>
      db.bodyWeightLogs
        .where('profileId')
        .equals(activeProfileId)
        .toArray()
        .then((logs) =>
          withDeltas(
            logs
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((l) => ({
                label: new Date(l.date).toLocaleDateString('es', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }),
                value: l.weightKg,
              })),
          ).reverse(),
        ),
    [activeProfileId],
    [],
  )

  const exerciseOptions = useLiveQuery(async () => {
    const sets = await db.sets.where('profileId').equals(activeProfileId).toArray()
    const ids = [...new Set(sets.map((s) => s.exerciseId))]
    const exercises = await db.exercises.bulkGet(ids)
    return exercises.filter((e): e is Exercise => e != null)
  }, [activeProfileId], [])

  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null)

  useEffect(() => {
    if (selectedExerciseId == null && exerciseOptions.length > 0) {
      setSelectedExerciseId(exerciseOptions[0].id!)
    }
  }, [exerciseOptions, selectedExerciseId])

  const progression = useLiveQuery(async () => {
    if (selectedExerciseId == null) return []
    const sets = await db.sets.where({ profileId: activeProfileId, exerciseId: selectedExerciseId }).toArray()
    const sessionIds = [...new Set(sets.map((s) => s.sessionId))]
    const sessions = await db.workoutSessions.bulkGet(sessionIds)
    const sessionDateMap = new Map(sessions.filter((s) => s != null).map((s) => [s!.id!, s!.startedAt]))

    const maxBySession = new Map<number, number>()
    for (const s of sets) {
      const current = maxBySession.get(s.sessionId) ?? 0
      if (s.weightKg > current) maxBySession.set(s.sessionId, s.weightKg)
    }

    const rows = [...maxBySession.entries()]
      .map(([sessionId, weight]) => ({ date: sessionDateMap.get(sessionId), weight }))
      .filter((d): d is { date: string; weight: number } => !!d.date)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        label: new Date(d.date).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }),
        value: d.weight,
      }))

    return withDeltas(rows).reverse()
  }, [activeProfileId, selectedExerciseId], [])

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight text-text">Progreso</h1>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-text-muted">Peso corporal</h2>
        <ProgressTable rows={weightData} emptyMessage="Registra tu peso corporal para ver tu progreso aquí." />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-wide text-text-muted">Progresión por ejercicio</h2>
        </div>

        {exerciseOptions.length === 0 ? (
          <p className="text-sm text-text-muted">Registra algunas series para ver tu progresión.</p>
        ) : (
          <>
            <select
              className="input mb-3"
              value={selectedExerciseId ?? ''}
              onChange={(e) => setSelectedExerciseId(Number(e.target.value))}
            >
              {exerciseOptions.map((ex) => (
                <option key={ex!.id} value={ex!.id}>
                  {ex!.name}
                </option>
              ))}
            </select>

            <ProgressTable
              rows={progression}
              emptyMessage="Registra series de este ejercicio para ver su progresión."
            />
          </>
        )}
      </section>
    </div>
  )
}
