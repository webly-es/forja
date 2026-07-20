import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { deleteSetAndRenumber, getLastSetForExercise } from '../db/queries'
import { SetLogger } from './SetLogger'
import { ExercisePhoto } from './ExercisePhoto'
import type { Exercise, SetLog } from '../types'

interface ExerciseCardProps {
  exercise: Exercise
  profileId: number
  sessionId: number
  onSetLogged: () => void
}

export function ExerciseCard({ exercise, profileId, sessionId, onSetLogged }: ExerciseCardProps) {
  const sessionSets = useLiveQuery(
    () =>
      db.sets
        .where({ sessionId, exerciseId: exercise.id! })
        .toArray()
        .then((sets) => sets.sort((a, b) => a.setNumber - b.setNumber)),
    [sessionId, exercise.id],
    [],
  )

  const lastSet = useLiveQuery(
    () => getLastSetForExercise(profileId, exercise.id!, sessionId),
    [profileId, exercise.id, sessionId],
  )

  const [editingSetId, setEditingSetId] = useState<number | null>(null)

  const sets = sessionSets ?? []
  const lastLoggedInSession = sets[sets.length - 1]
  const defaultWeight = lastLoggedInSession?.weightKg ?? lastSet?.weightKg
  const defaultReps = lastLoggedInSession?.reps ?? lastSet?.reps

  async function handleSaveSet(weightKg: number, reps: number) {
    await db.sets.add({
      sessionId,
      profileId,
      exerciseId: exercise.id!,
      setNumber: sets.length + 1,
      weightKg,
      reps,
      restSeconds: 0,
      completedAt: new Date().toISOString(),
    })
    onSetLogged()
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <ExercisePhoto exerciseId={exercise.id!} />
          <div>
            <h3 className="font-medium text-text">{exercise.name}</h3>
            <span className="text-xs text-text-muted">{exercise.muscleGroup}</span>
          </div>
        </div>
        {lastSet && (
          <span className="shrink-0 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-text-muted">
            Última vez: {lastSet.weightKg}kg × {lastSet.reps}
          </span>
        )}
      </div>

      {sets.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {sets.map((s) =>
            s.id === editingSetId ? (
              <EditSetChip
                key={s.id}
                set={s}
                onDone={() => setEditingSetId(null)}
              />
            ) : (
              <button
                key={s.id}
                type="button"
                onClick={() => setEditingSetId(s.id!)}
                className="rounded-md border border-accent-muted bg-accent-muted/40 px-2 py-1 text-xs text-accent"
              >
                Serie {s.setNumber}: {s.weightKg}kg × {s.reps}
              </button>
            ),
          )}
        </div>
      )}

      <div className="mt-3">
        <SetLogger
          setNumber={sets.length + 1}
          defaultWeight={defaultWeight}
          defaultReps={defaultReps}
          onSave={handleSaveSet}
        />
      </div>
    </div>
  )
}

function EditSetChip({ set, onDone }: { set: SetLog; onDone: () => void }) {
  const [weight, setWeight] = useState(String(set.weightKg))
  const [reps, setReps] = useState(String(set.reps))

  async function handleSave() {
    const weightKg = Number(weight)
    const repsNum = Number(reps)
    if (weightKg < 0 || repsNum <= 0) return
    await db.sets.update(set.id!, { weightKg, reps: repsNum })
    onDone()
  }

  async function handleDelete() {
    await deleteSetAndRenumber(set.sessionId, set.exerciseId, set.id!)
    onDone()
  }

  return (
    <div className="flex items-center gap-1 rounded-md border border-accent bg-accent-muted/40 px-1.5 py-1">
      <input
        type="number"
        inputMode="decimal"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        className="w-12 rounded bg-surface-2 px-1 py-0.5 text-center text-xs text-text"
      />
      <span className="text-xs text-accent">×</span>
      <input
        type="number"
        inputMode="numeric"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        className="w-10 rounded bg-surface-2 px-1 py-0.5 text-center text-xs text-text"
      />
      <button type="button" onClick={handleSave} aria-label="Guardar serie" className="text-accent">
        <Check size={14} />
      </button>
      <button type="button" onClick={handleDelete} aria-label="Borrar serie" className="text-danger">
        <Trash2 size={14} />
      </button>
    </div>
  )
}
