import { ArrowDown, ArrowUp, ChevronDown, X } from 'lucide-react'
import { ExercisePhoto } from '../ExercisePhoto'
import { PrescriptionEditor } from './PrescriptionEditor'
import { formatPrescription } from '../../lib/prescription'
import type { Exercise, RoutineItem } from '../../types'

interface SelectedExerciseCardProps {
  index: number
  exercise: Exercise
  item: RoutineItem
  isFirst: boolean
  isLast: boolean
  expanded: boolean
  onToggleExpanded: () => void
  onChange: (item: RoutineItem) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}

// One exercise of the routine: order, prescription summary, and the editor when expanded.
export function SelectedExerciseCard({
  index,
  exercise,
  item,
  isFirst,
  isLast,
  expanded,
  onToggleExpanded,
  onChange,
  onMove,
  onRemove,
}: SelectedExerciseCardProps) {
  const prescription = formatPrescription(item)
  const iconButton =
    'flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:text-text disabled:opacity-25'

  return (
    <div className={`card-forged p-2.5 transition-colors ${expanded ? 'border-accent-muted' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="relative">
          <ExercisePhoto exerciseId={exercise.id!} />
          <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent font-display text-[11px] text-bg">
            {index + 1}
          </span>
        </div>
        <button type="button" onClick={onToggleExpanded} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium leading-snug text-text">{exercise.name}</span>
            <span className={`mt-0.5 block truncate text-xs ${prescription ? 'text-accent' : 'text-text-muted'}`}>
              {prescription ?? `${exercise.muscleGroup} · sin objetivo`}
            </span>
          </span>
          <ChevronDown size={16} className={`shrink-0 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        <div className="flex shrink-0 flex-col">
          <button type="button" onClick={() => onMove(-1)} disabled={isFirst} className={iconButton} aria-label="Subir">
            <ArrowUp size={15} />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={isLast} className={iconButton} aria-label="Bajar">
            <ArrowDown size={15} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 border-t border-white/[0.06] pt-3">
          <PrescriptionEditor value={item} onChange={(p) => onChange({ ...item, ...p })} />
          <button
            type="button"
            onClick={onRemove}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs text-danger hover:underline"
          >
            <X size={14} />
            Quitar de la rutina
          </button>
        </div>
      )}
    </div>
  )
}
