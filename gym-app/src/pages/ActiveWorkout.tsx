import { useCallback, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import { ExerciseCard } from '../components/ExerciseCard'
import { RestTimer } from '../components/RestTimer'
import { WorkoutFinishSummary } from '../components/WorkoutFinishSummary'
import { WorkoutReview } from '../components/WorkoutReview'
import { RecordToast } from '../components/RecordToast'
import type { PersonalRecord } from '../lib/records'
import { MET_STRENGTH_TRAINING, estimateCalories } from '../lib/calories'
import { ArrowLeft, Check } from 'lucide-react'
import { linkToItem } from '../db/routines'
import type { Exercise, RoutineItem } from '../types'

export function ActiveWorkout() {
  const { sessionId } = useParams()
  const id = Number(sessionId)
  const navigate = useNavigate()
  const setActiveSessionId = useAppStore((s) => s.setActiveSessionId)
  const restDurationDefault = useAppStore((s) => s.restDurationDefault)
  const setRestDurationDefault = useAppStore((s) => s.setRestDurationDefault)

  const [restKey, setRestKey] = useState(0)
  const [restVisible, setRestVisible] = useState(false)
  const [finished, setFinished] = useState<{ minutes: number; calories: number; hasSets: boolean } | null>(null)

  const session = useLiveQuery(() => db.workoutSessions.get(id), [id])
  const profile = useLiveQuery(() => (session ? db.profiles.get(session.profileId) : undefined), [session])
  // Each exercise with the routine's prescription for it (sets, reps, rest), if any.
  const exercises = useLiveQuery(
    async () => {
      if (!session) return []
      const links = await db.routineExercises.where('routineId').equals(session.routineId).sortBy('order')
      const list = await db.exercises.bulkGet(links.map((l) => l.exerciseId))
      return links.flatMap((link, i) => {
        const exercise = list[i]
        return exercise ? [{ exercise, plan: linkToItem(link) }] : []
      })
    },
    [session],
  )
  const [restSeconds, setRestSeconds] = useState(restDurationDefault)

  const [record, setRecord] = useState<{ key: number; exerciseName: string; record: PersonalRecord } | null>(null)
  const closeRecord = useCallback(() => setRecord(null), [])

  function handleSetLogged(exercise: Exercise, plan: RoutineItem, newRecord: PersonalRecord | null) {
    setRestSeconds(plan.restSeconds ?? restDurationDefault)
    setRestKey((k) => k + 1)
    setRestVisible(true)
    if (newRecord) setRecord({ key: Date.now(), exerciseName: exercise.name, record: newRecord })
  }

  async function handleFinish() {
    if (!session || !profile) return
    const finishedAt = new Date().toISOString()
    const durationMinutes = Math.max(
      1,
      Math.round((new Date(finishedAt).getTime() - new Date(session.startedAt).getTime()) / 60000),
    )
    const calories = estimateCalories(MET_STRENGTH_TRAINING, profile.weightKg, durationMinutes)
    await db.workoutSessions.update(id, { finishedAt, caloriesBurned: calories })
    setActiveSessionId(null)
    const hasSets = (await db.sets.where('sessionId').equals(id).count()) > 0
    setFinished({ minutes: durationMinutes, calories, hasSets })
  }

  if (!session || !exercises) return null

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-32 pt-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/home')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:text-text"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-medium text-text">{session.routineName}</h1>
        <button
          onClick={handleFinish}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-bg hover:bg-accent-hover"
        >
          <Check size={16} />
          Finalizar
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {exercises.map(({ exercise, plan }) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            plan={plan}
            profileId={session.profileId}
            sessionId={id}
            onSetLogged={(r) => handleSetLogged(exercise, plan, r)}
          />
        ))}
      </div>

      {record && !finished && (
        <RecordToast key={record.key} exerciseName={record.exerciseName} record={record.record} onClose={closeRecord} />
      )}

      {restVisible && !finished && (
        <RestTimer
          key={restKey}
          initialSeconds={restSeconds}
          onFinish={() => setRestVisible(false)}
          onCancel={() => setRestVisible(false)}
          onChangeDefault={setRestDurationDefault}
        />
      )}

      {finished && (
        <WorkoutFinishSummary
          title="Entrenamiento completado"
          durationMinutes={finished.minutes}
          calories={finished.calories}
          onClose={() => navigate('/home')}
          onViewDetail={() => navigate(`/history/${id}`)}
        >
          {finished.hasSets && <WorkoutReview sessionId={id} autoStart />}
        </WorkoutFinishSummary>
      )}
    </div>
  )
}
