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
import { ArrowLeft, Check, ChevronDown, MessageCircle, RotateCcw } from 'lucide-react'
import { linkToItem } from '../db/routines'
import { applySwaps } from '../db/workoutSwaps'
import { CoachSheet } from '../components/CoachSheet'
import { SessionCoachSheet } from '../components/workout/SessionCoachSheet'
import { SkipReasonSheet } from '../components/workout/SkipReasonSheet'
import { restoreExercise, saveSkipped } from '../db/sessionCoach'
import { SKIP_REASON_LABELS, applyAdjustments, guessSkipReason } from '../lib/sessionIncidents'
import type { Exercise, RoutineItem, SkipReason } from '../types'

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
  // Each exercise with the routine's prescription for it (sets, reps, rest), with today's swaps applied.
  const exercises = useLiveQuery(
    async () => {
      if (!session) return []
      const links = await db.routineExercises.where('routineId').equals(session.routineId).sortBy('order')
      const logged = new Set((await db.sets.where('sessionId').equals(id).toArray()).map((s) => s.exerciseId))
      const entries = applySwaps(links.map((l) => l.exerciseId), session.swaps, logged)
      const list = await db.exercises.bulkGet(entries.map((e) => e.id))
      return entries.flatMap((entry, i) => {
        const exercise = list[i]
        const link = links.find((l) => l.exerciseId === entry.from)
        return exercise && link ? [{ exercise, plan: linkToItem(link) }] : []
      })
    },
    [session, id],
  )
  const loggedIds = useLiveQuery(
    async () => new Set((await db.sets.where('sessionId').equals(id).toArray()).map((s) => s.exerciseId)),
    [id],
    new Set<number>(),
  )
  const [coachFor, setCoachFor] = useState<{ exercise: Exercise; plan: RoutineItem } | null>(null)
  const [sessionCoachOpen, setSessionCoachOpen] = useState(false)
  const [askingReason, setAskingReason] = useState(false)
  const [showDropped, setShowDropped] = useState(false)
  const [restSeconds, setRestSeconds] = useState(restDurationDefault)

  const [record, setRecord] = useState<{ key: number; exerciseName: string; record: PersonalRecord } | null>(null)
  const closeRecord = useCallback(() => setRecord(null), [])

  function handleSetLogged(exercise: Exercise, plan: RoutineItem, newRecord: PersonalRecord | null) {
    setRestSeconds(plan.restSeconds ?? restDurationDefault)
    setRestKey((k) => k + 1)
    setRestVisible(true)
    if (newRecord) setRecord({ key: Date.now(), exerciseName: exercise.name, record: newRecord })
  }

  // Exercises of today with no sets and no reason yet: asked about before finishing.
  function pendingWithoutReason() {
    if (!session || !exercises) return []
    const explained = new Set((session.skipped ?? []).map((s) => s.exerciseId))
    return applyAdjustments(exercises, session.adjustments).active
      .map((e) => e.exercise)
      .filter((e) => !loggedIds.has(e.id!) && !explained.has(e.id!))
  }

  function handleFinish() {
    if (pendingWithoutReason().length > 0) setAskingReason(true)
    else void finish()
  }

  async function finishWithReason(reason: SkipReason) {
    await saveSkipped(id, pendingWithoutReason().map((e) => e.id!), reason)
    setAskingReason(false)
    setSessionCoachOpen(false)
    await finish()
  }

  async function finish() {
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
  const { active, dropped } = applyAdjustments(exercises, session.adjustments)
  const skipReason = new Map((session.skipped ?? []).map((s) => [s.exerciseId, s.reason]))

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

      <button
        onClick={() => setSessionCoachOpen(true)}
        className="card-forged mt-5 flex items-center gap-3 p-3 text-left transition-colors hover:border-accent-muted active:scale-[0.98]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <MessageCircle size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-text">¿Pasa algo? Habla con el coach</span>
          <span className="block truncate text-xs text-text-muted">
            {session.notes?.length ? session.notes[session.notes.length - 1].text : 'Tienes que irte, vas justo de tiempo o te duele algo'}
          </span>
        </span>
      </button>

      <div className="mt-3 flex flex-col gap-3">
        {active.map(({ exercise, plan }) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            plan={plan}
            profileId={session.profileId}
            sessionId={id}
            onSetLogged={(r) => handleSetLogged(exercise, plan, r)}
            onAskCoach={() => setCoachFor({ exercise, plan })}
          />
        ))}
      </div>

      {dropped.length > 0 && (
        <section className="mt-4">
          <button
            onClick={() => setShowDropped((v) => !v)}
            className="flex w-full items-center justify-between py-2 text-xs uppercase tracking-wide text-text-muted"
            aria-expanded={showDropped}
          >
            Fuera de hoy ({dropped.length})
            <ChevronDown size={14} className={`transition-transform ${showDropped ? 'rotate-180' : ''}`} />
          </button>
          {showDropped && (
            <div className="flex flex-col gap-2">
              {dropped.map(({ exercise }) => {
                const reason = skipReason.get(exercise.id!)
                return (
                  <div key={exercise.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-text-muted line-through decoration-text-muted/40">{exercise.name}</span>
                      {reason && <span className="block text-xs text-text-muted">{SKIP_REASON_LABELS[reason]}</span>}
                    </span>
                    <button
                      onClick={() => void restoreExercise(id, exercise.id!)}
                      className="flex shrink-0 items-center gap-1 text-xs text-accent hover:text-accent-hover"
                    >
                      <RotateCcw size={13} />
                      Recuperar
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

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

      {coachFor && profile && (
        <CoachSheet
          sessionId={id}
          profile={profile}
          exercise={coachFor.exercise}
          plan={coachFor.plan}
          routineExerciseIds={exercises.map((e) => e.exercise.id!)}
          onClose={() => setCoachFor(null)}
        />
      )}

      {sessionCoachOpen && profile && !finished && (
        <SessionCoachSheet
          session={session}
          profile={profile}
          entries={active}
          onFinishNow={(reason) => void finishWithReason(reason)}
          onClose={() => setSessionCoachOpen(false)}
        />
      )}

      {askingReason && !finished && (
        <SkipReasonSheet
          pending={pendingWithoutReason()}
          suggested={guessSkipReason(session.notes)}
          onConfirm={(reason) => void finishWithReason(reason)}
          onKeepTraining={() => setAskingReason(false)}
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
