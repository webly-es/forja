import { useEffect } from 'react'
import { Trophy, X } from 'lucide-react'
import type { PersonalRecord } from '../lib/records'
import { playRecordChime, vibrateRecord } from '../lib/sound'

interface RecordToastProps {
  exerciseName: string
  record: PersonalRecord
  onClose: () => void
}

const VISIBLE_MS = 4500
const kg = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 })

// Brief gold banner at the top when a set beats the exercise's personal best.
export function RecordToast({ exerciseName, record, onClose }: RecordToastProps) {
  useEffect(() => {
    playRecordChime()
    vibrateRecord()
    const timer = window.setTimeout(onClose, VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [onClose])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div
        role="status"
        className="animate-record-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-accent bg-gradient-to-r from-accent/25 via-surface to-surface p-3 shadow-[0_10px_40px_-10px_var(--color-accent)] backdrop-blur"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-bg">
          <Trophy size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-accent">
            {record.kind === 'weight' ? 'Nuevo récord de peso' : 'Nuevo récord de fuerza'}
          </div>
          <div className="truncate text-sm text-text">
            <span className="font-display text-base">
              {kg(record.weightKg)} kg × {record.reps}
            </span>{' '}
            <span className="text-text-muted">
              (antes {kg(record.previous.weightKg)} × {record.previous.reps})
            </span>
          </div>
          <div className="truncate text-xs text-text-muted">{exerciseName}</div>
        </div>
        <button onClick={onClose} className="shrink-0 text-text-muted hover:text-text" aria-label="Cerrar">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
