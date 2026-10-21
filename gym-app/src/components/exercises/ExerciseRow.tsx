import { ChevronRight } from 'lucide-react'
import { ExercisePhoto } from '../ExercisePhoto'
import { equipmentOf } from '../../lib/equipment'
import type { ExerciseStats } from '../../db/exerciseStats'
import type { Exercise } from '../../types'
import { formatLoad } from '../../lib/bodyweight'

interface ExerciseRowProps {
  exercise: Exercise
  stats?: ExerciseStats
  showGroup: boolean
  onOpen: () => void
}

export function ExerciseRow({ exercise, stats, showGroup, onOpen }: ExerciseRowProps) {
  const machine = stats?.machine
  const details = [
    showGroup ? exercise.muscleGroup : null,
    equipmentOf(exercise),
    machine?.seat ? `Asiento ${machine.seat}` : null,
    machine?.lever ? `Palanca ${machine.lever}` : null,
  ].filter(Boolean)
  const best = stats?.best

  return (
    <div className="card-forged flex items-center gap-3 p-2.5 pr-3 transition-transform active:scale-[0.98]">
      <ExercisePhoto exerciseId={exercise.id!} />
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium leading-snug text-text">{exercise.name}</span>
          {details.length > 0 && (
            <span className="mt-0.5 block truncate text-xs text-text-muted">{details.join(' · ')}</span>
          )}
        </span>
        <span className="shrink-0 text-right">
          {best ? (
            <>
              <span className="block font-display text-base leading-none text-accent">
                {formatLoad(best)}
              </span>
              <span className="mt-1 block text-[11px] text-text-muted">× {best.reps} récord</span>
            </>
          ) : (
            <span className="block text-[11px] uppercase tracking-wide text-text-muted/60">Sin datos</span>
          )}
        </span>
        <ChevronRight size={16} className="shrink-0 text-text-muted" />
      </button>
    </div>
  )
}
