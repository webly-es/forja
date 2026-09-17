import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUp, ArrowDown, X, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { deleteRoutine } from '../db/queries'
import { addSeedTombstone, tombstoneKeys } from '../db/seedTombstones'
import { groupByMuscle } from '../lib/exercises'
import { MuscleGroupAccordion } from '../components/MuscleGroupAccordion'
import { ConfirmDeleteRow } from '../components/ConfirmDeleteRow'
import type { RoutineExercise } from '../types'

export function RoutineBuilder() {
  const { routineId } = useParams()
  const editingId = routineId ? Number(routineId) : null
  const navigate = useNavigate()

  const routine = useLiveQuery(() => (editingId ? db.routines.get(editingId) : undefined), [editingId])
  const existingLinks = useLiveQuery(
    () =>
      editingId
        ? db.routineExercises.where('routineId').equals(editingId).sortBy('order')
        : Promise.resolve<RoutineExercise[]>([]),
    [editingId],
  )
  const allExercises = useLiveQuery(() => db.exercises.toArray(), [], [])

  const [name, setName] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (initialized) return
    if (editingId && (routine === undefined || existingLinks === undefined)) return
    setName(routine?.name ?? '')
    setSelected((existingLinks ?? []).map((l) => l.exerciseId))
    setInitialized(true)
  }, [initialized, editingId, routine, existingLinks])

  const exercisesById = new Map((allExercises ?? []).map((e) => [e.id!, e]))
  const groups = groupByMuscle(allExercises ?? [])

  function toggle(exerciseId: number) {
    setSelected((prev) =>
      prev.includes(exerciseId) ? prev.filter((id) => id !== exerciseId) : [...prev, exerciseId],
    )
  }

  function move(index: number, dir: -1 | 1) {
    setSelected((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const canSave = name.trim() !== '' && selected.length > 0

  async function handleSave() {
    if (!canSave) return
    await db.transaction('rw', db.routines, db.routineExercises, db.seedTombstones, async () => {
      let id = editingId
      if (id) {
        await db.routines.update(id, { name: name.trim() })
        if (routine) {
          const removedIds = (existingLinks ?? [])
            .map((l) => l.exerciseId)
            .filter((exId) => !selected.includes(exId))
          for (const exId of removedIds) {
            const exName = exercisesById.get(exId)?.name
            if (exName) {
              await addSeedTombstone(tombstoneKeys.link(routine.key, exName))
            }
          }
        }
      } else {
        id = (await db.routines.add({ key: `custom-${Date.now()}`, name: name.trim() })) as number
      }
      await db.routineExercises.where('routineId').equals(id).delete()
      for (let i = 0; i < selected.length; i++) {
        await db.routineExercises.add({ routineId: id, exerciseId: selected[i], order: i })
      }
    })
    navigate('/workout/start')
  }

  async function handleDelete() {
    if (!editingId) return
    await deleteRoutine(editingId)
    navigate('/workout/start')
  }

  if (!initialized) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/workout/start')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:text-text"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          {editingId ? 'Editar rutina' : 'Crear rutina'}
        </h1>
      </div>

      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-text-muted">Nombre de la rutina</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder="Ej. Día 1 - Pecho y tríceps"
        />
      </div>

      {selected.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs uppercase tracking-wide text-text-muted">
            Ejercicios elegidos ({selected.length})
          </h2>
          <div className="flex flex-col gap-2">
            {selected.map((id, i) => {
              const ex = exercisesById.get(id)
              if (!ex) return null
              return (
                <div
                  key={id}
                  className="flex items-center gap-2 rounded-xl border border-accent-muted bg-accent-muted/20 p-3"
                >
                  <span className="flex-1 text-sm text-text">{ex.name}</span>
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="text-text-muted disabled:opacity-30"
                    aria-label="Subir"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === selected.length - 1}
                    className="text-text-muted disabled:opacity-30"
                    aria-label="Bajar"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button onClick={() => toggle(id)} className="text-danger" aria-label="Quitar">
                    <X size={16} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-xs uppercase tracking-wide text-text-muted">Agregar del catálogo</h2>
        <div className="flex flex-col gap-1">
          {groups.map(([muscleGroup, list]) => {
            const hasSelection = list.some((ex) => selected.includes(ex.id!))
            return (
              <MuscleGroupAccordion key={muscleGroup} label={muscleGroup} count={list.length} defaultOpen={hasSelection}>
                {list.map((ex) => {
                  const isSelected = selected.includes(ex.id!)
                  return (
                    <button
                      key={ex.id}
                      onClick={() => toggle(ex.id!)}
                      className={`rounded-lg border p-2.5 text-left text-sm transition-colors active:scale-[0.98] ${
                        isSelected
                          ? 'border-accent bg-accent-muted/20 text-accent'
                          : 'border-border bg-surface text-text hover:border-accent'
                      }`}
                    >
                      {ex.name}
                    </button>
                  )
                })}
              </MuscleGroupAccordion>
            )
          })}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={!canSave}
        className="rounded-lg bg-accent py-3 text-sm font-medium text-bg transition-all disabled:opacity-30 hover:bg-accent-hover active:enabled:scale-[0.97]"
      >
        Guardar rutina
      </button>

      {editingId && (
        <div>
          {confirmingDelete ? (
            <div className="rounded-xl border border-border bg-surface p-4">
              <ConfirmDeleteRow
                message="¿Eliminar esta rutina?"
                onCancel={() => setConfirmingDelete(false)}
                onConfirm={handleDelete}
              />
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs text-danger hover:underline"
            >
              <Trash2 size={14} />
              Eliminar rutina
            </button>
          )}
        </div>
      )}
    </div>
  )
}
