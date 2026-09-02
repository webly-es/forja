import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { getBestSetForExercise, getLastSetForExercise } from '../db/queries'
import { SetLogger } from './SetLogger'
import { ExercisePhoto } from './ExercisePhoto'
import { EditSetChip } from './EditSetChip'
import type { Exercise } from '../types'

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

  const bestSet = useLiveQuery(
    () => getBestSetForExercise(profileId, exercise.id!, sessionId),
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
        <div className="flex shrink-0 flex-col items-end gap-1">
          {lastSet && (
            <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-text-muted">
              Última vez: {lastSet.weightKg}kg × {lastSet.reps}
            </span>
          )}
          {bestSet && (
            <span className="rounded-full border border-accent-muted bg-accent-muted/40 px-2.5 py-1 text-xs text-accent">
              Máximo: {bestSet.weightKg}kg × {bestSet.reps}
            </span>
          )}
        </div>
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
