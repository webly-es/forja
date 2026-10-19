import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Search, X } from 'lucide-react'
import { db } from '../db/db'
import { getExerciseStats } from '../db/exerciseStats'
import { ExerciseEditSheet } from '../components/ExerciseEditSheet'
import { ExerciseRow } from '../components/exercises/ExerciseRow'
import { MuscleChips } from '../components/exercises/MuscleChips'
import { groupByMuscle, normalize } from '../lib/exercises'
import { MUSCLE_GROUPS, type MuscleGroup } from '../lib/muscleGroups'
import { useAppStore } from '../store/useAppStore'
import type { Exercise } from '../types'

const GROUP_KEY = 'forja-exercises-group'

function readGroup(): MuscleGroup | null {
  try {
    const saved = localStorage.getItem(GROUP_KEY)
    return MUSCLE_GROUPS.find((g) => g === saved) ?? null
  } catch {
    return null
  }
}

export function Exercises() {
  const activeProfileId = useAppStore((s) => s.activeProfileId)!
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [])
  const stats = useLiveQuery(() => getExerciseStats(activeProfileId), [activeProfileId])
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null)
  const [group, setGroup] = useState<MuscleGroup | null>(readGroup)
  const [query, setQuery] = useState('')

  function chooseGroup(next: MuscleGroup | null) {
    setGroup(next)
    try {
      if (next) localStorage.setItem(GROUP_KEY, next)
      else localStorage.removeItem(GROUP_KEY)
    } catch {
      // Private mode: the shortcut just isn't remembered.
    }
  }

  const all = exercises ?? []
  const searching = query.trim().length > 0
  const needle = normalize(query.trim())
  const filtered = all.filter((ex) =>
    searching ? normalize(ex.name).includes(needle) : group === null || ex.muscleGroup === group,
  )
  // "Todos" keeps one section per muscle; a single group or a search is one flat list.
  const sections: [string | null, Exercise[]][] =
    !searching && group === null
      ? groupByMuscle(filtered)
      : [[null, [...filtered].sort((a, b) => a.name.localeCompare(b.name))]]
  const presentGroups = [...new Set(all.map((ex) => ex.muscleGroup))]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wide text-text">Ejercicios</h1>
          <p className="mt-0.5 text-sm text-text-muted">{all.length} en el catálogo</p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-bg transition-transform hover:bg-accent-hover active:scale-[0.97]"
          aria-label="Agregar ejercicio"
        >
          <Plus size={20} />
        </button>
      </div>

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
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text"
            aria-label="Borrar búsqueda"
          >
            <X size={16} />
          </button>
        )}
      </label>

      {!searching && <MuscleChips groups={presentGroups} selected={group} onSelect={chooseGroup} />}

      <div className="flex flex-col gap-5">
        {sections.map(([title, list]) => (
          <section key={title ?? 'list'} className="flex flex-col gap-2">
            {title && (
              <h2 className="flex items-baseline gap-2 font-display text-sm uppercase tracking-widest text-accent">
                {title}
                <span className="text-xs text-text-muted">{list.length}</span>
              </h2>
            )}
            {list.map((ex) => (
              <ExerciseRow
                key={ex.id}
                exercise={ex}
                stats={stats?.get(ex.id!)}
                showGroup={searching}
                onOpen={() => setEditing(ex)}
              />
            ))}
          </section>
        ))}
        {filtered.length === 0 && (
          <button
            onClick={() => setEditing('new')}
            className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border py-8 text-sm text-text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <span>{searching ? 'Ningún ejercicio con ese nombre' : 'Sin ejercicios en este grupo'}</span>
            <span className="flex items-center gap-1 text-accent">
              <Plus size={14} /> Crear ejercicio
            </span>
          </button>
        )}
      </div>

      {editing && (
        <ExerciseEditSheet exercise={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
