import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { swapForSession, swapInRoutine } from '../db/workoutSwaps'
import { askCoach, type CoachAnswer } from '../lib/ai/workoutAssistant'
import type { ChangeRequest } from '../lib/ai/routineCoach'
import { useAppStore } from '../store/useAppStore'
import { SettingsSheet } from './settings/SettingsSheet'
import { AiComposer } from './AiComposer'
import { ExercisePhoto } from './ExercisePhoto'
import type { Exercise, Profile, RoutineItem } from '../types'

const QUICK_QUESTIONS = ['La máquina está ocupada', 'Me molesta al hacerlo', '¿Cómo lo hago bien?']

interface CoachSheetProps {
  sessionId: number
  profile: Profile
  exercise: Exercise
  plan?: RoutineItem
  routineExerciseIds: number[]
  onClose: () => void
}

// Mid-workout questions about one exercise; can swap it for today or for good.
export function CoachSheet({ sessionId, profile, exercise, plan, routineExerciseIds, onClose }: CoachSheetProps) {
  const geminiApiKey = useAppStore((s) => s.geminiApiKey)
  const geminiModel = useAppStore((s) => s.geminiModel)
  const catalog = useLiveQuery(() => db.exercises.toArray(), [], [])
  const todaySets = useLiveQuery(() => db.sets.where({ sessionId, exerciseId: exercise.id! }).sortBy('setNumber'), [sessionId, exercise.id], [])

  const [answer, setAnswer] = useState<CoachAnswer | null>(null)
  const [asking, setAsking] = useState<string | null>(null) // quick question being asked
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const ask = (question: ChangeRequest, signal?: AbortSignal) =>
    askCoach(
      { profile, exercise, plan, todaySets: todaySets ?? [], routineExerciseIds, catalog: catalog ?? [] },
      question,
      geminiApiKey,
      geminiModel,
      signal,
    )

  async function askQuick(text: string) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setAsking(text)
    setError(null)
    try {
      const result = await ask({ text }, controller.signal)
      if (!controller.signal.aborted) setAnswer(result)
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'No se pudo preguntar.')
    } finally {
      if (abortRef.current === controller) setAsking(null)
    }
  }

  async function choose(to: number, scope: 'today' | 'routine') {
    if (scope === 'today') await swapForSession(sessionId, exercise.id!, to)
    else await swapInRoutine(sessionId, exercise.id!, to)
    onClose()
  }

  const byId = new Map((catalog ?? []).map((e) => [e.id!, e]))

  return (
    <SettingsSheet title="Pregunta al coach" onClose={onClose}>
      <p className="-mt-2 text-sm text-accent">{exercise.name}</p>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => void askQuick(q)}
            disabled={asking != null}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
              asking === q ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-surface-2 text-text-muted hover:text-text'
            }`}
          >
            {q}
          </button>
        ))}
      </div>

      <AiComposer
        placeholder="Ej. no hay mancuernas de 20, ¿qué hago?"
        purpose="preguntar al coach"
        onSubmit={async (input, signal) => {
          setError(null)
          const result = await ask(input, signal)
          if (!signal.aborted) setAnswer(result)
        }}
      />

      {asking && <p className="text-xs text-text-muted">Pensando…</p>}
      {error && <p className="text-xs text-danger">{error}</p>}

      {answer && (
        <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4">
          <p className="text-sm leading-relaxed text-text">{answer.answer}</p>
          {answer.alternatives.map((alt) => {
            const ex = byId.get(alt.exerciseId)
            if (!ex) return null
            return (
              <div key={alt.exerciseId} className="rounded-xl border border-border bg-surface-2 p-3">
                <div className="flex items-center gap-3">
                  <ExercisePhoto exerciseId={ex.id!} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-text">{ex.name}</span>
                    {alt.reason && <span className="mt-0.5 block text-xs leading-relaxed text-text-muted">{alt.reason}</span>}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => void choose(ex.id!, 'today')}
                    className="rounded-lg bg-accent py-2 text-xs font-medium text-bg active:scale-[0.97]"
                  >
                    Cambiar solo hoy
                  </button>
                  <button
                    onClick={() => void choose(ex.id!, 'routine')}
                    className="rounded-lg border border-accent-muted py-2 text-xs text-accent active:scale-[0.97]"
                  >
                    También en la rutina
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </SettingsSheet>
  )
}
