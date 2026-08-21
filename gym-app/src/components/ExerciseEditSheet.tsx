import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { addSeedTombstone, tombstoneKeys } from '../db/seedTombstones'
import { resizeImageToBlob } from '../lib/image'
import { MUSCLE_GROUPS, type MuscleGroup } from '../lib/muscleGroups'
import { ExercisePhoto } from './ExercisePhoto'
import type { Exercise } from '../types'

interface ExerciseEditSheetProps {
  exercise: Exercise | null // null = creating a new one
  onClose: () => void
}

export function ExerciseEditSheet({ exercise, onClose }: ExerciseEditSheetProps) {
  const [name, setName] = useState(exercise?.name ?? '')
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | ''>(exercise?.muscleGroup ?? '')
  const [confirmingDeleteExercise, setConfirmingDeleteExercise] = useState(false)
  const [confirmingDeletePhoto, setConfirmingDeletePhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const photo = useLiveQuery(
    () => (exercise?.id ? db.exercisePhotos.get(exercise.id) : undefined),
    [exercise?.id],
  )

  // Deleting an exercise used to leave its logged sets behind pointing at an
  // exerciseId that no longer resolves to anything, so they silently vanish
  // from History and from the "última vez"/"máximo" badges. Now the delete
  // always cascades to those sets too, so it's never a partial/orphaned
  // state — but warn with the count first since it's real training history.
  const loggedSetsCount = useLiveQuery(
    () => (exercise?.id ? db.sets.where('exerciseId').equals(exercise.id).count() : 0),
    [exercise?.id],
    0,
  )

  const canSave = name.trim() !== '' && muscleGroup !== ''

  async function handleSave() {
    if (!canSave) return
    const group = muscleGroup as MuscleGroup
    if (exercise) {
      await db.exercises.update(exercise.id!, { name: name.trim(), muscleGroup: group })
    } else {
      const count = await db.exercises.count()
      await db.exercises.add({ name: name.trim(), muscleGroup: group, order: count })
    }
    onClose()
  }

  async function handleDeleteExercise() {
    if (!exercise?.id) return
    await db.transaction(
      'rw',
      db.exercises,
      db.routineExercises,
      db.exercisePhotos,
      db.sets,
      db.seedTombstones,
      async () => {
        await addSeedTombstone(tombstoneKeys.exercise(exercise.name))
        await db.routineExercises.where('exerciseId').equals(exercise.id!).delete()
        await db.exercisePhotos.delete(exercise.id!)
        await db.sets.where('exerciseId').equals(exercise.id!).delete()
        await db.exercises.delete(exercise.id!)
      },
    )
    onClose()
  }

  async function handleDeletePhoto() {
    if (!exercise?.id) return
    await db.exercisePhotos.delete(exercise.id)
    setConfirmingDeletePhoto(false)
  }

  async function handlePhotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !exercise?.id) return
    const blob = await resizeImageToBlob(file)
    await db.exercisePhotos.put({ exerciseId: exercise.id, blob, updatedAt: new Date().toISOString() })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:px-6">
      <div className="w-full max-w-sm rounded-t-2xl border border-border bg-surface p-6 sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-text">{exercise ? 'Editar ejercicio' : 'Nuevo ejercicio'}</h2>

        {exercise?.id && (
          <div className="mt-4 flex items-center gap-3">
            <ExercisePhoto exerciseId={exercise.id} />
            <div className="flex flex-col items-start gap-1">
              <span className="text-xs text-text-muted">Toca la foto para verla en grande</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-left text-xs text-accent hover:underline"
              >
                {photo ? 'Cambiar foto' : 'Agregar foto'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handlePhotoFileChange}
              />
              {photo &&
                (confirmingDeletePhoto ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text">¿Borrar la foto?</span>
                    <button
                      onClick={() => setConfirmingDeletePhoto(false)}
                      className="text-xs text-text-muted"
                    >
                      No
                    </button>
                    <button onClick={handleDeletePhoto} className="text-xs font-medium text-danger">
                      Sí, borrar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingDeletePhoto(true)}
                    className="text-left text-xs text-danger hover:underline"
                  >
                    Borrar foto
                  </button>
                ))}
            </div>
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
            <select
              value={muscleGroup}
              onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}
              className="input"
            >
              <option value="" disabled>
                Selecciona un grupo
              </option>
              {MUSCLE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
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
            {confirmingDeleteExercise ? (
              <div className="flex flex-col gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3">
                <span className="text-xs text-text">
                  {loggedSetsCount > 0
                    ? `Este ejercicio tiene ${loggedSetsCount} ${loggedSetsCount === 1 ? 'serie registrada' : 'series registradas'}. Si lo borras, se pierde ese historial también. ¿Borrar de todas formas?`
                    : '¿Borrar este ejercicio del catálogo?'}
                </span>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setConfirmingDeleteExercise(false)} className="text-xs text-text-muted">
                    No
                  </button>
                  <button onClick={handleDeleteExercise} className="text-xs font-medium text-danger">
                    Sí, borrar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDeleteExercise(true)}
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
