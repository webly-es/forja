import { useState } from 'react'
import { SettingsSheet } from '../settings/SettingsSheet'
import { SKIP_REASONS, SKIP_REASON_LABELS } from '../../lib/sessionIncidents'
import type { Exercise, SkipReason } from '../../types'

interface SkipReasonSheetProps {
  pending: Exercise[] // exercises with no sets and no reason yet
  suggested?: SkipReason
  onConfirm: (reason: SkipReason) => void
  onKeepTraining: () => void
}

// Asked on finishing with exercises left: one tap so the coach knows what happened.
export function SkipReasonSheet({ pending, suggested, onConfirm, onKeepTraining }: SkipReasonSheetProps) {
  const [reason, setReason] = useState<SkipReason | undefined>(suggested)
  const count = pending.length

  return (
    <SettingsSheet title={`Te ${count === 1 ? 'queda 1 ejercicio' : `quedan ${count} ejercicios`} sin hacer`} onClose={onKeepTraining}>
      <ul className="-mt-2 flex flex-col gap-0.5">
        {pending.map((e) => (
          <li key={e.id} className="text-sm text-text-muted">
            {e.name}
          </li>
        ))}
      </ul>

      <div>
        <span className="mb-2 block text-xs uppercase tracking-wide text-text-muted">¿Qué ha pasado?</span>
        <div className="flex flex-wrap gap-1.5">
          {SKIP_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                reason === r ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-surface-2 text-text-muted hover:text-text'
              }`}
            >
              {SKIP_REASON_LABELS[r]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-text-muted">
          El coach lo tendrá en cuenta: un imprevisto no cuenta como estancamiento.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={onKeepTraining} className="rounded-lg border border-border py-2.5 text-sm text-text-muted hover:text-text">
          Seguir entrenando
        </button>
        <button
          onClick={() => reason && onConfirm(reason)}
          disabled={!reason}
          className="rounded-lg bg-accent py-2.5 text-sm font-medium text-bg transition-opacity disabled:opacity-30"
        >
          Finalizar
        </button>
      </div>
    </SettingsSheet>
  )
}
