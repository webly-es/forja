import { useState } from 'react'

interface SetLoggerProps {
  setNumber: number
  defaultWeight?: number
  defaultReps?: number
  onSave: (weightKg: number, reps: number) => void
}

export function SetLogger({ setNumber, defaultWeight, defaultReps, onSave }: SetLoggerProps) {
  const [weight, setWeight] = useState(defaultWeight != null ? String(defaultWeight) : '')
  const [reps, setReps] = useState(defaultReps != null ? String(defaultReps) : '')

  const canSave = weight.trim() !== '' && reps.trim() !== '' && Number(weight) >= 0 && Number(reps) > 0

  function handleSave() {
    if (!canSave) return
    onSave(Number(weight), Number(reps))
  }

  return (
    <div className="flex items-center gap-2">
      <span className="w-6 shrink-0 text-center text-sm text-text-muted">{setNumber}</span>
      <div className="flex flex-1 items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          placeholder="kg"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 py-2 text-center text-text focus:border-accent focus:outline-none"
        />
        <span className="text-text-muted">×</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="reps"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          className="w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 py-2 text-center text-text focus:border-accent focus:outline-none"
        />
      </div>
      <button
        onClick={handleSave}
        disabled={!canSave}
        className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg transition-opacity disabled:opacity-30 hover:bg-accent-hover"
      >
        Guardar
      </button>
    </div>
  )
}
