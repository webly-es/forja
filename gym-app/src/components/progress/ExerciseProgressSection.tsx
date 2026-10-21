import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getExerciseProgression, getTrainedExercises } from '../../db/progress'
import { TrendChart } from '../charts/TrendChart'
import { EmptyHint, HeadlineValue, ProgressSection, RecordsDisclosure } from './shared'
import { shortDate } from '../../lib/format'

type Metric = 'topWeight' | 'oneRepMax'

const METRICS: Array<{ key: Metric; label: string; hint: string }> = [
  { key: 'topWeight', label: 'Peso máximo', hint: 'La serie más pesada de cada sesión.' },
  { key: 'oneRepMax', label: 'Fuerza estimada', hint: 'Máximo a 1 repetición estimado (Epley): compara series con distinto número de repeticiones.' },
]

export function ExerciseProgressSection({ profileId }: { profileId: number }) {
  const exercises = useLiveQuery(() => getTrainedExercises(profileId), [profileId])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [metric, setMetric] = useState<Metric>('topWeight')
  const exerciseId = selectedId ?? exercises?.[0]?.id ?? null

  const progression = useLiveQuery(
    () => (exerciseId == null ? Promise.resolve([]) : getExerciseProgression(profileId, exerciseId)),
    [profileId, exerciseId],
  )

  if (!exercises) return null
  const points = (progression ?? []).map((p) => ({ date: p.date, value: p[metric] }))
  const metricInfo = METRICS.find((m) => m.key === metric)!

  return (
    <ProgressSection title="Progresión por ejercicio">
      {exercises.length === 0 ? (
        <EmptyHint>Registra algunas series para ver tu progresión.</EmptyHint>
      ) : (
        <>
          <select
            className="input mb-3"
            value={exerciseId ?? ''}
            onChange={(e) => setSelectedId(Number(e.target.value))}
          >
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
          <div className="mb-4 flex gap-1 rounded-xl border border-white/10 bg-surface-2 p-1">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                  metric === m.key ? 'bg-accent text-bg' : 'text-text-muted'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {points.length === 0 ? (
            <EmptyHint>Sin sesiones terminadas con este ejercicio.</EmptyHint>
          ) : (
            <>
              <HeadlineValue points={points} unit="kg" />
              {points.length > 1 && (
                <div className="mt-3">
                  <TrendChart points={points.map((p) => ({ label: shortDate(p.date), value: p.value }))} unit="kg" />
                </div>
              )}
              <p className="mt-1 text-[11px] text-text-muted">{metricInfo.hint}</p>
              <RecordsDisclosure points={points} unit="kg" />
            </>
          )}
        </>
      )}
    </ProgressSection>
  )
}
