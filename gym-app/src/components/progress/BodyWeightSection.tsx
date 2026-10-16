import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { getWeightSeries, logWeight } from '../../db/progress'
import type { Goal } from '../../types'
import { TrendChart } from '../charts/TrendChart'
import { EmptyHint, HeadlineValue, ProgressSection, RecordsDisclosure, shortDate } from './shared'

const WEIGHT_PROGRESS: Record<Goal, 'up' | 'down' | 'none'> = { lose: 'down', gain: 'up', recomp: 'none', maintain: 'none' }

export function BodyWeightSection({
  profileId,
  currentWeight,
  goal,
}: {
  profileId: number
  currentWeight: number
  goal: Goal
}) {
  const points = useLiveQuery(() => getWeightSeries(profileId), [profileId])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  async function save() {
    const weightKg = Number(draft.replace(',', '.'))
    if (!weightKg || weightKg <= 0) return
    await logWeight(profileId, weightKg)
    setDraft('')
    setEditing(false)
  }

  if (!points) return null

  return (
    <ProgressSection
      title="Peso corporal"
      action={
        !editing && (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover">
            <Plus size={13} />
            Registrar peso
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
          className="mb-4 flex gap-2"
        >
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            placeholder={`Peso de hoy (${currentWeight} kg)`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="input"
          />
          <button type="button" onClick={() => setEditing(false)} className="shrink-0 rounded-lg border border-border px-3 text-sm text-text-muted">
            Cancelar
          </button>
          <button type="submit" className="shrink-0 rounded-lg bg-accent px-4 text-sm font-medium text-bg hover:bg-accent-hover">
            Guardar
          </button>
        </form>
      )}
      {points.length === 0 ? (
        <EmptyHint>Registra tu peso para ver su evolución.</EmptyHint>
      ) : (
        <>
          <HeadlineValue points={points} unit="kg" better={WEIGHT_PROGRESS[goal]} />
          {points.length > 1 && (
            <div className="mt-3">
              <TrendChart points={points.map((p) => ({ label: shortDate(p.date), value: p.value }))} unit="kg" />
            </div>
          )}
          <RecordsDisclosure points={points} unit="kg" />
        </>
      )}
    </ProgressSection>
  )
}
