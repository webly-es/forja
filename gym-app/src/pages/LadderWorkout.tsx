import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { db } from '../db/db'
import {
  finishLadderSession,
  getLastLadderSetup,
  getRoutineExercises,
  logLadderRound,
  startLadderSession,
  type LadderFinish,
  type LadderSession,
} from '../db/ladder'
import { useAppStore } from '../store/useAppStore'
import { useWakeLock } from '../hooks/useWakeLock'
import { formatClock } from '../lib/ladder'
import { unlockAudio } from '../lib/sound'
import { LadderSetup } from '../components/ladder/LadderSetup'
import { LadderStepCard } from '../components/ladder/LadderStepCard'
import { LadderRest } from '../components/ladder/LadderRest'
import { LadderReview } from '../components/ladder/LadderReview'
import { WorkoutFinishSummary } from '../components/WorkoutFinishSummary'
import type { LadderSetup as Setup } from '../types'

const kg = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 })

// Guided ladder circuit: /workout/ladder/:routineId is the setup, /workout/ladder/session/:sessionId the circuit.
export function LadderWorkout() {
  const { routineId, sessionId } = useParams()
  if (sessionId) return <LadderRun sessionId={Number(sessionId)} />
  return <LadderStart routineId={Number(routineId)} />
}

function Shell({ title, subtitle, onBack, action, children }: {
  title: string
  subtitle?: string
  onBack: () => void
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:text-text"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 text-center">
          <h1 className="truncate font-display text-lg font-medium uppercase tracking-wide text-text">{title}</h1>
          {subtitle && <p className="text-xs tabular-nums text-accent">{subtitle}</p>}
        </div>
        <div className="flex w-24 shrink-0 justify-end">{action}</div>
      </div>
      <div className="mt-6 flex flex-1 flex-col">{children}</div>
    </div>
  )
}

function LadderStart({ routineId }: { routineId: number }) {
  const navigate = useNavigate()
  const activeProfileId = useAppStore((s) => s.activeProfileId)
  const setActiveSessionId = useAppStore((s) => s.setActiveSessionId)

  const routine = useLiveQuery(() => db.routines.get(routineId), [routineId])
  const profile = useLiveQuery(
    () => (activeProfileId != null ? db.profiles.get(activeProfileId) : undefined),
    [activeProfileId],
  )
  const exercises = useLiveQuery(() => getRoutineExercises(routineId), [routineId])
  const initial = useLiveQuery(
    () => (activeProfileId != null ? getLastLadderSetup(activeProfileId, routineId) : undefined),
    [activeProfileId, routineId],
  )

  if (activeProfileId == null) return <Navigate to="/select" replace />
  if (!routine || !profile || !exercises || !initial) return null

  async function handleStart(setup: Omit<Setup, 'roundsDone'>) {
    unlockAudio()
    const id = await startLadderSession(activeProfileId!, routine!, setup)
    setActiveSessionId(id)
    navigate(`/workout/ladder/session/${id}`, { replace: true })
  }

  return (
    <Shell title={routine.name} subtitle="Circuito con mancuernas" onBack={() => navigate('/workout/start')}>
      <LadderSetup exercises={exercises} bodyWeightKg={profile.weightKg} initial={initial} onStart={handleStart} />
    </Shell>
  )
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [active])
  return now
}

type Phase = { kind: 'work' } | { kind: 'rest'; endsAt: number }

