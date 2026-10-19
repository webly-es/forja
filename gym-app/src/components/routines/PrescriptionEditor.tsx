import { Minus, Plus } from 'lucide-react'
import { DEFAULT_PRESCRIPTION, formatRest, hasPrescription } from '../../lib/prescription'
import type { RoutineItem } from '../../types'

type Prescription = Pick<RoutineItem, 'sets' | 'repMin' | 'repMax' | 'restSeconds'>

interface StepperProps {
  label: string
  value: string
  onMinus: () => void
  onPlus: () => void
}

function Stepper({ label, value, onMinus, onPlus }: StepperProps) {
  const button =
    'flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-text-muted transition-colors hover:text-text active:scale-[0.95]'
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-text-muted">{label}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={onMinus} className={button} aria-label={`Menos ${label}`}>
          <Minus size={14} />
        </button>
        <span className="min-w-[3.25rem] text-center font-display text-lg tabular-nums text-text">{value}</span>
        <button type="button" onClick={onPlus} className={button} aria-label={`Más ${label}`}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

// Sets × rep range × rest for one exercise of the routine.
export function PrescriptionEditor({ value, onChange }: { value: Prescription; onChange: (next: Prescription) => void }) {
  if (!hasPrescription(value)) {
    return (
      <button
        type="button"
        onClick={() => onChange({ ...DEFAULT_PRESCRIPTION })}
        className="w-full rounded-lg border border-dashed border-border py-2.5 text-sm text-text-muted transition-colors hover:border-accent hover:text-accent"
      >
        Añadir series y repeticiones
      </button>
    )
  }

  const sets = value.sets ?? DEFAULT_PRESCRIPTION.sets
  const repMin = value.repMin ?? DEFAULT_PRESCRIPTION.repMin
  const repMax = Math.max(repMin, value.repMax ?? repMin)
  const rest = value.restSeconds ?? DEFAULT_PRESCRIPTION.restSeconds
  const set = (patch: Prescription) => onChange({ sets, repMin, repMax, restSeconds: rest, ...patch })

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-x-2 gap-y-3">
        <Stepper
          label="Series"
          value={String(sets)}
          onMinus={() => set({ sets: clamp(sets - 1, 1, 10) })}
          onPlus={() => set({ sets: clamp(sets + 1, 1, 10) })}
        />
        <Stepper
          label="Descanso"
          value={formatRest(rest)}
          onMinus={() => set({ restSeconds: clamp(rest - 15, 15, 300) })}
          onPlus={() => set({ restSeconds: clamp(rest + 15, 15, 300) })}
        />
        <Stepper
          label="Reps mín."
          value={String(repMin)}
          onMinus={() => set({ repMin: clamp(repMin - 1, 1, 50) })}
          onPlus={() => {
            const next = clamp(repMin + 1, 1, 50)
            set({ repMin: next, repMax: Math.max(repMax, next) })
          }}
        />
        <Stepper
          label="Reps máx."
          value={String(repMax)}
          onMinus={() => {
            const next = clamp(repMax - 1, 1, 50)
            set({ repMax: next, repMin: Math.min(repMin, next) })
          }}
          onPlus={() => set({ repMax: clamp(repMax + 1, 1, 50) })}
        />
      </div>
      <button
        type="button"
        onClick={() => onChange({ sets: undefined, repMin: undefined, repMax: undefined, restSeconds: undefined })}
        className="self-center text-xs text-text-muted hover:text-text"
      >
        Sin objetivo fijo
      </button>
    </div>
  )
}
