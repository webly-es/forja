import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, ChevronRight } from 'lucide-react'
import { db } from '../db/db'
import { ExercisePhoto } from '../components/ExercisePhoto'
import { ExerciseEditSheet } from '../components/ExerciseEditSheet'
import { groupByMuscle } from '../lib/exercises'
import type { Exercise } from '../types'

export function Exercises() {
  const exercises = useLiveQuery(() => db.exercises.toArray(), [], [])
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null)

  const groups = groupByMuscle(exercises ?? [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">Ejercicios</h1>
          <p className="mt-1 text-sm text-text-muted">Catálogo completo, agrupado por músculo</p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-bg hover:bg-accent-hover"
          aria-label="Agregar ejercicio"
        >
          <Plus size={20} />
        </button>
      </div>

      {groups.map(([muscleGroup, list]) => (
        <div key={muscleGroup}>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-text-muted">{muscleGroup}</h2>
          <div className="flex flex-col gap-2">
            {list.map((ex) => (
              <div
                key={ex.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <ExercisePhoto exerciseId={ex.id!} />
                <button
                  onClick={() => setEditing(ex)}
                  className="flex flex-1 items-center justify-between text-left"
                >
                  <span className="font-medium text-text">{ex.name}</span>
                  <ChevronRight size={18} className="text-text-muted" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {editing && (
        <ExerciseEditSheet exercise={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