function LadderRun({ sessionId }: { sessionId: number }) {
  const navigate = useNavigate()
  const setActiveSessionId = useAppStore((s) => s.setActiveSessionId)

  const session = useLiveQuery(
    () => db.workoutSessions.get(sessionId).then((s) => (s?.ladder ? (s as LadderSession) : undefined)),
    [sessionId],
    null,
  )
  const exercises = useLiveQuery(
    () => (session ? getRoutineExercises(session.routineId) : undefined),
    [session?.routineId],
  )

  const [phase, setPhase] = useState<Phase>({ kind: 'work' })
  const [exerciseIndex, setExerciseIndex] = useState(0)
  // Reps actually done when fewer than the target, keyed "round-exerciseIndex".
  const [adjusted, setAdjusted] = useState<Record<string, number>>({})
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [finished, setFinished] = useState<LadderFinish | null>(null)
  // Set before writing finishedAt, so the live query doesn't redirect to History mid-finish.
  const [finishing, setFinishing] = useState(false)
  const busy = useRef(false)

  const running = !!session && !session.finishedAt && !finishing
  useWakeLock(running)
  const now = useNow(running)

  if (session === null) return null
  if (session === undefined) return <Navigate to="/workout/start" replace />
  if (session.finishedAt && !finishing) return <Navigate to={`/history/${session.id}`} replace />
  if (!exercises) return null

  const { startReps, restSeconds, roundsDone, dumbbellKg } = session.ladder
  const rounds = startReps
  const round = Math.min(roundsDone + 1, rounds)
  const target = startReps - round + 1
  const repsFor = (index: number) => adjusted[`${round}-${index}`] ?? target
  const elapsed = (finished ? Date.parse(session.finishedAt ?? new Date().toISOString()) : now) - Date.parse(session.startedAt)

  async function finish(partialUpTo: number) {
    if (busy.current) return
    busy.current = true
    setFinishing(true)
    try {
      // Exercises already done in an unfinished round still count.
      if (partialUpTo > 0 && roundsDone < rounds) {
        await logLadderRound(session!, round, exercises!.slice(0, partialUpTo).map((ex, i) => ({ exerciseId: ex.id!, reps: repsFor(i) })))
      }
      const result = await finishLadderSession(sessionId)
      setActiveSessionId(null)
      if (result) setFinished(result)
      else setFinishing(false)
    } finally {
      busy.current = false
    }
  }

  async function handleDone() {
    if (busy.current || !exercises) return
    if (exerciseIndex < exercises.length - 1) {
      setExerciseIndex(exerciseIndex + 1)
      return
    }
    busy.current = true
    try {
      await logLadderRound(session!, round, exercises.map((ex, i) => ({ exerciseId: ex.id!, reps: repsFor(i) })))
    } finally {
      busy.current = false
    }
    setExerciseIndex(0)
    if (round >= rounds) await finish(0)
    else setPhase({ kind: 'rest', endsAt: Date.now() + restSeconds * 1000 })
  }

  const exercise = exercises[exerciseIndex]
  const isLastOfRound = exerciseIndex === exercises.length - 1
  const next =
    !isLastOfRound
      ? { exercise: exercises[exerciseIndex + 1], reps: repsFor(exerciseIndex + 1), newRound: false }
      : round < rounds
        ? { exercise: exercises[0], reps: target - 1, newRound: true }
        : undefined

  const finishAction = !finished && (
    confirmFinish ? (
      <div className="flex gap-1">
        <button onClick={() => setConfirmFinish(false)} className="rounded-lg px-2 py-2 text-xs text-text-muted">
          No
        </button>
        <button
          onClick={() => void finish(phase.kind === 'work' ? exerciseIndex : 0)}
          className="rounded-lg bg-accent px-2.5 py-2 text-xs font-medium text-bg"
        >
          Terminar
        </button>
      </div>
    ) : (
      <button
        onClick={() => setConfirmFinish(true)}
        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:text-text"
      >
        <Check size={15} />
        Finalizar
      </button>
    )
  )

  return (
    <Shell
      title={session.routineName}
      subtitle={`${formatClock(elapsed / 1000)} · ${kg(dumbbellKg)} kg por mancuerna`}
      onBack={() => navigate('/workout/start')}
      action={finishAction}
    >
      {confirmFinish && (
        <p className="-mt-3 mb-3 text-center text-xs text-text-muted">Se guardan las rondas y ejercicios que ya has hecho.</p>
      )}

      {phase.kind === 'rest' && !finished ? (
        <LadderRest
          endsAt={phase.endsAt}
          totalSeconds={restSeconds}
          nextRound={round}
          rounds={rounds}
          nextReps={target}
          onDone={() => setPhase({ kind: 'work' })}
        />
      ) : (
        exercise && (
          <LadderStepCard
            round={round}
            rounds={rounds}
            exercise={exercise}
            exerciseIndex={exerciseIndex}
            exerciseCount={exercises.length}
            targetReps={target}
            reps={repsFor(exerciseIndex)}
            next={next}
            onRepsChange={(reps) => setAdjusted((a) => ({ ...a, [`${round}-${exerciseIndex}`]: reps }))}
            onDone={() => void handleDone()}
          />
        )
      )}

      {finished && (
        <WorkoutFinishSummary
          title={session.ladder.roundsDone >= rounds ? 'Escalera completada' : 'Circuito terminado'}
          durationMinutes={finished.minutes}
          calories={finished.calories}
          onClose={() => navigate('/home')}
          onViewDetail={() => navigate(`/history/${sessionId}`)}
        >
          <div className="mb-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg border border-border bg-surface-2 py-2">
              <div className="text-lg font-semibold tabular-nums text-text">{formatClock(finished.seconds)}</div>
              <div className="text-[11px] text-text-muted">tiempo total</div>
            </div>
            <div className="rounded-lg border border-border bg-surface-2 py-2">
              <div className="text-lg font-semibold tabular-nums text-text">
                {finished.bestSeconds != null ? formatClock(finished.bestSeconds) : '—'}
              </div>
              <div className="text-[11px] text-text-muted">mejor con {kg(dumbbellKg)} kg</div>
            </div>
          </div>
          {finished.hasSets && <LadderReview sessionId={sessionId} autoStart />}
        </WorkoutFinishSummary>
      )}
    </Shell>
  )
}
