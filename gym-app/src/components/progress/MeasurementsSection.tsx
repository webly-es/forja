import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { getMeasurementSeries, logMeasurements } from '../../db/progress'
import { MEASUREMENT_LABELS, MEASUREMENT_TYPES, type MeasurementType } from '../../lib/measurements'
import { TrendChart } from '../charts/TrendChart'
import { EmptyHint, HeadlineValue, ProgressSection, RecordsDisclosure } from './shared'
import { shortDate } from '../../lib/format'

export function MeasurementsSection({ profileId }: { profileId: number }) {
  const [type, setType] = useState<MeasurementType>('waist')
  const points = useLiveQuery(() => getMeasurementSeries(profileId, type), [profileId, type])
  const [editing, setEditing] = useState(false)
  const [drafts, setDrafts] = useState<Partial<Record<MeasurementType, string>>>({})

  async function save() {
    const values: Partial<Record<MeasurementType, number>> = {}
    for (const t of MEASUREMENT_TYPES) {
      const n = Number((drafts[t] ?? '').replace(',', '.'))
      if (n > 0) values[t] = n
    }
    if (Object.keys(values).length === 0) return
    await logMeasurements(profileId, values)
    setDrafts({})
    setEditing(false)
  }

  return (
    <ProgressSection
      title="Medidas corporales"
      action={
        !editing && (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover">
            <Plus size={13} />
            Registrar medidas
          </button>
        )
      }
    >
      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
          className="mb-4 border-b border-white/10 pb-4"
        >
          <div className="grid grid-cols-3 gap-2">
            {MEASUREMENT_TYPES.map((t) => (
              <label key={t} className="flex flex-col gap-1">
                <span className="text-[11px] text-text-muted">{MEASUREMENT_LABELS[t]}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="cm"
                  value={drafts[t] ?? ''}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [t]: e.target.value }))}
                  className="input"
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className="flex-1 rounded-lg border border-border py-2 text-sm text-text-muted">
              Cancelar
            </button>
            <button type="submit" className="flex-1 rounded-lg bg-accent py-2 text-sm font-medium text-bg hover:bg-accent-hover">
              Guardar medidas de hoy
            </button>
          </div>
        </form>
      )}

      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {MEASUREMENT_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
              type === t ? 'border-accent bg-accent/15 text-accent' : 'border-white/10 text-text-muted hover:text-text'
            }`}
          >
            {MEASUREMENT_LABELS[t]}
          </button>
        ))}
      </div>

      {!points ? null : points.length === 0 ? (
        <EmptyHint>Aún no hay registros de {MEASUREMENT_LABELS[type].toLowerCase()}.</EmptyHint>
      ) : (
        <>
          <HeadlineValue points={points} unit="cm" better={type === 'waist' || type === 'hip' ? 'down' : 'none'} />
          {points.length > 1 && (
            <div className="mt-3">
              <TrendChart points={points.map((p) => ({ label: shortDate(p.date), value: p.value }))} unit="cm" />
            </div>
          )}
          <RecordsDisclosure points={points} unit="cm" />
        </>
      )}
    </ProgressSection>
  )
}
