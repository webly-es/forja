import { useState } from 'react'
import { Check, Plus, Search, X } from 'lucide-react'
import { MuscleChips } from '../exercises/MuscleChips'
import { ExercisePhoto } from '../ExercisePhoto'
import { equipmentOf } from '../../lib/equipment'
import { normalize } from '../../lib/exercises'
import { MUSCLE_GROUPS, type MuscleGroup } from '../../lib/muscleGroups'
import type { Exercise } from '../../types'

interface CatalogPickerProps {
  exercises: Exercise[]
  selectedIds: number[]
  onToggle: (exerciseId: number) => void
}

const byGroupThenName = (a: Exercise, b: Exercise) =>
  MUSCLE_GROUPS.indexOf(a.muscleGroup) - MUSCLE_GROUPS.indexOf(b.muscleGroup) || a.name.localeCompare(b.name)

// Search + muscle shortcuts over the shared catalog, same as the Ejercicios page.
export function CatalogPicker({ exercises, selectedIds, onToggle }: CatalogPickerProps) {
  const [group, setGroup] = useState<MuscleGroup | null>(null)
  const [query, setQuery] = useState('')

  const searching = query.trim().length > 0
  const needle = normalize(query.trim())
  const list = exercises
    .filter((ex) => (searching ? normalize(ex.name).includes(needle) : group === null || ex.muscleGroup === group))
    .sort(byGroupThenName)
  const presentGroups = [...new Set(exercises.map((ex) => ex.muscleGroup))]
  const showGroup = searching || group === null

  return (
    <div className="flex flex-col gap-3">
      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar ejercicio"
          className="input pl-9 pr-9"
          type="search"
        />
        {searching && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text"
            aria-label="Borrar búsqueda"
          >
            <X size={16} />
          </button>
        )}
      </label>

      {!searching && <MuscleChips groups={presentGroups} selected={group} onSelect={setGroup} />}

      <div className="flex flex-col gap-2">
        {list.map((ex) => {
          const selected = selectedIds.includes(ex.id!)
          const details = [showGroup ? ex.muscleGroup : null, equipmentOf(ex.name)].filter(Boolean)
          return (
            <div
              key={ex.id}
              className={`card-forged flex items-center gap-3 p-2.5 pr-3 transition-colors ${selected ? 'border-accent-muted' : ''}`}
            >
              <ExercisePhoto exerciseId={ex.id!} />
              <button
                type="button"
                onClick={() => onToggle(ex.id!)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                aria-pressed={selected}
              >
                <span className="min-w-0 flex-1">
                  <span className={`block text-[15px] font-medium leading-snug ${selected ? 'text-accent' : 'text-text'}`}>
                    {ex.name}
                  </span>
                  {details.length > 0 && (
                    <span className="mt-0.5 block truncate text-xs text-text-muted">{details.join(' · ')}</span>
                  )}
                </span>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    selected ? 'border-accent bg-accent text-bg' : 'border-border text-text-muted'
                  }`}
                >
                  {selected ? <Check size={15} /> : <Plus size={15} />}
                </span>
              </button>
            </div>
          )
        })}
        {list.length === 0 && <p className="py-6 text-center text-sm text-text-muted">Ningún ejercicio con ese nombre</p>}
      </div>
    </div>
  )
}
