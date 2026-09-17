import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { filterSetsFromFinishedSessions } from '../db/queries'
import { useAppStore } from '../store/useAppStore'
import { MEASUREMENT_TYPES, MEASUREMENT_LABELS, type MeasurementType } from '../lib/measurements'
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

function ProgressTable({
  rows,
  emptyMessage,
  unit = 'kg',
}: {
  rows: ProgressRow[]
  emptyMessage: string
  unit?: string
}) {
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
            <span className="font-medium text-text">
              {row.value} {unit}
            </span>
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
    const rawSets = await db.sets.where('profileId').equals(activeProfileId).toArray()
    const sets = await filterSetsFromFinishedSessions(rawSets)
    const ids = [...new Set(sets.map((s) => s.exerciseId))]
    const exercises = await db.exercises.bulkGet(ids)
    return exercises.filter((e): e is Exercise => e != null)
  }, [activeProfileId], [])

  const [selectedExerciseIdOverride, setSelectedExerciseIdOverride] = useState<number | null>(null)
  const selectedExerciseId = selectedExerciseIdOverride ?? exerciseOptions[0]?.id ?? null

  const [selectedMeasurementType, setSelectedMeasurementType] = useState<MeasurementType>('waist')

  const measurementData = useLiveQuery(
    () =>
      db.bodyMeasurements
        .where({ profileId: activeProfileId, type: selectedMeasurementType })
        .toArray()
        .then((logs) =>
          withDeltas(
            logs
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((m) => ({
                label: new Date(m.date).toLocaleDateString('es', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }),
                value: m.valueCm,
              })),
          ).reverse(),
        ),
    [activeProfileId, selectedMeasurementType],
    [],
  )

  const progression = useLiveQuery(async () => {
    if (selectedExerciseId == null) return []
    const rawSets = await db.sets.where({ profileId: activeProfileId, exerciseId: selectedExerciseId }).toArray()
    const sets = await filterSetsFromFinishedSessions(rawSets)
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
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-text">Progreso</h1>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-text-muted">Peso corporal</h2>
        <ProgressTable rows={weightData} emptyMessage="Registra tu peso corporal para ver tu progreso aquí." />
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-text-muted">Medidas corporales</h2>
        <select
          className="input mb-3"
          value={selectedMeasurementType}
          onChange={(e) => setSelectedMeasurementType(e.target.value as MeasurementType)}
        >
          {MEASUREMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {MEASUREMENT_LABELS[type]}
            </option>
          ))}
        </select>
        <ProgressTable
          rows={measurementData}
          emptyMessage="Registra esta medida en Ajustes para ver su progresión."
          unit="cm"
        />
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
              onChange={(e) => setSelectedExerciseIdOverride(Number(e.target.value))}
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
