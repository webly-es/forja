import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Search, X } from 'lucide-react'
import { db } from '../db/db'
import { getExerciseStats } from '../db/exerciseStats'
import { ExerciseEditSheet } from '../components/ExerciseEditSheet'
import { ExerciseRow } from '../components/exercises/ExerciseRow'
import { PatternTabs } from '../components/exercises/PatternTabs'
import { groupsOf, isPatternKey, type PatternKey } from '../lib/exercisePatterns'
import type { MuscleGroup } from '../lib/muscleGroups'
import { useAppStore } from '../store/useAppStore'
import type { Exercise } from '../types'

const TAB_KEY = 'forja-exercises-tab'

function readTab(): PatternKey {
  try {
    const saved = localStorage.getItem(TAB_KEY)
    return isPatternKey(saved) ? saved : 'empuje'
  } catch {
    return 'empuje'
  }
}

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export function Exercises() {
  const activeProfileId = useAppStore((s) => s.activeProfileId)!
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [])
  const stats = useLiveQuery(() => getExerciseStats(activeProfileId), [activeProfileId])
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null)
  const [pattern, setPattern] = useState<PatternKey>(readTab)
  const [group, setGroup] = useState<MuscleGroup | null>(null)
  const [query, setQuery] = useState('')

  function choosePattern(next: PatternKey) {
    setPattern(next)
    setGroup(null)
    try {
      localStorage.setItem(TAB_KEY, next)
    } catch {
      // Private mode: the tab just isn't remembered.
    }
  }

  const searching = query.trim().length > 0
  const needle = normalize(query.trim())
  const visibleGroups = group ? [group] : groupsOf(pattern)
  const list = (exercises ?? [])
    .filter((ex) => (searching ? normalize(ex.name).includes(needle) : visibleGroups.includes(ex.muscleGroup)))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wide text-text">Ejercicios</h1>
          <p className="mt-0.5 text-sm text-text-muted">{exercises?.length ?? 0} en el catálogo</p>
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

      {!searching && <PatternTabs pattern={pattern} group={group} onPattern={choosePattern} onGroup={setGroup} />}

      <div className="flex flex-col gap-2">
        {list.map((ex) => (
          <ExerciseRow
            key={ex.id}
            exercise={ex}
            stats={stats?.get(ex.id!)}
            showGroup={searching || (group === null && visibleGroups.length > 1)}
            onOpen={() => setEditing(ex)}
          />
        ))}
        {list.length === 0 && (
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
