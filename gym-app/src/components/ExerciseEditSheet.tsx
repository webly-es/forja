import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { ExercisePhoto } from './ExercisePhoto'
import type { Exercise } from '../types'

interface ExerciseEditSheetProps {
  exercise: Exercise | null // null = creating a new one
  onClose: () => void
}

export function ExerciseEditSheet({ exercise, onClose }: ExerciseEditSheetProps) {
  const [name, setName] = useState(exercise?.name ?? '')
  const [muscleGroup, setMuscleGroup] = useState(exercise?.muscleGroup ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const muscleGroups = useLiveQuery(
    () => db.exercises.toArray().then((all) => [...new Set(all.map((e) => e.muscleGroup))].sort()),
    [],
    [],
  )

  const canSave = name.trim() !== '' && muscleGroup.trim() !== ''

  async function handleSave() {
    if (!canSave) return
    if (exercise) {
      await db.exercises.update(exercise.id!, { name: name.trim(), muscleGroup: muscleGroup.trim() })
    } else {
      const count = await db.exercises.count()
      await db.exercises.add({ name: name.trim(), muscleGroup: muscleGroup.trim(), order: count })
    }
    onClose()
  }

  async function handleDelete() {
    if (!exercise?.id) return
    await db.transaction('rw', db.exercises, db.routineExercises, db.exercisePhotos, async () => {
      await db.routineExercises.where('exerciseId').equals(exercise.id!).delete()
      await db.exercisePhotos.delete(exercise.id!)
      await db.exercises.delete(exercise.id!)
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:px-6">
      <div className="w-full max-w-sm rounded-t-2xl border border-border bg-surface p-6 sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-text">{exercise ? 'Editar ejercicio' : 'Nuevo ejercicio'}</h2>

        {exercise?.id && (
          <div className="mt-4 flex items-center gap-3">
            <ExercisePhoto exerciseId={exercise.id} />
            <span className="text-xs text-text-muted">Toca la foto para cambiarla o borrarla</span>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-text-muted">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Ej. Press banca inclinado en máquina"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-text-muted">Grupo muscular</label>
            <input
              type="text"
              value={muscleGroup}
              onChange={(e) => setMuscleGroup(e.target.value)}
              className="input"
              list="muscle-groups"
              placeholder="Ej. Pecho"
            />
            <datalist id="muscle-groups">
              {muscleGroups?.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm text-text-muted hover:text-text"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-medium text-bg transition-opacity disabled:opacity-30 hover:bg-accent-hover"
          >
            Guardar
          </button>
        </div>

        {exercise && (
          <div className="mt-3">
            {confirmingDelete ? (
              <div className="flex items-center justify-between rounded-lg border border-danger/40 bg-danger/10 p-3">
                <span className="text-xs text-text">¿Borrar este ejercicio del catálogo?</span>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmingDelete(false)} className="text-xs text-text-muted">
                    No
                  </button>
                  <button onClick={handleDelete} className="text-xs font-medium text-danger">
                    Sí, borrar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs text-danger hover:underline"
              >
                <Trash2 size={14} />
                Borrar ejercicio
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
