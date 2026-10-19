import { ArrowUpDown, Minus, Plus, SlidersHorizontal } from 'lucide-react'
import { diffRoutines, type RoutineChange } from '../../lib/routineDiff'
import { formatPrescription } from '../../lib/prescription'
import type { Exercise, RoutineItem } from '../../types'

const KIND: Record<RoutineChange['kind'], { icon: typeof Plus; label: string; className: string }> = {
  added: { icon: Plus, label: 'Entra', className: 'text-accent' },
  removed: { icon: Minus, label: 'Sale', className: 'text-danger' },
  moved: { icon: ArrowUpDown, label: 'Cambia de orden', className: 'text-text-muted' },
  changed: { icon: SlidersHorizontal, label: 'Nuevo objetivo', className: 'text-text-muted' },
}

// What a proposed version changes compared with the routine being edited.
export function RoutineDiff({
  before,
  after,
  exercisesById,
}: {
  before: RoutineItem[]
  after: RoutineItem[]
  exercisesById: Map<number, Exercise>
}) {
  const changes = diffRoutines(before, after)
  if (changes.length === 0) return <p className="text-sm text-text-muted">No cambia nada de la rutina.</p>

  return (
    <ul className="flex flex-col divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-border bg-surface-2">
      {changes.map((change) => {
        const { icon: Icon, label, className } = KIND[change.kind]
        const was = change.before ? formatPrescription(change.before) : null
        const now = change.after ? formatPrescription(change.after) : null
        return (
          <li key={`${change.kind}-${change.exerciseId}`} className="flex items-start gap-2.5 px-3 py-2.5">
            <Icon size={15} className={`mt-0.5 shrink-0 ${className}`} aria-label={label} />
            <span className="min-w-0 flex-1">
              <span className={`block text-sm ${change.kind === 'removed' ? 'text-text-muted line-through' : 'text-text'}`}>
                {exercisesById.get(change.exerciseId)?.name ?? 'Ejercicio'}
              </span>
              <span className="block text-xs text-text-muted">
                {label}
                {change.kind === 'moved' && change.after && ` · puesto ${after.indexOf(change.after) + 1}`}
                {change.kind === 'changed' && ` · ${was ?? 'sin objetivo'} → ${now ?? 'sin objetivo'}`}
                {change.kind === 'added' && now && ` · ${now}`}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
