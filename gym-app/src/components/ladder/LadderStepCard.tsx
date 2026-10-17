import { ArrowRight, Check, Minus, Plus } from 'lucide-react'
import { ExercisePhoto } from '../ExercisePhoto'
import type { Exercise } from '../../types'

interface LadderStepCardProps {
  round: number
  rounds: number
  exercise: Exercise
  exerciseIndex: number
  exerciseCount: number
  targetReps: number
  reps: number
  next?: { exercise: Exercise; reps: number; newRound: boolean }
  onRepsChange: (reps: number) => void
  onDone: () => void
}

// The exercise to do right now, big enough to read with the dumbbells in hand.
export function LadderStepCard({
  round,
  rounds,
  exercise,
  exerciseIndex,
  exerciseCount,
  targetReps,
  reps,
  next,
  onRepsChange,
  onDone,
}: LadderStepCardProps) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex gap-1.5" aria-label={`Ronda ${round} de ${rounds}`}>
        {Array.from({ length: rounds }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < round - 1 ? 'bg-accent' : i === round - 1 ? 'bg-accent/50' : 'bg-surface-2'}`} />
        ))}
      </div>

      <section className="card-forged flex flex-col items-center p-6 text-center">
        <span className="text-xs uppercase tracking-wide text-text-muted">
          Ronda {round} de {rounds} · ejercicio {exerciseIndex + 1} de {exerciseCount}
        </span>
        <div className="mt-3 font-display text-8xl font-medium leading-none tabular-nums text-accent">{reps}</div>
        <span className="mt-1 text-sm text-text-muted">{reps === 1 ? 'repetición' : 'repeticiones'}</span>
        <div className="mt-5 flex items-center gap-3">
          <ExercisePhoto exerciseId={exercise.id!} />
          <h2 className="text-left font-display text-2xl font-medium uppercase leading-tight tracking-wide text-text">
            {exercise.name}
          </h2>
        </div>

        <div className="mt-5 flex items-center gap-3 text-xs text-text-muted">
          <button
            onClick={() => onRepsChange(Math.max(0, reps - 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border hover:text-text"
            aria-label="Una repetición menos"
          >
            <Minus size={14} />
          </button>
          <span>{reps === targetReps ? '¿No salen todas? Ajusta aquí' : `Objetivo: ${targetReps}`}</span>
          <button
            onClick={() => onRepsChange(Math.min(targetReps, reps + 1))}
            disabled={reps >= targetReps}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border hover:text-text disabled:opacity-30"
            aria-label="Una repetición más"
          >
            <Plus size={14} />
          </button>
        </div>
      </section>

      {next && (
        <div className="flex items-center gap-2 px-1 text-sm text-text-muted">
          <ArrowRight size={15} className="shrink-0 text-accent" />
          <span className="min-w-0 truncate">
            {next.newRound ? 'Descanso y luego ' : 'Después: '}
            <span className="text-text">{next.exercise.name}</span> × {next.reps}
          </span>
        </div>
      )}

      <button
        onClick={onDone}
        className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-accent py-5 text-lg font-medium text-bg transition-transform hover:bg-accent-hover active:scale-[0.98]"
      >
        <Check size={20} />
        Hecho
      </button>
    </div>
  )
}
