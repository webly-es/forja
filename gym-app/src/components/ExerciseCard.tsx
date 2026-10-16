import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addSet, getBestSetForExercise, getLastSetForExercise, getPreviousSetsForExercise } from '../db/queries'
import { detectRecord, type PersonalRecord } from '../lib/records'
import { SetLogger } from './SetLogger'
import { ExercisePhoto } from './ExercisePhoto'
import { EditSetChip } from './EditSetChip'
import { MachineSettings } from './MachineSettings'
import { getExerciseTarget } from '../db/workoutReviews'
import { Target } from 'lucide-react'
import type { Exercise } from '../types'

interface ExerciseCardProps {
  exercise: Exercise
  profileId: number
  sessionId: number
  onSetLogged: (record: PersonalRecord | null) => void
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

  const target = useLiveQuery(() => getExerciseTarget(profileId, exercise.id!), [profileId, exercise.id])

  const [editingSetId, setEditingSetId] = useState<number | null>(null)
  const [showTargetComment, setShowTargetComment] = useState(false)
  const [saving, setSaving] = useState(false)

  const sets = sessionSets ?? []
  const lastLoggedInSession = sets[sets.length - 1]
  // First set: the coach's target if there is one, else last time. Later sets: repeat the previous one.
  const defaultWeight = lastLoggedInSession?.weightKg ?? target?.weightKg ?? lastSet?.weightKg
  const defaultReps = lastLoggedInSession?.reps ?? target?.reps ?? lastSet?.reps

  async function handleSaveSet(weightKg: number, reps: number) {
    setSaving(true)
    try {
      const previous = await getPreviousSetsForExercise(profileId, exercise.id!, sessionId)
      await addSet({ sessionId, profileId, exerciseId: exercise.id!, weightKg, reps })
      onSetLogged(detectRecord(weightKg, reps, previous))
    } finally {
      setSaving(false)
    }
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
              Última vez: {lastSet.weightKg.toLocaleString('es')}kg × {lastSet.reps}
            </span>
          )}
          {target && (
            <button
              type="button"
              onClick={() => setShowTargetComment((v) => !v)}
              className="flex items-center gap-1 rounded-full border border-accent bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent"
              aria-expanded={showTargetComment}
            >
              <Target size={12} />
              Objetivo: {target.weightKg.toLocaleString('es')}kg × {target.reps}
            </button>
          )}
          {bestSet && (
            <span className="rounded-full border border-accent-muted bg-accent-muted/40 px-2.5 py-1 text-xs text-accent">
              Máximo: {bestSet.weightKg.toLocaleString('es')}kg × {bestSet.reps}
            </span>
          )}
        </div>
      </div>

      {target && showTargetComment && target.comment && (
        <p className="mt-3 rounded-lg border border-accent-muted bg-accent-muted/20 px-3 py-2 text-xs leading-relaxed text-text-muted">
          {target.comment}
        </p>
      )}

      <MachineSettings profileId={profileId} exerciseId={exercise.id!} />

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
                Serie {s.setNumber}: {s.weightKg.toLocaleString('es')}kg × {s.reps}
              </button>
            ),
          )}
        </div>
      )}

      <div className="mt-3">
        <SetLogger
          // Remount when the suggested values arrive or change, since SetLogger only reads them on mount.
          key={`${sets.length}-${defaultWeight ?? ''}-${defaultReps ?? ''}`}
          setNumber={sets.length + 1}
          defaultWeight={defaultWeight}
          defaultReps={defaultReps}
          onSave={handleSaveSet}
          saving={saving}
        />
      </div>
    </div>
  )
}
