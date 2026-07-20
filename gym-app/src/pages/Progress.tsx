import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import type { Exercise } from '../types'

const chartMargin = { top: 8, right: 12, bottom: 0, left: -20 }

export function Progress() {
  const activeProfileId = useAppStore((s) => s.activeProfileId)!

  const weightData = useLiveQuery(
    () =>
      db.bodyWeightLogs
        .where('profileId')
        .equals(activeProfileId)
        .toArray()
        .then((logs) =>
          logs
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((l) => ({
              label: new Date(l.date).toLocaleDateString('es', { day: 'numeric', month: 'short' }),
              weight: l.weightKg,
            })),
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

    return [...maxBySession.entries()]
      .map(([sessionId, weight]) => ({ date: sessionDateMap.get(sessionId), weight }))
      .filter((d): d is { date: string; weight: number } => !!d.date)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        label: new Date(d.date).toLocaleDateString('es', { day: 'numeric', month: 'short' }),
        weight: d.weight,
      }))
  }, [activeProfileId, selectedExerciseId], [])

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight text-text">Progreso</h1>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-text-muted">Peso corporal</h2>
        {weightData.length < 2 ? (
          <p className="text-sm text-text-muted">
            Registra tu peso corporal más de una vez para ver la gráfica.
          </p>
        ) : (
          <div className="h-56 rounded-xl border border-border bg-surface p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightData} margin={chartMargin}>
                <CartesianGrid stroke="#2a2a2a" vertical={false} />
                <XAxis dataKey="label" stroke="#9b9b9b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#9b9b9b" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 8 }}
                  labelStyle={{ color: '#9b9b9b' }}
                  itemStyle={{ color: '#f5f5f4' }}
                />
                <Line type="monotone" dataKey="weight" stroke="#c9973f" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
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

            {progression.length < 2 ? (
              <p className="text-sm text-text-muted">
                Necesitas al menos 2 sesiones con este ejercicio para ver la gráfica.
              </p>
            ) : (
              <div className="h-56 rounded-xl border border-border bg-surface p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progression} margin={chartMargin}>
                    <CartesianGrid stroke="#2a2a2a" vertical={false} />
                    <XAxis dataKey="label" stroke="#9b9b9b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9b9b9b" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: 8 }}
                      labelStyle={{ color: '#9b9b9b' }}
                      itemStyle={{ color: '#f5f5f4' }}
                    />
                    <Line type="monotone" dataKey="weight" stroke="#c9973f" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
